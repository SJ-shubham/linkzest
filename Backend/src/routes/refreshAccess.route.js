const express = require("express");
const router = express.Router();
const { handleRefreshToken } = require("../controller/refreshToken.controller");

// GET /api/refresh - Refresh access token
router.get("/", handleRefreshToken);

module.exports = router;