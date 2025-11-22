const express = require('express');
const pool = require('../config/database');

const router = express.Router();

router.get('/pending', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await pool.query(
      `
        SELECT r.*,
               j.source AS job_source,
               j.scope AS job_scope,
               j.started_at AS job_started_at
        FROM ingested_deal_raw r
        LEFT JOIN ingestion_jobs j ON j.id = r.job_id
        WHERE r.status = 'pending'
        ORDER BY r.id ASC
        LIMIT $1
      `,
      [Math.min(Number(limit) || 20, 200)]
    );

    res.json({
      data: result.rows,
      error: null,
      meta: { total: result.rows.length },
    });
  } catch (error) {
    console.error('Fetch pending ingested deals error:', error);
    res.status(500).json({
      data: [],
      error: { message: 'Failed to load pending ingested deals' },
      meta: {},
    });
  }
});

module.exports = router;


