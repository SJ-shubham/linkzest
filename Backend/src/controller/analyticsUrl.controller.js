const URL = require("../models/url.model");
const Folder = require("../models/folder.model");
const VisitHistory = require("../models/visitHistory.model");

/**
 * Get URL analytics overview (high-level stats)
 * @route GET /api/analytics/:shortId/overview
 */
const handleGetUrlOverview = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;

    // Validate shortId
    if (!shortId) {
      return res.status(400).json({
        success: false,
        message: "Short ID is required",
      });
    }

    // Find URL with folder info
    const urlDoc = await URL.findOne({
      shortId,
      createdBy: userId,
      isDeleted: false,
    }).populate("folderId", "name");

    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found",
      });
    }

    // Get total clicks
    const totalClicks = await VisitHistory.countDocuments({
      urlId: urlDoc._id,
    });

    // Generate short URL
    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

    return res.status(200).json({
      success: true,
      message: "URL overview fetched successfully",
      data: {
        id: urlDoc._id,
        title: urlDoc.title,
        shortId: urlDoc.shortId,
        shortUrl: `${appBaseUrl}/r/${urlDoc.shortId}`,
        redirectURL: urlDoc.redirectURL,
        isActive: urlDoc.isActive,
        folder: urlDoc.folderId
          ? {
              id: urlDoc.folderId._id,
              name: urlDoc.folderId.name,
            }
          : null,
        expirationDate: urlDoc.expirationDate,
        totalClicks,
        createdAt: urlDoc.createdAt,
        updatedAt: urlDoc.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get URL Overview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get aggregated analytics data for charts
 * @route GET /api/analytics/:shortId/charts
 */
const handleGetChartsData = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;
    const {
      startDate,
      endDate,
      groupBy = "day", // day, week, month
    } = req.query;

    // Validate shortId
    if (!shortId) {
      return res.status(400).json({
        success: false,
        message: "Short ID is required",
      });
    }

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

    // Build date filter
    const matchStage = { urlId: urlDoc._id };

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date format",
          });
        }
        matchStage.timestamp.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date format",
          });
        }
        end.setHours(23, 59, 59, 999);
        matchStage.timestamp.$lte = end;
      }
    }

    // Aggregation pipeline for all chart data
    const analytics = await VisitHistory.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // Clicks over time
          clicksOverTime: [
            {
              $group: {
                _id: getTimeGroupingExpression(groupBy),
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // Device distribution
          deviceStats: [
            {
              $group: {
                _id: { $ifNull: ["$deviceType", "unknown"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],

          // Country-wise traffic
          countryStats: [
            {
              $group: {
                _id: { $ifNull: ["$country", "unknown"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],

          // City-wise traffic
          cityStats: [
            {
              $group: {
                _id: { $ifNull: ["$city", "unknown"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],

          // Referrer breakdown
          referrerStats: [
            {
              $group: {
                _id: { $ifNull: ["$referrer", "direct"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],

          // Total count
          totalCount: [{ $count: "value" }],
        },
      },
    ]);

    const result = analytics[0];
    const totalClicks =
      result.totalCount.length > 0 ? result.totalCount[0].value : 0;

    // Format clicks over time
    const clicksOverTime = result.clicksOverTime.map((entry) => ({
      date: formatDateFromGroup(entry._id, groupBy),
      count: entry.count,
    }));

    // Format device stats
    const devices = result.deviceStats.map((entry) => ({
      device: entry._id,
      count: entry.count,
      percentage: totalClicks > 0 ? Math.round((entry.count / totalClicks) * 100) : 0,
    }));

    // Format country stats
    const countries = result.countryStats.map((entry) => ({
      country: entry._id,
      count: entry.count,
      percentage: totalClicks > 0 ? Math.round((entry.count / totalClicks) * 100) : 0,
    }));

    // Format city stats
    const cities = result.cityStats.map((entry) => ({
      city: entry._id,
      count: entry.count,
      percentage: totalClicks > 0 ? Math.round((entry.count / totalClicks) * 100) : 0,
    }));

    // Format referrer stats
    const referrers = result.referrerStats.map((entry) => ({
      referrer: entry._id,
      count: entry.count,
      percentage: totalClicks > 0 ? Math.round((entry.count / totalClicks) * 100) : 0,
    }));

    return res.status(200).json({
      success: true,
      message: "Charts data fetched successfully",
      data: {
        totalClicks,
        clicksOverTime,
        devices,
        countries,
        cities,
        referrers,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          groupBy,
        },
      },
    });
  } catch (error) {
    console.error("Get Charts Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get paginated visit history
 * @route GET /api/analytics/:shortId/visits
 */
const handleGetVisitHistory = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    // Validate shortId
    if (!shortId) {
      return res.status(400).json({
        success: false,
        message: "Short ID is required",
      });
    }

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

    // Build query
    const query = { urlId: urlDoc._id };

    // Date filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date format",
          });
        }
        query.timestamp.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date format",
          });
        }
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Get visits and count
    const [visits, totalCount] = await Promise.all([
      VisitHistory.find(query)
        .select("-__v")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum),
      VisitHistory.countDocuments(query),
    ]);

    // Format visits (mask IP for privacy)
    const formattedVisits = visits.map((visit) => ({
      id: visit._id,
      timestamp: visit.timestamp,
      country: visit.country || null,
      city: visit.city || null,
      deviceType: visit.deviceType || "unknown",
      referrer: visit.referrer || "direct",
      visitorIP: anonymizeIP(visit.visitorIP),
      userAgent: visit.userAgent || null,
    }));

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      message: "Visit history fetched successfully",
      data: formattedVisits,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error("Get Visit History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Helper: Get time grouping expression for MongoDB aggregation
 */
function getTimeGroupingExpression(groupBy) {
  switch (groupBy) {
    case "month":
      return {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
      };
    case "week":
      return {
        year: { $year: "$timestamp" },
        week: { $isoWeek: "$timestamp" },
      };
    case "day":
    default:
      return {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" },
      };
  }
}

/**
 * Helper: Format date from aggregation group
 */
function formatDateFromGroup(dateObj, groupBy) {
  if (!dateObj) return null;

  if (groupBy === "month") {
    return `${dateObj.year}-${String(dateObj.month).padStart(2, "0")}`;
  } else if (groupBy === "week") {
    return `${dateObj.year}-W${String(dateObj.week).padStart(2, "0")}`;
  } else {
    return `${dateObj.year}-${String(dateObj.month).padStart(2, "0")}-${String(dateObj.day).padStart(2, "0")}`;
  }
}

/**
 * Helper: Anonymize IP address for privacy
 */
function anonymizeIP(ip) {
  if (!ip || typeof ip !== "string") return null;

  // Handle IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }

  // Handle IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length > 2) {
      return `${parts[0]}:${parts[1]}:****`;
    }
  }

  return null;
}

module.exports = {
  handleGetUrlOverview,
  handleGetChartsData,
  handleGetVisitHistory,
};