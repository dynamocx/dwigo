const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { canPerformAction } = require('../utils/abuseGuard');

const router = express.Router();

const DEFAULT_RECOMMENDER = 'deal-service';

const buildEnvelope = ({ data, error = null, meta = {} }) => ({
  data,
  error,
  meta: { recommended_by: DEFAULT_RECOMMENDER, ...meta },
});

// Get all active deals
router.get('/', async (req, res) => {
  try {
    const { category, location, radius = 10, limit = 50 } = req.query;

    let query = `
      SELECT d.*, m.business_name, m.address, m.city, m.state, 
             m.latitude, m.longitude, m.business_type
      FROM deals d
      INNER JOIN merchants m ON d.merchant_id = m.id
      WHERE d.status = 'active' AND (d.end_date IS NULL OR d.end_date > NOW())
    `;

    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND d.category = $${paramCount}`;
      params.push(category);
    }

    if (location) {
      const [lat, lng] = location.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        paramCount++;
        query += ` AND ST_DWithin(
          ST_Point(m.longitude, m.latitude)::geography,
          ST_Point($${paramCount + 1}, $${paramCount})::geography,
          $${paramCount + 2}
        )`;
        params.push(lng, lat, radius * 1000); // Convert km to meters
      }
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    // Debug logging in development
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_DEALS === 'true') {
      console.log(`[deals] Query returned ${result.rows.length} deals`);
      if (result.rows.length > 0) {
        console.log(`[deals] Sample deal:`, {
          id: result.rows[0].id,
          title: result.rows[0].title,
          status: result.rows[0].status,
          category: result.rows[0].category,
          end_date: result.rows[0].end_date,
          merchant_id: result.rows[0].merchant_id,
          business_name: result.rows[0].business_name,
        });
      }
    }
    
    res.json(
      buildEnvelope({
        data: result.rows,
        meta: {
          total: result.rows.length,
          cache_hit: false,
          filters: {
            category: category ?? null,
            location: location ?? null,
            radius: Number(radius),
            limit: Number(limit),
          },
        },
      })
    );
  } catch (error) {
    console.error('Get deals error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: [],
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        })
      );
  }
});

// Get personalized deals for user
router.get('/personalized', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    // Get user preferences
    const preferencesResult = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    const preferences = preferencesResult.rows[0];
    if (!preferences) {
      return res.json(
        buildEnvelope({
          data: [],
          meta: {
            total: 0,
            recommended_by: 'dwigo-agent',
            reason: 'no-preferences',
          },
        })
      );
    }

    // Build personalized query based on preferences
    let query = `
      SELECT d.*, m.business_name, m.address, m.city, m.state,
             m.latitude, m.longitude, m.business_type,
             CASE WHEN udi.deal_id IS NOT NULL THEN true ELSE false END as is_saved
      FROM deals d
      JOIN merchants m ON d.merchant_id = m.id
      LEFT JOIN user_deal_interactions udi 
        ON d.id = udi.deal_id AND udi.user_id = $1 AND udi.interaction_type = 'saved'
      WHERE d.status = 'active' AND (d.end_date IS NULL OR d.end_date > NOW())
    `;

    const meta = {
      total: 0,
      recommended_by: 'dwigo-agent',
      filters: {
        categories: preferences.preferred_categories ?? [],
      },
    };

    const params = [userId];
    let paramCount = 1;

    // Filter by preferred categories
    if (preferences.preferred_categories && preferences.preferred_categories.length > 0) {
      paramCount++;
      query += ` AND d.category = ANY($${paramCount})`;
      params.push(preferences.preferred_categories);
    }
    
    // Filter by preferred locations (if user has location enabled)
    const userResult = await pool.query(
      'SELECT current_latitude, current_longitude FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0]?.current_latitude && userResult.rows[0]?.current_longitude) {
      paramCount += 3;
      query += ` AND ST_DWithin(
        ST_Point(m.longitude, m.latitude)::geography,
        ST_Point($${paramCount - 1}, $${paramCount - 2})::geography,
        $${paramCount}
      )`;
      params.push(
        userResult.rows[0].current_longitude,
        userResult.rows[0].current_latitude,
        5000 // 5km radius
      );
      meta.filters.location = {
        latitude: userResult.rows[0].current_latitude,
        longitude: userResult.rows[0].current_longitude,
        radius: 5000,
      };
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    meta.total = result.rows.length;
    res.json(
      buildEnvelope({
        data: result.rows,
        meta,
      })
    );
  } catch (error) {
    console.error('Get personalized deals error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: [],
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
          meta: { recommended_by: 'dwigo-agent' },
        })
      );
  }
});

// Get deal by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT d.*, m.business_name, m.address, m.city, m.state,
             m.latitude, m.longitude, m.business_type, m.website
      FROM deals d
      JOIN merchants m ON d.merchant_id = m.id
      WHERE d.id = $1
    `, [id]);
    
    // Get source reference from source_details if available
    const deal = result.rows[0];
    if (deal && deal.source_details) {
      try {
        const sourceDetails = typeof deal.source_details === 'string' 
          ? JSON.parse(deal.source_details) 
          : deal.source_details;
        deal.source_reference = deal.source_reference || sourceDetails.rawPayload?.sourceUrl || null;
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'Deal not found', code: 'NOT_FOUND' },
          })
        );
    }

    res.json(buildEnvelope({ data: result.rows[0], meta: { deal_id: Number(id) } }));
  } catch (error) {
    console.error('Get deal error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: null,
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        })
      );
  }
});

