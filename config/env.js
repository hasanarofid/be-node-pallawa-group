// Environment Configuration Manager
const path = require('path');

// Load environment variables from .env file if exists
require('dotenv').config();

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
let envConfig;
if (NODE_ENV === 'production') {
  envConfig = require('./env.production');
} else {
  envConfig = require('./env.local');
}

// Merge with process.env (environment variables take precedence)
const config = {
  ...envConfig,
  ...process.env
};

// Export configuration
module.exports = config;
