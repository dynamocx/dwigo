const express = require('express');
const pool = require('../../config/database');
const {
  promoteIngestedDealsByIds,
  rejectIngestedDealsByIds,
} = require('../../services/dealPromotion');

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

module.exports = router;


