const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const buildEnvelope = ({ data, error = null, meta = {} }) => ({
  data,
  error,
  meta: { recommended_by: 'preferences-service', ...meta },
});

const optionalCoord = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const MERCHANT_SUGGESTION_COLUMNS =
  'id, user_id AS "userId", merchant_name AS "merchantName", address, city, latitude, longitude, notes, created_at AS "createdAt"';

// Get user preferences
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        preferred_categories AS "preferredCategories",
        preferred_brands AS "preferredBrands",
        preferred_locations AS "preferredLocations",
        budget_preferences AS "budgetPreferences",
        notification_settings AS "notificationSettings",
        travel_preferences AS "travelPreferences",
        privacy_settings AS "privacySettings",
        consent_version AS "consentVersion",
        consent_updated_at AS "consentUpdatedAt"
      FROM user_preferences
      WHERE user_id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json(buildEnvelope({ data: null, meta: { cache_hit: false } }));
    }

    res.json(buildEnvelope({ data: result.rows[0], meta: { cache_hit: true } }));
  } catch (error) {
    console.error('Get preferences error:', error);
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

// Update user preferences
router.put('/', authMiddleware, async (req, res) => {
  try {
    console.log('[preferences] Update request received for user:', req.user.userId);
    console.log('[preferences] Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      preferredCategories,
      preferredBrands,
      preferredLocations,
      budgetPreferences,
      notificationSettings,
      travelPreferences,
      privacySettings,
      consentVersion
    } = req.body;
    
    // Check if preferences exist
    const existing = await pool.query(
      'SELECT id FROM user_preferences WHERE user_id = $1',
      [req.user.userId]
    );
    
    let result;
    if (existing.rows.length > 0) {
      // Update existing preferences
      console.log('[preferences] Updating existing preferences for user:', req.user.userId);
      result = await pool.query(
        `UPDATE user_preferences SET 
          preferred_categories = $1::jsonb, 
          preferred_brands = $2::jsonb, 
          preferred_locations = $3::jsonb,
          budget_preferences = $4::jsonb, 
          notification_settings = $5::jsonb, 
          travel_preferences = $6::jsonb,
          privacy_settings = COALESCE($7::jsonb, privacy_settings),
          consent_version = COALESCE($8::varchar, consent_version),
          consent_updated_at = CASE WHEN $8 IS NOT NULL THEN NOW() ELSE consent_updated_at END,
          updated_at = NOW()
        WHERE user_id = $9
        RETURNING 
          preferred_categories AS "preferredCategories",
          preferred_brands AS "preferredBrands",
          preferred_locations AS "preferredLocations",
          budget_preferences AS "budgetPreferences",
          notification_settings AS "notificationSettings",
          travel_preferences AS "travelPreferences",
          privacy_settings AS "privacySettings",
          consent_version AS "consentVersion",
          consent_updated_at AS "consentUpdatedAt"`,
        [
          JSON.stringify(preferredCategories || []), 
          JSON.stringify(preferredBrands || []), 
          JSON.stringify(preferredLocations || []),
          budgetPreferences ? JSON.stringify(budgetPreferences) : null, 
          notificationSettings ? JSON.stringify(notificationSettings) : null, 
          travelPreferences ? JSON.stringify(travelPreferences) : null,
          privacySettings ? JSON.stringify(privacySettings) : null, 
          consentVersion,
          req.user.userId
        ]
      );
    } else {
      // Create new preferences
      console.log('[preferences] Creating new preferences for user:', req.user.userId);
      result = await pool.query(
        `INSERT INTO user_preferences (
          user_id, preferred_categories, preferred_brands, preferred_locations,
          budget_preferences, notification_settings, travel_preferences,
          privacy_settings, consent_version, consent_updated_at
        ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::varchar, CASE WHEN $9 IS NOT NULL THEN NOW() ELSE NULL END)
        RETURNING 
          preferred_categories AS "preferredCategories",
          preferred_brands AS "preferredBrands",
          preferred_locations AS "preferredLocations",
          budget_preferences AS "budgetPreferences",
          notification_settings AS "notificationSettings",
          travel_preferences AS "travelPreferences",
          privacy_settings AS "privacySettings",
          consent_version AS "consentVersion",
          consent_updated_at AS "consentUpdatedAt"`,
        [
          req.user.userId, 
          JSON.stringify(preferredCategories || []), 
          JSON.stringify(preferredBrands || []), 
          JSON.stringify(preferredLocations || []),
          budgetPreferences ? JSON.stringify(budgetPreferences) : null, 
          notificationSettings ? JSON.stringify(notificationSettings) : null, 
          travelPreferences ? JSON.stringify(travelPreferences) : null,
          privacySettings ? JSON.stringify(privacySettings) : null, 
          consentVersion
        ]
      );
    }
    
    console.log('[preferences] Successfully saved preferences:', {
      operation: existing.rows.length > 0 ? 'updated' : 'created',
      userId: req.user.userId,
    });
    
    res.json(
      buildEnvelope({
        data: result.rows[0],
        meta: { operation: existing.rows.length > 0 ? 'updated' : 'created' },
      })
    );
  } catch (error) {
    console.error('[preferences] Update preferences error:', error);
    console.error('[preferences] Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });
    res
      .status(500)
      .json(
        buildEnvelope({
          data: null,
          error: { 
            message: error.message || 'Internal server error', 
            code: 'INTERNAL_ERROR' 
          },
        })
      );
  }
});

// Merchant suggestions (user-submitted name + location to grow merchant data)
router.post('/merchant-suggestions', authMiddleware, async (req, res) => {
  try {
    const name = typeof req.body.merchantName === 'string' ? req.body.merchantName.trim() : '';
    if (!name || name.length > 255) {
      return res
        .status(400)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'merchantName is required (max 255 characters)', code: 'VALIDATION_ERROR' },
          })
        );
    }
    const address =
      typeof req.body.address === 'string' && req.body.address.trim() ? req.body.address.trim().slice(0, 2000) : null;
    const city =
      typeof req.body.city === 'string' && req.body.city.trim() ? req.body.city.trim().slice(0, 100) : null;
    const notes =
      typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim().slice(0, 2000) : null;
    const latitude = optionalCoord(req.body.latitude);
    const longitude = optionalCoord(req.body.longitude);

    const result = await pool.query(
      `INSERT INTO user_merchant_suggestions (
        user_id, merchant_name, address, city, latitude, longitude, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${MERCHANT_SUGGESTION_COLUMNS}`,
      [req.user.userId, name, address, city, latitude, longitude, notes]
    );

    res.status(201).json(buildEnvelope({ data: result.rows[0] }));
  } catch (error) {
    console.error('Add merchant suggestion error:', error);
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

router.get('/merchant-suggestions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${MERCHANT_SUGGESTION_COLUMNS} FROM user_merchant_suggestions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json(buildEnvelope({ data: result.rows, meta: { total: result.rows.length } }));
  } catch (error) {
    console.error('Get merchant suggestions error:', error);
    if (error.message && error.message.includes('user_merchant_suggestions')) {
      return res
        .status(503)
        .json(
          buildEnvelope({
            data: [],
            error: {
              message: 'Merchant suggestions require a database migration. Run server/migrations/20260402_user_merchant_suggestions.sql',
              code: 'SCHEMA_MISSING',
            },
            meta: { total: 0 },
          })
        );
    }
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

router.delete('/merchant-suggestions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM user_merchant_suggestions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'Merchant suggestion not found', code: 'NOT_FOUND' },
          })
        );
    }
    res.json(buildEnvelope({ data: { removed: true, id: Number(id) } }));
  } catch (error) {
    console.error('Remove merchant suggestion error:', error);
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

// Add favorite place
router.post('/favorite-places', authMiddleware, async (req, res) => {
  try {
    const placeName =
      typeof req.body.placeName === 'string' ? req.body.placeName.trim() : '';
    if (!placeName || placeName.length > 255) {
      return res
        .status(400)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'placeName is required (max 255 characters)', code: 'VALIDATION_ERROR' },
          })
        );
    }
    const placeType =
      typeof req.body.placeType === 'string' && req.body.placeType.trim()
        ? req.body.placeType.trim().slice(0, 100)
        : null;
    const address =
      typeof req.body.address === 'string' && req.body.address.trim()
        ? req.body.address.trim().slice(0, 2000)
        : null;
    const category =
      typeof req.body.category === 'string' && req.body.category.trim()
        ? req.body.category.trim().slice(0, 100)
        : null;
    const latitude = optionalCoord(req.body.latitude);
    const longitude = optionalCoord(req.body.longitude);

    const result = await pool.query(
      `INSERT INTO user_favorite_places (
        user_id, place_name, place_type, address, latitude, longitude, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [req.user.userId, placeName, placeType, address, latitude, longitude, category]
    );
    
    res.status(201).json(buildEnvelope({ data: result.rows[0] }));
  } catch (error) {
    console.error('Add favorite place error:', error);
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

// Get favorite places
router.get('/favorite-places', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_favorite_places WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    
    res.json(buildEnvelope({ data: result.rows, meta: { total: result.rows.length } }));
  } catch (error) {
    console.error('Get favorite places error:', error);
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

// Remove favorite place
router.delete('/favorite-places/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM user_favorite_places WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'Favorite place not found', code: 'NOT_FOUND' },
          })
        );
    }

    res.json(buildEnvelope({ data: { removed: true, id } }));
  } catch (error) {
    console.error('Remove favorite place error:', error);
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

module.exports = router;
