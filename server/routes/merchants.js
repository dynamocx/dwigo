const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Merchant registration
router.post('/register', async (req, res) => {
  try {
    const {
      businessName,
      email,
      password,
      contactName,
      phone,
      address,
      city,
      state,
      zipCode,
      businessType,
      description,
      website
    } = req.body;
    
    // Check if merchant exists
    const existingMerchant = await pool.query(
      'SELECT id FROM merchants WHERE email = $1',
      [email]
    );
    
    if (existingMerchant.rows.length > 0) {
      return res.status(400).json({ error: 'Merchant already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create merchant
    const result = await pool.query(
      `INSERT INTO merchants (
        business_name, email, password_hash, contact_name, phone,
        address, city, state, zip_code, business_type, description, website
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING id, business_name, email, contact_name`,
      [
        businessName, email, hashedPassword, contactName, phone,
        address, city, state, zipCode, businessType, description, website
      ]
    );
    
    const merchant = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { merchantId: merchant.id, email: merchant.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Merchant registered successfully',
      token,
      merchant: {
        id: merchant.id,
        businessName: merchant.business_name,
        email: merchant.email,
        contactName: merchant.contact_name
      }
    });
  } catch (error) {
    console.error('Merchant registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Merchant login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find merchant
    const result = await pool.query(
      'SELECT id, email, password_hash, business_name, contact_name FROM merchants WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const merchant = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, merchant.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { merchantId: merchant.id, email: merchant.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      merchant: {
        id: merchant.id,
        businessName: merchant.business_name,
        email: merchant.email,
        contactName: merchant.contact_name
      }
    });
  } catch (error) {
    console.error('Merchant login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM merchants WHERE id = $1',
      [req.user.merchantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    const merchant = result.rows[0];
    res.json({ merchant });
  } catch (error) {
    console.error('Get merchant profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update merchant profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      businessName,
      contactName,
      phone,
      address,
      city,
      state,
      zipCode,
      businessType,
      description,
      website
    } = req.body;
    
    const result = await pool.query(
      `UPDATE merchants SET 
        business_name = $1, contact_name = $2, phone = $3,
        address = $4, city = $5, state = $6, zip_code = $7,
        business_type = $8, description = $9, website = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *`,
      [
        businessName, contactName, phone, address, city, state,
        zipCode, businessType, description, website, req.user.merchantId
      ]
    );
    
    res.json({ merchant: result.rows[0] });
  } catch (error) {
    console.error('Update merchant profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
