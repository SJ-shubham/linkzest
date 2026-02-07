const express = require('express');
const folderRouter = express.Router();
const {
  handleCreateFolder,
  handleListFolders,
  handleGetFolderDetails,
  handleEditFolder,
  handleSoftDeleteFolder,
  handleRemoveUrlsFromFolder,
  handleRestoreFolder,
  handlePermanentDeleteFolder,
} = require('../controller/folderUrl.controller');

// POST /api/folder - Create a new folder
folderRouter.post('/', handleCreateFolder);

// GET /api/folder - List all folders for the logged-in user
folderRouter.get('/', handleListFolders);

// GET /api/folder/:folderId - Get folder details with URLs inside
folderRouter.get('/:folderId', handleGetFolderDetails);

// PATCH /api/folder/:folderId - Edit folder (name, description)
folderRouter.patch('/:folderId', handleEditFolder);

// DELETE /api/folder/:folderId - Soft delete folder (URLs become orphaned)
folderRouter.delete('/:folderId', handleSoftDeleteFolder);

// PATCH /api/folder/:folderId/remove-urls - Remove URLs from folder (bulk)
folderRouter.patch('/:folderId/remove-urls', handleRemoveUrlsFromFolder);

// PATCH /api/folder/:folderId/restore - Restore folder from recycle bin
folderRouter.patch('/:folderId/restore', handleRestoreFolder);

// DELETE /api/folder/:folderId/permanent - Permanently delete folder
folderRouter.delete('/:folderId/permanent', handlePermanentDeleteFolder);

module.exports = folderRouter;