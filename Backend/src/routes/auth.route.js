const express = require('express');
const router = express.Router();
const { handleUserSignUp, handleUserLogin, handleUserLogout } = require('../controller/auth.controller');

// Sign up
router.post('/signup', handleUserSignUp);

// Login
router.post('/', handleUserLogin);

// Logout
router.get('/', handleUserLogout);

//refresh token
// router.get("/refresh-access",handleRefreshAccessToken);

module.exports = router;
