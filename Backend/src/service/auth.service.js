const config = require('../config/index');
const jwt = require("jsonwebtoken");

// Get secrets from config
const accessSecret = config.accessSecret;
const refreshSecret = config.refreshSecret;

/**
 * Generate a short-lived access token
 * @param {Object} user - User object from database
 * @returns {String} JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role || 'user',
    },
    accessSecret,
    { 
      expiresIn: "15m",
    }
  );
};

/**
 * Generate a long-lived refresh token
 * @param {Object} user - User object from database
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role || 'user',
    },
    refreshSecret,
    { 
      expiresIn: "7d",
    }
  );
};

/**
 * Verify an access token
 * @param {String} token - JWT access token to verify
 * @returns {Object} Object with valid flag and payload or error
 */
const verifyAccessToken = (token) => {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }
  
  try {
    const payload = jwt.verify(token, accessSecret, {
    });
    
    return { valid: true, payload };
  } catch (error) {
    console.error('Token verification error:', error.name);
    return { valid: false, error: error.message };
  }
};

/**
 * Verify a refresh token
 * @param {String} token - JWT refresh token to verify
 * @returns {Object} Object with valid flag and payload or error
 */
const verifyRefreshToken = (token) => {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }
  
  try {
    const payload = jwt.verify(token, refreshSecret, {
    });
    
    return { valid: true, payload };
  } catch (error) {
    console.error('Refresh token verification error:', error.name);
    return { valid: false, error: error.message };
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};