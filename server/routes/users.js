const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const buildEnvelope = ({ data, error = null, meta = {} }) => ({
  data,
  error,
  meta: { recommended_by: 'profiles-service', ...meta },
});

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        email,
        first_name AS "firstName",
        last_name AS "lastName",
        phone,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          buildEnvelope({
            data: null,
            error: { message: 'User not found', code: 'NOT_FOUND' },
          })
        );
    }

    res.json(buildEnvelope({ data: result.rows[0] }));
  } catch (error) {
    console.error('Get user profile error:', error);
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

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const result = await pool.query(
      `UPDATE users
        SET first_name = $1,
            last_name = $2,
            phone = $3,
            updated_at = NOW()
      WHERE id = $4
      RETURNING 
        id,
        email,
        first_name AS "firstName",
        last_name AS "lastName",
        phone,
        created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      [firstName, lastName, phone, req.user.userId]
    );

    res.json(buildEnvelope({ data: result.rows[0] }));
  } catch (error) {
    console.error('Update user profile error:', error);
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
