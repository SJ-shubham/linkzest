const config = require('../config/index');
const jwt = require("jsonwebtoken");

const accessSecret = config.accessSecret;
const refreshSecret = config.refreshSecret;

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    accessSecret,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    refreshSecret,
    { expiresIn: "7d" }
  );
};

const verifyAccessToken = (token) => {
  try {
    return { valid: true, payload: jwt.verify(token, accessSecret) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};


const verifyRefreshToken = (token) => {
  if (!token) return null;
  try {
    return { valid: true, payload: jwt.verify(token, refreshSecret)};
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
