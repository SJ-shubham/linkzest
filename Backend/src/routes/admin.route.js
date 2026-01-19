const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin.controller');

// Dashboard
router.get('/dashboard', adminController.handleAdminDashboard);
router.get('/stats', adminController.handleSystemStats);

// User management
router.get('/users', adminController.handleListUsers);
router.get('/users/:userId', adminController.handleGetUserDetails);
router.patch('/users/:userId', adminController.handleUpdateUser);

// URL management
router.get('/urls', adminController.handleListUrls);
router.get('/urls/:urlId', adminController.handleGetUrlDetails);
router.patch('/urls/:urlId', adminController.handleUpdateUrl);

module.exports = router;