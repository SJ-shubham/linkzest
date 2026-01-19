require('dotenv').config();

const config = {
  // Server settings
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database settings
  dbUrl: process.env.DB_URL || ' mongodb://127.0.0.1:27017/short-url',
  
  // JWT secrets
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key-should-be-long-and-secure',
  accessSecret: process.env.ACCESS_TOKEN_SECRET || 'access-secret-key-should-be-long-and-secure',
  
};

module.exports = config;

/* The config folder’s main purpose is to centralize environment variables and other
configuration settings so your app can access them cleanly and consistently from one place.*/