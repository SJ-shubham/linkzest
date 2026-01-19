const express=require('express');
const folderRouter=express.Router();
const {
    handleCreateFolder,
    handleEditFolder,
    handleDeleteFolder,
    handleListFolders,
    handleGetFolderDetails}=require('../controller/folderUrl.controller');

folderRouter.post('/', handleCreateFolder);    // Create a new folder/campaign

folderRouter.get('/', handleListFolders);    // List all folders for the logged-in user

folderRouter.get('/:folderId', handleGetFolderDetails);    // Get details of one folder + URLs inside it

folderRouter.patch('/:folderId', handleEditFolder);    // Edit folder (rename, description, etc.)

folderRouter.delete('/:folderId', handleDeleteFolder);    // Delete a folder (optionally move URLs to trash or orphan them)

module.exports=folderRouter;
