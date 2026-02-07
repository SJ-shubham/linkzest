const express = require('express');
const analyticsRouter = express.Router();
const {
  handleGetUrlOverview,
  handleGetChartsData,
  handleGetVisitHistory,
} = require('../controller/analyticsUrl.controller');

// GET /api/analytics/:shortId/overview - High-level analytics overview
analyticsRouter.get('/:shortId/overview', handleGetUrlOverview);

// GET /api/analytics/:shortId/charts - Aggregated analytics for charts
analyticsRouter.get('/:shortId/charts', handleGetChartsData);

// GET /api/analytics/:shortId/visits - Paginated visit history
analyticsRouter.get('/:shortId/visits', handleGetVisitHistory);

module.exports = analyticsRouter;