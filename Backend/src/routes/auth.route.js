const express = require('express');
const router = express.Router();
const { handleUserSignUp, handleUserLogin, handleUserLogout } = require('../controller/auth.controller');

// POST /api/auth/signup - Register new user
router.post('/signup', handleUserSignUp);

// POST /api/auth/login - Login user
router.post('/login', handleUserLogin);

// GET /api/auth/logout - Logout user
router.get('/logout', handleUserLogout);

module.exports = router;