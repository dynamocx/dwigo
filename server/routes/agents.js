const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get DWIGO agent recommendations
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const { type = 'general' } = req.query;
    
    // Get user preferences
    const preferencesResult = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.userId]
    );
    
    const preferences = preferencesResult.rows[0];
    if (!preferences) {
      return res.json({ recommendations: [] });
    }
    
    // Get user's favorite places
    const favoritePlacesResult = await pool.query(
      'SELECT * FROM user_favorite_places WHERE user_id = $1',
      [req.user.userId]
    );
    
    const favoritePlaces = favoritePlacesResult.rows;
    
    // Generate personalized recommendations based on type
    let recommendations = [];
    
    if (type === 'travel') {
      recommendations = await generateTravelRecommendations(preferences, favoritePlaces);
    } else if (type === 'local') {
      recommendations = await generateLocalRecommendations(preferences, favoritePlaces);
    } else {
      recommendations = await generateGeneralRecommendations(preferences, favoritePlaces);
    }
    
    res.json({ recommendations });
  } catch (error) {
    console.error('Get agent recommendations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate travel recommendations
async function generateTravelRecommendations(preferences, favoritePlaces) {
  // This would integrate with travel APIs and user preferences
  return [
    {
      type: 'travel',
      title: 'Weekend Getaway to Napa Valley',
      description: 'Based on your wine preferences, here are exclusive deals at top wineries',
      deals: [
        { name: 'Castello di Amorosa', discount: '20% off tasting', price: '$25' },
        { name: 'Domaine Carneros', discount: 'Buy 2 get 1 free', price: '$40' }
      ],
      confidence: 0.85
    },
    {
      type: 'travel',
      title: 'Beach Vacation in San Diego',
      description: 'Perfect weather and family-friendly activities with great deals',
      deals: [
        { name: 'Hotel Del Coronado', discount: '15% off 3+ nights', price: '$299/night' },
        { name: 'San Diego Zoo', discount: '2-for-1 tickets', price: '$50' }
      ],
      confidence: 0.78
    }
  ];
}

// Generate local recommendations
async function generateLocalRecommendations(preferences, favoritePlaces) {
  return [
    {
      type: 'local',
      title: 'New Restaurant Opening',
      description: 'Trendy Italian place near your favorite coffee shop',
      deals: [
        { name: 'Bella Vista', discount: '50% off first visit', price: '$30' }
      ],
      confidence: 0.92
    },
    {
      type: 'local',
      title: 'Weekend Activities',
      description: 'Based on your entertainment preferences',
      deals: [
        { name: 'Local Art Gallery', discount: 'Free admission', price: '$0' },
        { name: 'Bowling Alley', discount: '2-for-1 games', price: '$8' }
      ],
      confidence: 0.67
    }
  ];
}

// Generate general recommendations
async function generateGeneralRecommendations(preferences, favoritePlaces) {
  return [
    {
      type: 'general',
      title: 'Personalized Shopping Deals',
      description: 'Deals at stores you frequently visit',
      deals: [
        { name: 'Target', discount: '20% off electronics', price: 'Various' },
        { name: 'Home Depot', discount: '10% off tools', price: 'Various' }
      ],
      confidence: 0.88
    }
  ];
}

// Update agent preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { agentType, preferences } = req.body;
    
    // Check if agent exists
    const existing = await pool.query(
      'SELECT id FROM dwigo_agents WHERE user_id = $1 AND agent_type = $2',
      [req.user.userId, agentType]
    );
    
    let result;
    if (existing.rows.length > 0) {
      // Update existing agent
      result = await pool.query(
        'UPDATE dwigo_agents SET preferences = $1, updated_at = NOW() WHERE user_id = $2 AND agent_type = $3 RETURNING *',
        [preferences, req.user.userId, agentType]
      );
    } else {
      // Create new agent
      result = await pool.query(
        'INSERT INTO dwigo_agents (user_id, agent_type, preferences) VALUES ($1, $2, $3) RETURNING *',
        [req.user.userId, agentType, preferences]
      );
    }
    
    res.json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Update agent preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
