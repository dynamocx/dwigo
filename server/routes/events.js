const express = require('express');
const jwt = require('jsonwebtoken');

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

router.post('/', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const {
      eventType,
      entityType,
      entityId,
      metadata,
      source,
      deviceId,
      anonymousId,
      occurredAt,
    } = req.body || {};

    if (!eventType || typeof eventType !== 'string') {
      return res.status(400).json({ error: 'eventType is required' });
    }

    let occurredAtTimestamp = new Date();
    if (occurredAt) {
      const parsed = new Date(occurredAt);
      if (!Number.isNaN(parsed.getTime())) {
        occurredAtTimestamp = parsed;
      }
    }

    await pool.query(
      `INSERT INTO analytics_events
        (event_type, user_id, anonymous_id, entity_type, entity_id, source, device_id, metadata, occurred_at, received_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        eventType,
        userId,
        anonymousId ?? null,
        entityType ?? null,
        entityId != null ? String(entityId) : null,
        source ?? 'app',
        deviceId ?? null,
        metadata ?? null,
        occurredAtTimestamp,
      ]
    );

    res.status(202).json({ status: 'accepted' });
  } catch (error) {
    console.error('Analytics event ingest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

