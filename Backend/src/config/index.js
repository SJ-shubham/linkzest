require('dotenv').config();

require('dotenv').config();

console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET);
console.log('REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET);

const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DB_URL || 'mongodb://127.0.0.1:27017/short-url',
  refreshSecret: process.env.REFRESH_TOKEN_SECRET,
  accessSecret: process.env.ACCESS_TOKEN_SECRET
};

module.exports = config;

/* The config folder’s main purpose is to centralize environment variables and other
configuration settings so your app can access them cleanly and consistently from one place.*/