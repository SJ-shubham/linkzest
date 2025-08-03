const express = require("express");
const router = express.Router();
const { verifyRefreshToken, generateAccessToken } = require("../service/auth.service");

router.get("/refresh-access", (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token missing" });
  }

  const { valid, payload } = verifyRefreshToken(refreshToken);

  if (!valid) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const newAccessToken = generateAccessToken(payload);

  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // 15 minutes
    // secure: true, // enable in production
    // sameSite: "lax",
  });

  res.json({ message: "Access token refreshed" });
});

module.exports = router;
