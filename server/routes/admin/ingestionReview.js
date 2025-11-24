const express = require('express');
const pool = require('../../config/database');
const {
  promoteIngestedDealsByIds,
  rejectIngestedDealsByIds,
} = require('../../services/dealPromotion');
const { processIngestionJob } = require('../../services/ingestion');

const router = express.Router();

const ADMIN_HEADER = 'x-admin-token';
const adminToken = process.env.ADMIN_API_TOKEN;

const requireAdminToken = (req, res, next) => {
  if (!adminToken) {
    return res.status(500).json({
      data: null,
      error: { message: 'ADMIN_API_TOKEN not configured on server' },
      meta: {},
    });
  }

  const incoming = req.header(ADMIN_HEADER);
  if (!incoming || incoming !== adminToken) {
    return res.status(401).json({
      data: null,
      error: { message: 'Unauthorized' },
      meta: {},
    });
  }

  next();
};

router.use(requireAdminToken);

router.get('/pending', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const { rows } = await pool.query(
      `
        SELECT r.*,
               j.source AS job_source,
               j.scope AS job_scope,
               j.started_at AS job_started_at,
               j.finished_at AS job_finished_at
        FROM ingested_deal_raw r
        LEFT JOIN ingestion_jobs j ON j.id = r.job_id
        WHERE r.status = 'pending'
        ORDER BY r.id ASC
        LIMIT $1
      `,
      [limit]
    );

    // Also get stats on auto-rejected deals for context
    const { rows: rejectedStats } = await pool.query(
      `
        SELECT COUNT(*) as count
        FROM ingested_deal_raw
        WHERE status = 'auto_rejected'
          AND created_at > NOW() - INTERVAL '7 days'
      `
    );

    res.json({
      data: rows,
      error: null,
      meta: { 
        total: rows.length,
        autoRejectedLast7Days: Number(rejectedStats[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('[admin/ingestion] pending fetch error', error);
    res.status(500).json({
      data: [],
      error: { message: 'Failed to load pending ingestion rows' },
      meta: {},
    });
  }
});

router.post('/promote', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const stats = await promoteIngestedDealsByIds(ids);

    res.json({
      data: stats,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] promote error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to promote ingestion rows' },
      meta: {},
    });
  }
});

router.post('/reject', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    const result = await rejectIngestedDealsByIds(ids);

    res.json({
      data: result,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] reject error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to reject ingestion rows' },
      meta: {},
    });
  }
});

router.get('/debug/deals', async (req, res) => {
  try {
    // Get all deals with their merchant info
    const { rows: allDeals } = await pool.query(`
      SELECT 
        d.id,
        d.title,
        d.status,
        d.category,
        d.end_date,
        d.created_at,
        d.merchant_id,
        m.business_name,
        CASE 
          WHEN d.end_date IS NULL THEN 'no end date'
          WHEN d.end_date > NOW() THEN 'future'
          ELSE 'past'
        END as end_date_status,
        CASE 
          WHEN m.id IS NULL THEN 'no merchant'
          ELSE 'has merchant'
        END as merchant_status
      FROM deals d
      LEFT JOIN merchants m ON d.merchant_id = m.id
      ORDER BY d.created_at DESC
      LIMIT 20
    `);

    // Get deals that should appear in the main query
    const { rows: visibleDeals } = await pool.query(`
      SELECT d.id, d.title, d.status, d.category, d.end_date, m.business_name
      FROM deals d
      INNER JOIN merchants m ON d.merchant_id = m.id
      WHERE d.status = 'active' AND (d.end_date IS NULL OR d.end_date > NOW())
      ORDER BY d.created_at DESC
      LIMIT 20
    `);

    res.json({
      data: {
        allDeals,
        visibleDeals,
        summary: {
          total: allDeals.length,
          visible: visibleDeals.length,
          hidden: allDeals.length - visibleDeals.length,
        },
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] debug error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to debug deals' },
      meta: {},
    });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const sampleDeals = [
      {
        merchantAlias: 'Lansing Brewing Company',
        rawPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          description: 'Celebrate the Mitten every Monday with 15% off all Michigan-made drafts and flights.',
          category: 'Restaurants',
          address: '518 E Shiawassee St, Lansing, MI 48912',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48912',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          sourceUrl: 'https://www.lansingbrewingcompany.com/events',
        },
        normalizedPayload: {
          title: 'Michigan Mondays – 15% Off Local Pours',
          category: 'Restaurants',
          location: {
            city: 'Lansing',
            state: 'MI',
          },
          schedule: {
            type: 'recurring_weekly',
            rule: {
              daysOfWeek: ['monday'],
              startTime: '16:00',
              endTime: '21:00',
            },
          },
          discount: {
            type: 'percentage',
            value: 15,
          },
        },
        confidence: 0.8,
      },
      {
        merchantAlias: 'Horrocks Farm Market',
        rawPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          description: 'Stroll the greenhouse with live acoustic music, sample 6 curated wine and cheese pairings.',
          category: 'Entertainment',
          address: '7420 W Saginaw Hwy, Lansing, MI 48917',
          city: 'Lansing',
          state: 'MI',
          postalCode: '48917',
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          price: 25,
          sourceUrl: 'https://www.shophorrocks.com/events',
        },
        normalizedPayload: {
          title: 'Winter Wine Walk & Cheese Pairings',
          category: 'Entertainment',
          price: {
            currency: 'USD',
            amount: 25,
          },
          location: {
            city: 'Lansing',
            state: 'MI',
          },
          schedule: {
            type: 'one_time',
            rule: {
              startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
            },
          },
        },
        confidence: 0.7,
      },
    ];

    const payload = {
      source: 'admin-seed',
      scope: 'test-deals',
      deals: sampleDeals,
    };

    // Process the ingestion job directly (since we don't have a worker service on free tier)
    const result = await processIngestionJob(payload);

    res.json({
      data: { 
        message: 'Ingestion job processed', 
        dealCount: sampleDeals.length,
        jobId: result.jobId,
        stats: result.stats,
      },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/ingestion] seed error', error);
    res.status(500).json({
      data: null,
      error: { message: 'Failed to seed ingestion job' },
      meta: {},
    });
  }
});

module.exports = router;


