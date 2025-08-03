const express = require('express');
const {handleAdminPanel}=require('../controller/admin.controller.js');
const {checkAuth,checkRole}=require('../middlewares/auth.middleware.js');

const adminRoutes = express.Router();

adminRoutes.get('/dashboard', checkAuth, checkRole('admin'), handleAdminPanel);

module.exports={
  adminRoutes,
}