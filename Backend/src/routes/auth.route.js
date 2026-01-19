const express = require('express');
const router = express.Router();
const { handleUserSignUp, handleUserLogin, handleUserLogout } = require('../controller/auth.controller');


router.post('/signup',handleUserSignUp);

router.post('/',handleUserLogin);

// Logout
router.get('/', handleUserLogout);

module.exports = router;