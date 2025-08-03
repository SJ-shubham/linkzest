const { verifyAccessToken } = require("../service/auth.service");

const checkAuth = (req, res, next) => {
  const accessToken = req.cookies?.accessToken;

  if (!accessToken) {
    return res.status(401).json({ error: "Unauthorized: No access token provided" });
  }

  const { valid, payload } = verifyAccessToken(accessToken);

  if (!valid) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired access token" });
  }

  req.user = payload;
  next();
};

// Role-check stays the same
const checkRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
};

module.exports = {
  checkAuth,
  checkRole,
};