const express = require('express');
const urlRouter = express.Router();
const { 
  handleGenerateNewShortURL,
  handleListUserUrls,
  handleEditUrl,
  handleUrlStatus,
  handleDeleteUrl
} = require('../controller/url.controller');

// Create a new short URL (custom/random)
urlRouter.post('/',handleGenerateNewShortURL);

// List all URLs created by the logged-in user
urlRouter.get('/',handleListUserUrls);

// Edit URL (destination, custom shortId, expiration, folder assignment)
urlRouter.patch('/:shortId/edit',handleEditUrl);

// Update URL status (activate/deactivate)
urlRouter.patch('/:shortId/status',handleUrlStatus);

// Move URL to trash or delete permanently
urlRouter.delete('/:shortId', handleDeleteUrl);

module.exports=urlRouter;