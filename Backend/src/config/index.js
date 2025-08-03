require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DB_URL || 'mongodb://127.0.0.1:27017/short-url',
  refreshSecret:process.env.refreshSecret,
  accessSecret:process.env.accessSecret
};

module.exports = config;

/* The config folder’s main purpose is to centralize environment variables and other
configuration settings so your app can access them cleanly and consistently from one place.*/