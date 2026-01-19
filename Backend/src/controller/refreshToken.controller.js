const { verifyRefreshToken, generateAccessToken } = require("../service/auth.service");
const User = require("../models/users.model");

/**
 * Refresh access token handler
 * @route GET /api/refresh-access
 */
const handleRefreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        message: "Refresh token is required" 
      });
    }

    // Verify the refresh token
    const { valid, payload } = verifyRefreshToken(refreshToken);

    if (!valid || !payload) {
      // Clear invalid cookies
      res.clearCookie("accessToken", { 
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      
      res.clearCookie("refreshToken", {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      
      return res.status(401).json({ 
        success: false,
        message: "Invalid or expired refresh token" 
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(payload.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User no longer exists" 
      });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: "Account is inactive" 
      });
    }

    // Generate a new access token
    const newAccessToken = generateAccessToken(user);

    // Set the new access token as a cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

module.exports = { handleRefreshToken };