const express = require("express");
const recycleBinRouter = express.Router();
const {
  handleListRecycleBinItems,
  handleRestoreItem,
  handlePermanentDeleteItem,
} = require("../controller/recycleBin.controller");

// GET /api/recycle-bin - List all deleted URLs and folders
recycleBinRouter.get("/", handleListRecycleBinItems);

// PATCH /api/recycle-bin/restore - Restore a deleted URL or folder
recycleBinRouter.patch("/restore", handleRestoreItem);

// DELETE /api/recycle-bin/permanent - Permanently delete a URL or folder
recycleBinRouter.delete("/permanent", handlePermanentDeleteItem);

module.exports = recycleBinRouter;
