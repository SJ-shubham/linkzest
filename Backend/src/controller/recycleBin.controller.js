const URL = require("../models/url.model");
const Folder = require("../models/folder.model");

/**
 * List all deleted URLs and folders
 * @route GET /api/recycle-bin
 */
const handleListRecycleBinItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build response based on type filter
    let deletedUrls = [];
    let deletedFolders = [];
    let urlCount = 0;
    let folderCount = 0;

    // Fetch deleted URLs
    if (!type || type === "url") {
      const urlQuery = { createdBy: userId, isDeleted: true };

      [deletedUrls, urlCount] = await Promise.all([
        URL.find(urlQuery)
          .select("-__v")
          .sort({ deletedAt: -1 })
          .skip(type === "url" ? skip : 0)
          .limit(type === "url" ? limitNum : 10),
        URL.countDocuments(urlQuery),
      ]);
    }

    // Fetch deleted Folders
    if (!type || type === "folder") {
      const folderQuery = { createdBy: userId, isDeleted: true };

      [deletedFolders, folderCount] = await Promise.all([
        Folder.find(folderQuery)
          .select("-__v")
          .sort({ deletedAt: -1 })
          .skip(type === "folder" ? skip : 0)
          .limit(type === "folder" ? limitNum : 10),
        Folder.countDocuments(folderQuery),
      ]);
    }

    // Generate short URLs
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    // Format URLs
    const formattedUrls = deletedUrls.map((url) => ({
      id: url._id,
      type: "url",
      shortId: url.shortId,
      title: url.title,
      redirectURL: url.redirectURL,
      shortUrl: `${appBaseUrl}/r/${url.shortId}`,
      deletedAt: url.deletedAt,
      createdAt: url.createdAt,
    }));

    // Format Folders
    const formattedFolders = deletedFolders.map((folder) => ({
      id: folder._id,
      type: "folder",
      name: folder.name,
      description: folder.description,
      deletedAt: folder.deletedAt,
      createdAt: folder.createdAt,
    }));

    // Combine and sort by deletedAt if no type filter
    let items = [];
    if (!type) {
      items = [...formattedUrls, ...formattedFolders].sort(
        (a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)
      );
    } else if (type === "url") {
      items = formattedUrls;
    } else if (type === "folder") {
      items = formattedFolders;
    }

    // Calculate pagination
    const totalCount = type === "url" ? urlCount : type === "folder" ? folderCount : urlCount + folderCount;
    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Recycle bin items fetched successfully",
      data: {
        items,
        summary: {
          totalUrls: urlCount,
          totalFolders: folderCount,
          total: urlCount + folderCount,
        },
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("List Recycle Bin Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Restore a deleted URL or folder
 * @route PATCH /api/recycle-bin/restore
 */
const handleRestoreItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId, itemType } = req.body;

    // Validate input
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    if (!itemType || !["url", "folder"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: "Item type must be 'url' or 'folder'",
      });
    }

    // Validate ObjectId format
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format",
      });
    }

    if (itemType === "url") {
      // Find deleted URL
      const urlDoc = await URL.findOne({
        _id: itemId,
        createdBy: userId,
        isDeleted: true,
      });

      if (!urlDoc) {
        return res.status(404).json({
          success: false,
          message: "URL not found in recycle bin",
        });
      }

      // Restore URL
      urlDoc.isDeleted = false;
      urlDoc.deletedAt = null;
      await urlDoc.save();

      const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

      return res.status(200).json({
        success: true,
        message: "URL restored successfully",
        data: {
          id: urlDoc._id,
          type: "url",
          shortId: urlDoc.shortId,
          title: urlDoc.title,
          shortUrl: `${appBaseUrl}/r/${urlDoc.shortId}`,
        },
      });
    } else if (itemType === "folder") {
      // Find deleted folder
      const folderDoc = await Folder.findOne({
        _id: itemId,
        createdBy: userId,
        isDeleted: true,
      });

      if (!folderDoc) {
        return res.status(404).json({
          success: false,
          message: "Folder not found in recycle bin",
        });
      }

      // Check for name conflict with active folders
      const existing = await Folder.findOne({
        name: { $regex: new RegExp(`^${folderDoc.name}$`, "i") },
        createdBy: userId,
        _id: { $ne: itemId },
        isDeleted: false,
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "A folder with this name already exists. Please rename it before restoring.",
        });
      }

      // Restore folder
      folderDoc.isDeleted = false;
      folderDoc.deletedAt = null;
      await folderDoc.save();

      return res.status(200).json({
        success: true,
        message: "Folder restored successfully",
        data: {
          id: folderDoc._id,
          type: "folder",
          name: folderDoc.name,
          description: folderDoc.description,
        },
      });
    }
  } catch (error) {
    console.error("Restore Item Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Permanently delete a URL or folder
 * @route DELETE /api/recycle-bin/permanent
 */
const handlePermanentDeleteItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId, itemType } = req.body;

    // Validate input
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    if (!itemType || !["url", "folder"].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: "Item type must be 'url' or 'folder'",
      });
    }

    // Validate ObjectId format
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format",
      });
    }

    if (itemType === "url") {
      // Find deleted URL
      const urlDoc = await URL.findOne({
        _id: itemId,
        createdBy: userId,
        isDeleted: true,
      });

      if (!urlDoc) {
        return res.status(404).json({
          success: false,
          message: "URL not found in recycle bin",
        });
      }

      // Permanently delete URL
      await URL.deleteOne({ _id: urlDoc._id });

      return res.status(200).json({
        success: true,
        message: "URL permanently deleted",
      });
    } else if (itemType === "folder") {
      // Find deleted folder
      const folderDoc = await Folder.findOne({
        _id: itemId,
        createdBy: userId,
        isDeleted: true,
      });

      if (!folderDoc) {
        return res.status(404).json({
          success: false,
          message: "Folder not found in recycle bin",
        });
      }

      // Permanently delete folder
      await Folder.deleteOne({ _id: folderDoc._id });

      return res.status(200).json({
        success: true,
        message: "Folder permanently deleted",
      });
    }
  } catch (error) {
    console.error("Permanent Delete Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  handleListRecycleBinItems,
  handleRestoreItem,
  handlePermanentDeleteItem,
};
