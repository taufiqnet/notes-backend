const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const errorHandler = require('./middleware/error');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS Configuration
const rawClientUrls = process.env.CLIENT_URL || '';
const allowedOrigins = rawClientUrls
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests with no origin
    if (!origin) {
      return callback(null, true);
    }

    // Allow wildcard or empty configuration
    if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Allow explicit matching origin from CLIENT_URL
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Automatically allow Vercel deployments (e.g. notes-frontend-*.vercel.app)
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Blocked by CORS policy: origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting on auth routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

// Root welcome endpoints (so visiting the root URL in a browser doesn't show 404)
const rootHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Secure Note-Taking API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      notes: '/api/notes',
      users: '/api/users',
      posts: '/api/posts',
    },
  });
};
app.get('/', rootHandler);
app.get('/api', rootHandler);

// Health check endpoint (accessible via /api/health and /health)
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// API Routes mounted on /api/* (and /* fallback for serverless rewrites)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/auth', authLimiter, authRoutes);

app.use('/api/notes', noteRoutes);
app.use('/notes', noteRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/posts', postRoutes);
app.use('/posts', postRoutes);

// Catch-all 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
