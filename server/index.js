const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for React
}));

// CORS configuration - must be before routes
const getCorsOrigin = () => {
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:5173';
  }
  
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    console.warn('⚠️  CORS_ORIGIN not set, allowing all origins');
    return true;
  }
  
  const origins = corsOrigin.split(',').map(o => o.trim()).filter(o => o.length > 0);
  console.log('✅ CORS allowed origins:', origins);
  return origins.length > 0 ? origins : true;
};

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/merchants', require('./routes/merchants'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/preferences', require('./routes/preferences'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/location', require('./routes/location'));
app.use('/api/flags', require('./routes/flags'));
app.use('/api/ingestion', require('./routes/ingestion'));
app.use('/api/admin/ingestion', require('./routes/admin/ingestionReview'));
app.use('/api/admin/ai', require('./routes/admin/aiDealFetching'));
app.use('/api/events', require('./routes/events'));

if (process.env.ENABLE_SCHEDULER === 'true') {
  const { startScheduledJobs } = require('./jobs/scheduler');
  startScheduledJobs();
}

// Health check endpoints - comprehensive system status
// /api/health - Full detailed health check
// /health - Simple health check for load balancers (returns 200 if healthy, 503 if unhealthy)
const performHealthCheck = async () => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: { status: 'unknown', message: '' },
      redis: { status: 'unknown', message: '' },
      configuration: { status: 'unknown', message: '', details: {} },
    },
  };

  // Check database connectivity
  try {
    const pool = require('./config/database');
    const startTime = Date.now();
    await pool.query('SELECT 1 as health_check');
    const responseTime = Date.now() - startTime;
    
    health.checks.database = {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: `${responseTime}ms`,
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = {
      status: 'unhealthy',
      message: `Database connection failed: ${error.message}`,
      error: error.code || 'UNKNOWN',
    };
  }

  // Check Redis connectivity (optional - not required for core functionality)
  try {
    const redis = require('./config/redis');
    if (redis && redis.connection) {
      const startTime = Date.now();
      const result = await redis.connection.ping();
      const responseTime = Date.now() - startTime;
      
      if (result === 'PONG') {
        health.checks.redis = {
          status: 'healthy',
          message: 'Redis connection successful',
          responseTime: `${responseTime}ms`,
        };
      } else {
        health.checks.redis = {
          status: 'unavailable',
          message: 'Redis ping returned unexpected result',
        };
      }
    } else {
      health.checks.redis = {
        status: 'not_configured',
        message: 'Redis not configured (optional)',
      };
    }
  } catch (error) {
    // Redis is optional, so don't mark overall health as degraded
    health.checks.redis = {
      status: 'unavailable',
      message: `Redis connection failed: ${error.message}`,
      note: 'Redis is optional and does not affect core functionality',
    };
  }

  // Check critical configuration
  const configStatus = {
    database: !!process.env.DATABASE_URL,
    jwtSecret: !!process.env.JWT_SECRET,
    adminToken: !!process.env.ADMIN_API_TOKEN,
    openaiKey: !!process.env.OPENAI_API_KEY,
    googlePlacesKey: !!process.env.GOOGLE_PLACES_API_KEY,
  };

  const missingCritical = [];
  if (!configStatus.database) missingCritical.push('DATABASE_URL');
  if (!configStatus.jwtSecret) missingCritical.push('JWT_SECRET');
  if (!configStatus.adminToken) missingCritical.push('ADMIN_API_TOKEN');

  if (missingCritical.length > 0) {
    health.status = 'unhealthy';
    health.checks.configuration = {
      status: 'unhealthy',
      message: `Missing critical configuration: ${missingCritical.join(', ')}`,
      details: configStatus,
    };
  } else {
    health.checks.configuration = {
      status: 'healthy',
      message: 'All critical configuration present',
      details: {
        ...configStatus,
        // Don't expose actual keys, just whether they're set
        openaiKey: configStatus.openaiKey ? 'configured' : 'not configured',
        googlePlacesKey: configStatus.googlePlacesKey ? 'configured' : 'not configured',
      },
    };
  }

  // Determine overall status
  const hasUnhealthy = Object.values(health.checks).some(
    check => check.status === 'unhealthy'
  );
  const hasDegraded = Object.values(health.checks).some(
    check => check.status === 'unavailable' || check.status === 'unhealthy'
  );

  if (hasUnhealthy) {
    health.status = 'unhealthy';
  } else if (hasDegraded) {
    health.status = 'degraded';
  }

  // Return appropriate HTTP status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  return { health, statusCode };
};

// Full health check endpoint
app.get('/api/health', async (req, res) => {
  const { health, statusCode } = await performHealthCheck();
  res.status(statusCode).json(health);
});

// Simple health check for load balancers and monitoring
app.get('/health', async (req, res) => {
  const { health, statusCode } = await performHealthCheck();
  
  // For simple health checks, just return status
  if (req.query.detailed === 'true') {
    res.status(statusCode).json(health);
  } else {
    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Note: Frontend is served by Vercel, not from this server
// All non-API routes should return 404
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Verify Playwright browsers on startup (if Playwright is used)
if (process.env.NODE_ENV === 'production') {
  try {
    const playwright = require('playwright');
    // Try to check if browsers are installed by attempting to get executable path
    playwright.chromium.executablePath().then((path) => {
      if (path) {
        console.log(`[Playwright] Chromium found at: ${path}`);
      }
    }).catch((err) => {
      console.warn('[Playwright] Browser verification failed - browsers may not be installed:', err.message);
      console.warn('[Playwright] This is OK for staticHtml sources, but renderedHtml sources will fail');
    });
  } catch (error) {
    // Playwright not installed - that's fine
  }
}

app.listen(PORT, () => {
  console.log(`DWIGO Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving production build from client/dist');
  }
});
