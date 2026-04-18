const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const ADMIN_HEADER = 'x-admin-token';
const adminToken = process.env.ADMIN_API_TOKEN;

const DEAL_SOURCES_PATH = path.join(__dirname, '../../config/dealSources.json');

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

/**
 * GET — full dealSources.json for admin review (read-only; edits stay in repo file).
 */
router.get('/', (req, res) => {
  try {
    const raw = fs.readFileSync(DEAL_SOURCES_PATH, 'utf8');
    const sources = JSON.parse(raw);
    if (!Array.isArray(sources)) {
      return res.status(500).json({
        data: null,
        error: { message: 'dealSources.json must be a JSON array' },
        meta: {},
      });
    }

    const categoryFilter = (process.env.SCRAPER_CATEGORY_FILTER || '').trim() || null;

    res.json({
      data: {
        sources,
        categoryFilter,
        configHint: 'server/config/dealSources.json',
      },
      error: null,
      meta: { count: sources.length },
    });
  } catch (e) {
    console.error('[admin/deal-sources] read failed:', e.message);
    return res.status(500).json({
      data: null,
      error: { message: e.message || 'Failed to read deal sources' },
      meta: {},
    });
  }
});

module.exports = router;
