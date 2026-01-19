const express=require('express');
const {handleExportUrlAnalytics,handleGetUrlAnalytics} = require('../controller/analyticsUrl.controller');
const analyticsRouter=express.Router();

analyticsRouter.get('/:shortId', handleGetUrlAnalytics);    // Get analytics for a specific URL (visits, trends, geo, device, referrer)

analyticsRouter.get('/:shortId/export', handleExportUrlAnalytics);    // Export analytics for a specific URL (CSV/Excel)

module.exports=analyticsRouter;