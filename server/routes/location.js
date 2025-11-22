const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { canPerformAction } = require('../utils/abuseGuard');

const router = express.Router();

// Update user location
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (
      !canPerformAction(`location:update:${req.user.userId}`, {
        windowMs: 60 * 1000,
        maxAttempts: 4,
      })
    ) {
      return res.status(429).json({
        error: 'Location updates are happening too quickly. Try again in a moment.',
      });
    }
    
    // Update user location
    await pool.query(
      'UPDATE users SET current_latitude = $1, current_longitude = $2, location_enabled = true WHERE id = $3',
      [latitude, longitude, req.user.userId]
    );
    
    // Check for nearby deals
    const nearbyDeals = await pool.query(`
      SELECT d.*, m.business_name, m.address, m.city, m.state,
             ST_Distance(
               ST_Point(m.longitude, m.latitude)::geography,
               ST_Point($1, $2)::geography
             ) as distance_meters
      FROM deals d
      JOIN merchants m ON d.merchant_id = m.id
      WHERE d.is_active = true 
        AND d.end_date > NOW()
        AND ST_DWithin(
          ST_Point(m.longitude, m.latitude)::geography,
          ST_Point($1, $2)::geography,
          5000
        )
      ORDER BY distance_meters
      LIMIT 10
    `, [longitude, latitude]);
    
    res.json({
      message: 'Location updated successfully',
      nearbyDeals: nearbyDeals.rows
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get nearby deals
router.get('/nearby', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const deals = await pool.query(`
      SELECT d.*, m.business_name, m.address, m.city, m.state,
             ST_Distance(
               ST_Point(m.longitude, m.latitude)::geography,
               ST_Point($1, $2)::geography
             ) as distance_meters
      FROM deals d
      JOIN merchants m ON d.merchant_id = m.id
      WHERE d.is_active = true 
        AND d.end_date > NOW()
        AND ST_DWithin(
          ST_Point(m.longitude, m.latitude)::geography,
          ST_Point($1, $2)::geography,
          $3 * 1000
        )
      ORDER BY distance_meters
    `, [longitude, latitude, radius]);
    
    res.json({ deals: deals.rows });
  } catch (error) {
    console.error('Get nearby deals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set up location-based notifications
router.post('/notifications', authMiddleware, async (req, res) => {
  try {
    const { dealId, latitude, longitude, radius = 1000 } = req.body;
    
    // Create location notification
    if (
      !canPerformAction(`location:notification:${req.user.userId}`, {
        windowMs: 60 * 60 * 1000,
        maxAttempts: 20,
      })
    ) {
      return res.status(429).json({
        error: 'Too many location notifications requested recently.',
      });
    }

    const existingCount = await pool.query(
      'SELECT COUNT(*) FROM location_notifications WHERE user_id = $1',
      [req.user.userId]
    );

    if (Number(existingCount.rows[0].count) >= 50) {
      return res.status(429).json({
        error: 'You have reached the maximum number of active location alerts. Remove one before adding another.',
      });
    }

    await pool.query(
      'INSERT INTO location_notifications (user_id, deal_id, latitude, longitude, radius_meters) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, dealId, latitude, longitude, radius]
    );
    
    res.json({ message: 'Location notification set up successfully' });
  } catch (error) {
    console.error('Set up location notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
