const express = require("express");
const router = express.Router();
const {
  handleGetProfile,
  handleUpdateProfile,
  handleChangePassword,
  handleDeleteAccount,
} = require("../controller/user.controller");

// GET /api/user/profile - Get user profile
router.get("/profile", handleGetProfile);

// PATCH /api/user/profile - Update user profile
router.patch("/profile", handleUpdateProfile);

// PATCH /api/user/change-password - Change user password
router.patch("/change-password", handleChangePassword);

// DELETE /api/user/delete-account - Delete user account
router.delete("/delete-account", handleDeleteAccount);

module.exports = router;