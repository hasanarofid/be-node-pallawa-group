// Environment Configuration untuk Local Development
module.exports = {
  NODE_ENV: 'development',
  
  // Database Configuration Local
  DB_HOST: 'localhost',
  DB_USER: 'root',
  DB_PASSWORD: 'hasanitki',
  DB_NAME: 'db_api_pallawa',
  
  // JWT Configuration
  JWT_SECRET: 'pallawa_group_jwt_secret_key_2024_local_development',
  JWT_EXPIRES_IN: '7d',
  
  // Google OAuth Configuration (Local)
  GOOGLE_CLIENT_ID: 'your_google_client_id_local',
  GOOGLE_CLIENT_SECRET: 'your_google_client_secret_local',
  
  // Server Configuration Local
  PORT: 3000,
  BASE_URL: 'http://localhost:3000',
  
  // Email Configuration (untuk notifikasi)
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: 587,
  EMAIL_USER: 'your_email@gmail.com',
  EMAIL_PASS: 'your_app_password',
  
  // CORS Configuration Local
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001,http://localhost:8080,http://127.0.0.1:3000'
};
