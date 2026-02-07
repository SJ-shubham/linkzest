const Folder = require("../models/folder.model");
const URL = require("../models/url.model");

/**
 * Create a new folder
 * @route POST /api/folder
 */
const handleCreateFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    // Validate folder name
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Folder name must be 2-50 characters",
      });
    }

    // Check for duplicate folder name (case-insensitive)
    const existing = await Folder.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      createdBy: userId,
      isDeleted: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Folder with this name already exists",
      });
    }

    // Create folder
    const folder = await Folder.create({
      name: trimmedName,
      description: description?.trim() || "",
      createdBy: userId,
      isDeleted: false,
      deletedAt: null,
    });

    return res.status(201).json({
      success: true,
      message: "Folder created successfully",
      data: {
        id: folder._id,
        name: folder.name,
        description: folder.description,
        createdAt: folder.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Folder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * List all folders for the logged-in user
 * @route GET /api/folder
 */
const handleListFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search,
      startDate,
      endDate,
      showDeleted = false,
    } = req.query;

    // Build query
    const query = {
      createdBy: userId,
      isDeleted: showDeleted === "true",
    };

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Get folders
    const folders = await Folder.find(query)
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get URL counts for each folder
    const folderIds = folders.map((f) => f._id);
    const urlCounts = await URL.aggregate([
      {
        $match: {
          folderId: { $in: folderIds },
          createdBy: userId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$folderId",
          totalUrls: { $sum: 1 },
          activeUrls: {
            $sum: { $cond: ["$isActive", 1, 0] },
          },
        },
      },
    ]);

    // Create URL count map
    const urlCountMap = {};
    urlCounts.forEach((item) => {
      urlCountMap[item._id.toString()] = {
        totalUrls: item.totalUrls,
        activeUrls: item.activeUrls,
      };
    });

    // Add URL counts to folders
    const foldersWithCounts = folders.map((folder) => {
      const counts = urlCountMap[folder._id.toString()] || {
        totalUrls: 0,
        activeUrls: 0,
      };
      return {
        ...folder.toObject(),
        totalUrls: counts.totalUrls,
        activeUrls: counts.activeUrls,
      };
    });

    // Get total count for pagination
    const totalCount = await Folder.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Folders fetched successfully",
      data: foldersWithCounts,
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
    console.error("List Folders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get folder details with paginated URLs
 * @route GET /api/folder/:folderId
 */
const handleGetFolderDetails = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      search,
      status,
      startDate,
      endDate,
    } = req.query;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Find folder
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // Build URL query
    const urlQuery = {
      folderId: folderId,
      createdBy: userId,
      isDeleted: false,
    };

    // Search by title or shortId
    if (search) {
      urlQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortId: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by status
    if (status === "active") {
      urlQuery.isActive = true;
    } else if (status === "inactive") {
      urlQuery.isActive = false;
    }

    // Date range filter
    if (startDate || endDate) {
      urlQuery.createdAt = {};
      if (startDate) {
        urlQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        urlQuery.createdAt.$lte = end;
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Get URLs
    const [urls, totalUrlCount] = await Promise.all([
      URL.find(urlQuery)
        .select("-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      URL.countDocuments(urlQuery),
    ]);

    // Generate short URLs
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const urlsWithShortUrl = urls.map((url) => ({
      ...url.toObject(),
      shortUrl: `${appBaseUrl}/r/${url.shortId}`,
    }));

    const totalPages = Math.ceil(totalUrlCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Folder details fetched successfully",
      data: {
        folder: {
          id: folder._id,
          name: folder.name,
          description: folder.description,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        },
        urls: urlsWithShortUrl,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount: totalUrlCount,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get Folder Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Edit folder (name, description)
 * @route PATCH /api/folder/:folderId
 */
const handleEditFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;
    const { name, description } = req.body;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Check if at least one field is provided
    if (name === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field (name or description) is required",
      });
    }

    // Find folder
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // Update name if provided
    if (name !== undefined) {
      const trimmedName = name.trim();

      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Folder name must be 2-50 characters",
        });
      }

      // Check for duplicate (case-insensitive, excluding current folder)
      if (trimmedName.toLowerCase() !== folder.name.toLowerCase()) {
        const existing = await Folder.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
          createdBy: userId,
          _id: { $ne: folderId },
          isDeleted: false,
        });

        if (existing) {
          return res.status(409).json({
            success: false,
            message: "Folder with this name already exists",
          });
        }
      }

      folder.name = trimmedName;
    }

    // Update description if provided
    if (description !== undefined) {
      folder.description = description?.trim() || "";
    }

    await folder.save();

    return res.status(200).json({
      success: true,
      message: "Folder updated successfully",
      data: {
        id: folder._id,
        name: folder.name,
        description: folder.description,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
    });
  } catch (error) {
    console.error("Edit Folder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Soft delete folder (URLs become orphaned)
 * @route DELETE /api/folder/:folderId
 */
const handleSoftDeleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Find folder
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // Soft delete folder
    folder.isDeleted = true;
    folder.deletedAt = new Date();
    await folder.save();

    // Orphan URLs (set folderId to null)
    const result = await URL.updateMany(
      { folderId: folderId, createdBy: userId, isDeleted: false },
      { $set: { folderId: null } }
    );

    return res.status(200).json({
      success: true,
      message: "Folder moved to recycle bin",
      data: {
        orphanedUrls: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Soft Delete Folder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Remove URLs from folder (bulk)
 * @route PATCH /api/folder/:folderId/remove-urls
 */
const handleRemoveUrlsFromFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;
    const { urlIds } = req.body;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Validate urlIds
    if (!urlIds || !Array.isArray(urlIds) || urlIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "urlIds array is required",
      });
    }

    // Validate all urlIds are valid ObjectIds
    const invalidIds = urlIds.filter((id) => !id.match(/^[0-9a-fA-F]{24}$/));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL ID format in array",
      });
    }

    // Check folder exists
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // Remove URLs from folder (set folderId to null)
    const result = await URL.updateMany(
      {
        _id: { $in: urlIds },
        folderId: folderId,
        createdBy: userId,
        isDeleted: false,
      },
      { $set: { folderId: null } }
    );

    return res.status(200).json({
      success: true,
      message: "URLs removed from folder successfully",
      data: {
        removedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Remove URLs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Restore folder from recycle bin
 * @route PATCH /api/folder/:folderId/restore
 */
const handleRestoreFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Find deleted folder
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: true,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found in recycle bin",
      });
    }

    // Check for name conflict with active folders
    const existing = await Folder.findOne({
      name: { $regex: new RegExp(`^${folder.name}$`, "i") },
      createdBy: userId,
      _id: { $ne: folderId },
      isDeleted: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A folder with this name already exists. Please rename before restoring.",
      });
    }

    // Restore folder
    folder.isDeleted = false;
    folder.deletedAt = null;
    await folder.save();

    return res.status(200).json({
      success: true,
      message: "Folder restored successfully",
      data: {
        id: folder._id,
        name: folder.name,
        description: folder.description,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
    });
  } catch (error) {
    console.error("Restore Folder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Permanently delete folder
 * @route DELETE /api/folder/:folderId/permanent
 */
const handlePermanentDeleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;

    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid folder ID format",
      });
    }

    // Find deleted folder (only allow permanent delete from recycle bin)
    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: true,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found in recycle bin. Only trashed folders can be permanently deleted.",
      });
    }

    // Permanently delete folder
    await Folder.deleteOne({ _id: folder._id });

    return res.status(200).json({
      success: true,
      message: "Folder permanently deleted",
    });
  } catch (error) {
    console.error("Permanent Delete Folder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  handleCreateFolder,
  handleListFolders,
  handleGetFolderDetails,
  handleEditFolder,
  handleSoftDeleteFolder,
  handleRemoveUrlsFromFolder,
  handleRestoreFolder,
  handlePermanentDeleteFolder,
};
