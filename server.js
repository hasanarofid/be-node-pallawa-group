const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const mitraRoutes = require('./routes/mitra');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = config.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Terlalu banyak request, coba lagi nanti'
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? config.CORS_ORIGINS.split(',')
    : config.CORS_ORIGINS.split(','),
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server berjalan dengan baik',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV || 'development',
    base_url: config.BASE_URL
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/mitra', mitraRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token telah expired'
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Data tidak valid',
      errors: err.errors
    });
  }
  
  // MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'Data sudah ada'
    });
  }
  
  // Default error
  res.status(500).json({
    success: false,
    message: config.NODE_ENV === 'production' 
      ? 'Terjadi kesalahan server' 
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`📊 Environment: ${config.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: ${config.BASE_URL}/health`);
  console.log(`📚 API Base URL: ${config.BASE_URL}/api`);
  console.log(`🗄️  Database: ${config.DB_NAME}@${config.DB_HOST}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
