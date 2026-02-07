const { verifyAccessToken } = require("../service/auth.service");
const User = require("../models/users.model");

/**
 * Authentication middleware to verify user access tokens
 * Sets req.user with user payload from token if valid
 */
const checkAuth = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    const accessToken =
      req.cookies?.accessToken ||
      req.headers["authorization"]?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Verify token
    const { valid, payload, error } = verifyAccessToken(accessToken);

    if (!valid || !payload?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    // Fetch user from DB (exclude password)
    const user = await User.findById(payload.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request object
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {String|Array} roles - Single role or array of allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Convert single role to array for consistent handling
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

module.exports = {
  checkAuth,
  checkRole,
};