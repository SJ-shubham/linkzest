const { verifyAccessToken } = require("../service/auth.service");
const User = require("../models/users.model");

/**
 * Authentication middleware to verify user access tokens
 * Sets req.user with user payload from token if valid
 */
const checkAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return res.status(401).json({ 
        success: false,
        message: "Authentication required" 
      });
    }

    const { valid, payload } = verifyAccessToken(accessToken);

    if (!valid || !payload) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid or expired session" 
      });
    }

    // Set user object on request
    req.user = payload;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Authentication error" 
    });
  }
};


const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Authentication required" 
      });
    }
    
    if (!acceptableRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: "Insufficient permissions" 
      });
    }
    
    next();
  };
};

module.exports = {
  checkAuth,
  checkRole,
};