const express = require('express');
const urlRouter = express.Router();
const {
  handleCreateShortURL,
  handleListUserUrls,
  handleEditUrl,
  handleToggleUrlStatus,
  handleSoftDeleteUrl,
  handleRestoreUrl,
  handlePermanentDeleteUrl,
} = require('../controller/url.controller');

// POST /api/url - Create a new short URL
urlRouter.post('/', handleCreateShortURL);

// GET /api/url - List all URLs (with pagination, search, filters)
urlRouter.get('/', handleListUserUrls);

// PATCH /api/url/:shortId/edit - Edit URL details
urlRouter.patch('/:shortId/edit', handleEditUrl);

// PATCH /api/url/:shortId/status - Toggle URL active/inactive status
urlRouter.patch('/:shortId/status', handleToggleUrlStatus);

// DELETE /api/url/:shortId - Soft delete (move to recycle bin)
urlRouter.delete('/:shortId', handleSoftDeleteUrl);

// PATCH /api/url/:shortId/restore - Restore URL from recycle bin
urlRouter.patch('/:shortId/restore', handleRestoreUrl);

// DELETE /api/url/:shortId/permanent - Permanently delete URL
urlRouter.delete('/:shortId/permanent', handlePermanentDeleteUrl);

module.exports = urlRouter;