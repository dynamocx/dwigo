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
// CORS configuration
const resolveCorsOrigins = () => {
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:5173'];
  }

  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    console.warn('CORS_ORIGIN not set, allowing all origins');
    return true;
  }

  const origins = corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  console.log('CORS allowed origins:', origins);
  return origins.length > 0 ? origins : true;
};

const allowedOrigins = resolveCorsOrigins();
const isOriginAllowed = (origin) => {
  if (!origin) return false;
  if (allowedOrigins === true) return true;
  return allowedOrigins.includes(origin);
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

  if (req.method === 'OPTIONS') {
    if (!origin || isOriginAllowed(origin)) {
      return res.sendStatus(204);
    }
    console.warn(`CORS preflight blocked origin: ${origin}`);
    return res.sendStatus(403);
  }

  next();
});

app.use(cors({
  origin: allowedOrigins,
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
app.use('/api/events', require('./routes/events'));

if (process.env.ENABLE_SCHEDULER === 'true') {
  const { startScheduledJobs } = require('./jobs/scheduler');
  startScheduledJobs();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware (before static files)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Serve static files from React app in production (after API routes)
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`DWIGO Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('Serving production build from client/dist');
  }
});
