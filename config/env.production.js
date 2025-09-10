// Environment Configuration untuk Production
module.exports = {
  NODE_ENV: 'production',
  
  // Database Configuration Production
  DB_HOST: 'localhost', // atau IP server database production
  DB_USER: 'solz1468_solkit',
  DB_PASSWORD: 'DemiAllah@1',
  DB_NAME: 'solz1468_api',
  
  // JWT Configuration
  JWT_SECRET: 'pallawa_group_jwt_secret_key_2024_production_secure_key',
  JWT_EXPIRES_IN: '7d',
  
  // Google OAuth Configuration (Production)
  GOOGLE_CLIENT_ID: 'your_google_client_id_production',
  GOOGLE_CLIENT_SECRET: 'your_google_client_secret_production',
  
  // Server Configuration Production
  PORT: 3000,
  BASE_URL: 'http://api.solusicodekata.com',
  
  // Email Configuration (untuk notifikasi)
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: 587,
  EMAIL_USER: 'your_email@gmail.com',
  EMAIL_PASS: 'your_app_password',
  
  // CORS Configuration Production
  CORS_ORIGINS: 'http://api.solusicodekata.com,https://api.solusicodekata.com,https://solusicodekata.com'
};
