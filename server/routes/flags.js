const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const pool = require('../config/database');

const router = express.Router();

const getUserIdFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return payload.userId;
  } catch (error) {
    return null;
  }
};

const evaluateFlagState = (flag, override, userId) => {
  if (override) {
    return override.is_enabled;
  }

  if (!flag.enabled) {
    return false;
  }

  const rollout = Number(flag.rollout_percentage ?? 0);
  if (rollout >= 100) {
    return true;
  }

  if (!userId) {
    return false;
  }

  const hash = crypto.createHash('sha256').update(`${flag.flag_key}:${userId}`).digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;

  return bucket < rollout;
};

router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    const { rows: flags } = await pool.query(
      'SELECT flag_key, enabled, rollout_percentage FROM feature_flags ORDER BY flag_key ASC'
    );

    let overrides = [];
    if (userId && flags.length > 0) {
      const { rows } = await pool.query(
        'SELECT flag_key, is_enabled FROM feature_flag_overrides WHERE user_id = $1 AND flag_key = ANY($2)',
        [userId, flags.map((flag) => flag.flag_key)]
      );
      overrides = rows;
    }

    const flagMap = flags.reduce((acc, flag) => {
      const override = overrides.find((item) => item.flag_key === flag.flag_key);
      acc[flag.flag_key] = evaluateFlagState(flag, override, userId);
      return acc;
    }, {});

    res.json({ flags: flagMap });
  } catch (error) {
    console.error('Fetch feature flags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