// Save/unsave deal
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // Check if already saved
    const existing = await pool.query(
      'SELECT id FROM user_deal_interactions WHERE user_id = $1 AND deal_id = $2 AND interaction_type = $3',
      [userId, id, 'saved']
    );
    
    if (existing.rows.length > 0) {
      // Unsave
      await pool.query(
        'DELETE FROM user_deal_interactions WHERE user_id = $1 AND deal_id = $2 AND interaction_type = $3',
        [userId, id, 'saved']
      );
      res.json(buildEnvelope({ data: { saved: false }, meta: { deal_id: Number(id) } }));
    } else {
      const dailySaves = await pool.query(
        `SELECT COUNT(*) FROM user_deal_interactions 
         WHERE user_id = $1 AND interaction_type = 'saved' AND created_at > NOW() - INTERVAL '1 day'`,
        [userId]
      );

      if (Number(dailySaves.rows[0].count) >= 200) {
        return res
          .status(429)
          .json(
            buildEnvelope({
              data: { saved: false },
              error: { message: 'Save limit reached for the day. Try again tomorrow.', code: 'RATE_LIMIT' },
              meta: { deal_id: Number(id) },
            })
          );
      }

      // Save
      await pool.query(
        'INSERT INTO user_deal_interactions (user_id, deal_id, interaction_type) VALUES ($1, $2, $3)',
        [userId, id, 'saved']
      );
      res.json(buildEnvelope({ data: { saved: true }, meta: { deal_id: Number(id) } }));
    }
  } catch (error) {
    console.error('Save deal error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: { saved: false },
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
          meta: { deal_id: Number(req.params.id) },
        })
      );
  }
});

// Get saved deals for user
router.get('/saved', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT d.*, m.business_name, m.address, m.city, m.state,
             m.latitude, m.longitude, m.business_type, m.website,
             true as is_saved
      FROM deals d
      JOIN merchants m ON d.merchant_id = m.id
      JOIN user_deal_interactions udi ON d.id = udi.deal_id
      WHERE udi.user_id = $1 
        AND udi.interaction_type = 'saved'
        AND d.status = 'active'
        AND (d.end_date IS NULL OR d.end_date > NOW())
      ORDER BY udi.created_at DESC
    `, [userId]);

    res.json(buildEnvelope({ data: result.rows, meta: { total: result.rows.length } }));
  } catch (error) {
    console.error('Get saved deals error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: [],
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        })
      );
  }
});

// Track deal view
router.post('/:id/view', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (
      !canPerformAction(`deal:view:${userId}:${id}`, {
        windowMs: 60 * 1000,
        maxAttempts: 5,
      })
    ) {
      return res
        .status(429)
        .json(
          buildEnvelope({
            data: { tracked: false },
            error: { message: 'You are viewing this deal too frequently. Give it a moment.', code: 'RATE_LIMIT' },
            meta: { deal_id: Number(id) },
          })
        );
    }

    const dailyViews = await pool.query(
      `SELECT COUNT(*) FROM user_deal_interactions
       WHERE user_id = $1 AND interaction_type = 'viewed' AND created_at > NOW() - INTERVAL '1 day'`,
      [userId]
    );

    if (Number(dailyViews.rows[0].count) >= 1000) {
      return res
        .status(429)
        .json(
          buildEnvelope({
            data: { tracked: false },
            error: { message: 'View limit reached for the day.', code: 'RATE_LIMIT' },
            meta: { deal_id: Number(id) },
          })
        );
    }

    await pool.query(
      'INSERT INTO user_deal_interactions (user_id, deal_id, interaction_type) VALUES ($1, $2, $3)',
      [userId, id, 'viewed']
    );

    res.json(buildEnvelope({ data: { tracked: true }, meta: { deal_id: Number(id) } }));
  } catch (error) {
    console.error('Track view error:', error);
    res
      .status(500)
      .json(
        buildEnvelope({
          data: { tracked: false },
          error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
          meta: { deal_id: Number(req.params.id) },
        })
      );
  }
});

module.exports = router;
