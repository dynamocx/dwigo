const { Pool } = require('pg');

// Support both DATABASE_URL (cloud) and individual connection params (local)
let poolConfig;
if (process.env.DATABASE_URL) {
  // Cloud deployment (Render, Heroku, etc.) - always requires SSL for external connections
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL external connections
  };
} else {
  // Local development
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dwigo',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  };
}

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = pool;
