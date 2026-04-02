const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(6).max(128).required(),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  phone: Joi.string().max(20).allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const RESET_TOKEN_EXPIRY_HOURS = 1;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173';

// Register user
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    }
    const { email, password, firstName, lastName, phone } = value;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, phone, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email, first_name, last_name',
      [email, hashedPassword, firstName, lastName, phone]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details.map((d) => d.message).join('; ') });
    }
    const { email, password } = value;

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password: create reset token and "send" link (logs in dev; production would send email)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    // Always return same message so we don't reveal whether the email exists
    const message = 'If an account exists with this email, you will receive a password reset link.';

    if (userResult.rows.length === 0) {
      return res.json({ message });
    }

    const userId = userResult.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    const resetLink = `${FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[forgot-password] Reset link (dev only):', resetLink);
    }
    // TODO: send email with resetLink in production (e.g. SendGrid, Resend)
    return res.json({ message });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password: validate token and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenResult = await pool.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
      [token.trim()]
    );
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Request a new one.' });
    }

    const { user_id: userId } = tokenResult.rows[0];
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      hashedPassword,
      userId,
    ]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    return res.json({ message: 'Password updated. You can sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
