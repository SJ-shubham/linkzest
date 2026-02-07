const URL = require("../models/url.model");
const Folder = require("../models/folder.model");
const { nanoid: generateNanoId } = require("nanoid");

/**
 * Generate a unique short ID
 */
const generateUniqueShortId = async (length = 8) => {
  let isUnique = false;
  let generatedId;

  while (!isUnique) {
    generatedId = generateNanoId(length);
    const exists = await URL.exists({ shortId: generatedId });
    if (!exists) isUnique = true;
  }

  return generatedId;
};

/**
 * Create a new short URL
 * @route POST /api/url
 */
const handleCreateShortURL = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      redirectURL,
      customShortId,
      folderId,
      isActive = true,
      expirationDate,
      neverExpire = false,
    } = req.body;

    // Validate redirect URL
    if (!redirectURL || redirectURL.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Destination URL is required",
      });
    }

    const trimmedURL = redirectURL.trim();

    // Add protocol if missing
    const normalizedURL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedURL)
      ? trimmedURL
      : `https://${trimmedURL}`;

    // Validate URL format
    try {
      new globalThis.URL(normalizedURL);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    let finalShortId;

    // Handle custom short ID
    if (customShortId) {
      const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(customShortId);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Custom ID must be 3-20 characters (letters, numbers, dashes, underscores)",
        });
      }

      const exists = await URL.findOne({
        shortId: { $regex: new RegExp(`^${customShortId}$`, "i") },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Custom short ID is already in use",
        });
      }

      finalShortId = customShortId;
    } else {
      finalShortId = await generateUniqueShortId();
    }

    // Validate folder if provided
    if (folderId) {
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
    }

    // Handle expiration date
    let finalExpirationDate = null;
    if (!neverExpire && expirationDate) {
      const date = new Date(expirationDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid expiration date format",
        });
      }
      if (date <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Expiration date must be in the future",
        });
      }
      finalExpirationDate = date;
    }

    // Create new URL
    const newUrl = await URL.create({
      shortId: finalShortId,
      title: title?.trim() || null,
      redirectURL: normalizedURL,
      createdBy: userId,
      folderId: folderId || null,
      isActive,
      expirationDate: finalExpirationDate,
      isDeleted: false,
      deletedAt: null,
    });

    // Generate short URL
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    return res.status(201).json({
      success: true,
      message: "Short URL created successfully",
      data: {
        id: newUrl._id,
        shortId: newUrl.shortId,
        title: newUrl.title,
        redirectURL: newUrl.redirectURL,
        shortUrl: `${appBaseUrl}/r/${finalShortId}`,
        folderId: newUrl.folderId,
        isActive: newUrl.isActive,
        expirationDate: newUrl.expirationDate,
        createdAt: newUrl.createdAt,
      },
    });
  } catch (error) {
    console.error("Create URL Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * List all URLs for logged-in user with pagination and filters
 * @route GET /api/url
 */
const handleListUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      search,
      folderId,
      status,
      startDate,
      endDate,
      showDeleted = false,
    } = req.query;

    // Build query
    const query = {
      createdBy: userId,
      isDeleted: showDeleted === "true",
    };

    // Search by title or shortId
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortId: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by folder
    if (folderId) {
      query.folderId = folderId === "null" ? null : folderId;
    }

    // Filter by status
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
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

    // Execute query
    const [urls, totalCount] = await Promise.all([
      URL.find(query)
        .select("-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("folderId", "name"),
      URL.countDocuments(query),
    ]);

    // Generate short URLs
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const urlsWithShortUrl = urls.map((url) => ({
      ...url.toObject(),
      shortUrl: `${appBaseUrl}/r/${url.shortId}`,
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "URLs fetched successfully",
      data: urlsWithShortUrl,
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
    console.error("List URLs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Edit URL details
 * @route PATCH /api/url/:shortId/edit
 */
const handleEditUrl = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;
    const {
      title,
      redirectURL,
      newShortId,
      folderId,
      isActive,
      expirationDate,
      neverExpire,
    } = req.body;

    // Find URL
    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found",
      });
    }

    // Update title
    if (title !== undefined) {
      urlDoc.title = title?.trim() || null;
    }

    // Update redirect URL
    if (redirectURL) {
      const trimmedURL = redirectURL.trim();
      const normalizedURL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedURL)
        ? trimmedURL
        : `https://${trimmedURL}`;

      try {
        new globalThis.URL(normalizedURL);
        urlDoc.redirectURL = normalizedURL;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid URL format",
        });
      }
    }

    // Update short ID
    if (newShortId && newShortId !== shortId) {
      const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(newShortId);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Short ID must be 3-20 characters (letters, numbers, dashes, underscores)",
        });
      }

      const exists = await URL.findOne({
        shortId: { $regex: new RegExp(`^${newShortId}$`, "i") },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Short ID already in use",
        });
      }

      urlDoc.shortId = newShortId;
    }

    // Update folder assignment
    if (folderId !== undefined) {
      if (folderId) {
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
        urlDoc.folderId = folderId;
      } else {
        urlDoc.folderId = null;
      }
    }

    // Update active status
    if (isActive !== undefined) {
      urlDoc.isActive = Boolean(isActive);
    }

    // Update expiration
    if (neverExpire) {
      urlDoc.expirationDate = null;
    } else if (expirationDate !== undefined) {
      if (expirationDate) {
        const date = new Date(expirationDate);
        if (isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid expiration date format",
          });
        }
        urlDoc.expirationDate = date;
      } else {
        urlDoc.expirationDate = null;
      }
    }

    await urlDoc.save();

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    return res.status(200).json({
      success: true,
      message: "URL updated successfully",
      data: {
        ...urlDoc.toObject(),
        shortUrl: `${appBaseUrl}/r/${urlDoc.shortId}`,
      },
    });
  } catch (error) {
    console.error("Edit URL Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Toggle URL active/inactive status
 * @route PATCH /api/url/:shortId/status
 */
const handleToggleUrlStatus = async (req, res) => {
  try {
    const { shortId } = req.params;
    const { isActive } = req.body;
    const userId = req.user.id;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive field is required",
      });
    }

    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found",
      });
    }

    const newStatus = Boolean(isActive);

    if (urlDoc.isActive === newStatus) {
      return res.status(200).json({
        success: true,
        message: `URL is already ${newStatus ? "active" : "inactive"}`,
        data: { isActive: urlDoc.isActive },
      });
    }

    urlDoc.isActive = newStatus;
    await urlDoc.save();

    return res.status(200).json({
      success: true,
      message: `URL ${newStatus ? "activated" : "deactivated"} successfully`,
      data: { isActive: urlDoc.isActive },
    });
  } catch (error) {
    console.error("Toggle Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Soft delete URL (move to recycle bin)
 * @route DELETE /api/url/:shortId
 */
const handleSoftDeleteUrl = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;

    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found",
      });
    }

    urlDoc.isDeleted = true;
    urlDoc.deletedAt = new Date();
    await urlDoc.save();

    return res.status(200).json({
      success: true,
      message: "URL moved to recycle bin",
    });
  } catch (error) {
    console.error("Soft Delete Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Restore URL from recycle bin
 * @route PATCH /api/url/:shortId/restore
 */
const handleRestoreUrl = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;

    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: true,
    });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found in recycle bin",
      });
    }

    urlDoc.isDeleted = false;
    urlDoc.deletedAt = null;
    await urlDoc.save();

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    return res.status(200).json({
      success: true,
      message: "URL restored successfully",
      data: {
        ...urlDoc.toObject(),
        shortUrl: `${appBaseUrl}/r/${urlDoc.shortId}`,
      },
    });
  } catch (error) {
    console.error("Restore URL Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Permanently delete URL
 * @route DELETE /api/url/:shortId/permanent
 */
const handlePermanentDeleteUrl = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;

    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: true,
    });

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found in recycle bin. Only trashed URLs can be permanently deleted.",
      });
    }

    await URL.deleteOne({ _id: urlDoc._id });

    return res.status(200).json({
      success: true,
      message: "URL permanently deleted",
    });
  } catch (error) {
    console.error("Permanent Delete Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  handleCreateShortURL,
  handleListUserUrls,
  handleEditUrl,
  handleToggleUrlStatus,
  handleSoftDeleteUrl,
  handleRestoreUrl,
  handlePermanentDeleteUrl,
};