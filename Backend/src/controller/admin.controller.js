const URL = require('../models/url.model');
const User = require('../models/users.model');
const VisitHistory = require('../models/visitHistory.model');
const Folder = require('../models/folder.model');
const mongoose = require('mongoose');

/**
 * Admin Dashboard - Overview with key metrics
 */
const handleAdminDashboard = async (req, res) => {
  try {
    // Get counts with more efficient queries
    const [
      totalUsers,
      activeUsers,
      totalUrls,
      totalClicks,
      recentUsers,
      topUrls,
      dailyStats
    ] = await Promise.all([
      // User stats
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      
      // URL stats
      URL.countDocuments({ isDeleted: false }),
      
      // Total clicks (aggregate)
      URL.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, totalClicks: { $sum: "$clickCount" } } }
      ]),
      
      // Recent users (last 5)
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('username email createdAt role')
        .lean(),
      
      // Top 5 URLs by clicks
      URL.find({ isDeleted: false })
        .sort({ clickCount: -1 })
        .limit(5)
        .select('shortId redirectURL clickCount createdAt')
        .populate('createdBy', 'username email')
        .lean(),
      
      // Last 7 days stats
      VisitHistory.aggregate([
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { 
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } 
            },
            visits: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Format the response
    return res.status(200).json({
      success: true,
      data: {
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers
          },
          urls: {
            total: totalUrls,
            clicks: totalClicks.length > 0 ? totalClicks[0].totalClicks : 0
          }
        },
        recentUsers,
        topUrls,
        dailyStats: dailyStats.map(day => ({
          date: day._id,
          visits: day.visits
        }))
      }
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * User Management - List all users with filtering and pagination
 */
const handleListUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      order = 'desc',
      search = '',
      role,
      isActive
    } = req.query;
    
    // Build filter
    const filter = {};
    
    // Add search filter (search by username or email)
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add role filter
    if (role) {
      filter.role = role;
    }
    
    // Add active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Parse pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Create sort object
    const sortOptions = { [sortBy]: order === 'asc' ? 1 : -1 };
    
    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select('-password')
        .lean(),
      User.countDocuments(filter)
    ]);
    
    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list users error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * User Management - Get user details including their URLs and activity
 */
const handleGetUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Get user with URLs and recent activity
    const user = await User.findById(userId)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's URLs
    const [urls, urlCount, folders, activity] = await Promise.all([
      // Get limited URLs
      URL.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      
      // Get URL counts
      URL.countDocuments({ createdBy: userId }),
      
      // Get folders
      Folder.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      
      // Get recent activity from visit history
      VisitHistory.aggregate([
        { 
          $match: {
            urlId: { 
              $in: await URL.find({ createdBy: userId }).distinct('_id')
            }
          }
        },
        { $sort: { timestamp: -1 } },
        { $limit: 20 },
        { 
          $lookup: {
            from: 'urls',
            localField: 'urlId',
            foreignField: '_id',
            as: 'urlInfo'
          }
        },
        { $unwind: '$urlInfo' },
        {
          $project: {
            timestamp: 1,
            deviceType: 1,
            country: 1,
            shortId: '$urlInfo.shortId',
            redirectURL: '$urlInfo.redirectURL'
          }
        }
      ])
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        user,
        urlStats: {
          total: urlCount,
          active: urls.filter(url => url.isActive && !url.isDeleted).length,
          deleted: urls.filter(url => url.isDeleted).length
        },
        recentUrls: urls,
        folders,
        recentActivity: activity
      }
    });
  } catch (err) {
    console.error('Admin get user details error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * User Management - Update user
 */
const handleUpdateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isActive, username } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent changing own role (admin can't demote themselves)
    if (userId === req.user._id.toString() && role !== 'admin') {
      return res.status(403).json({ 
        error: 'Cannot change your own admin role' 
      });
    }
    
    // Update user fields if provided
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      user.role = role;
    }
    
    if (isActive !== undefined) {
      user.isActive = isActive;
    }
    
    if (username !== undefined) {
      if (username.trim() === '') {
        return res.status(400).json({ error: 'Username cannot be empty' });
      }
      user.username = username;
    }
    
    user.updatedAt = new Date();
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * URL Management - List all URLs with filtering and pagination
 */
const handleListUrls = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      order = 'desc',
      search = '',
      isActive,
      isDeleted,
      userId
    } = req.query;
    
    // Build filter
    const filter = {};
    
    // Add search filter
    if (search) {
      filter.$or = [
        { shortId: { $regex: search, $options: 'i' } },
        { redirectURL: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add status filters
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (isDeleted !== undefined) {
      filter.isDeleted = isDeleted === 'true';
    }
    
    // Add user filter
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.createdBy = userId;
    }
    
    // Parse pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Create sort object
    const sortOptions = { [sortBy]: order === 'asc' ? 1 : -1 };
    
    // Execute query with pagination
    const [urls, total] = await Promise.all([
      URL.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'username email')
        .lean(),
      URL.countDocuments(filter)
    ]);
    
    return res.status(200).json({
      success: true,
      data: urls,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list URLs error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * URL Management - Get URL details including analytics
 */
const handleGetUrlDetails = async (req, res) => {
  try {
    const { urlId } = req.params;
    
    // Find URL by ID or shortID
    const query = mongoose.Types.ObjectId.isValid(urlId)
      ? { _id: urlId }
      : { shortId: urlId };
    
    const url = await URL.findOne(query)
      .populate('createdBy', 'username email')
      .lean();
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
    // Get analytics summary
    const [visitsData, deviceStats, referrerStats, countryStats] = await Promise.all([
      // Last 30 days visits
      VisitHistory.aggregate([
        { $match: { urlId: url._id } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Device breakdown
      VisitHistory.aggregate([
        { $match: { urlId: url._id } },
        { $group: { _id: "$deviceType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Top referrers
      VisitHistory.aggregate([
        { $match: { urlId: url._id } },
        { $group: { _id: "$referrer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Countries
      VisitHistory.aggregate([
        { 
          $match: { 
            urlId: url._id,
            country: { $ne: null } 
          } 
        },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
    ]);
    
    return res.status(200).json({
      success: true,
      data: {
        url,
        analytics: {
          visits: visitsData,
          devices: deviceStats,
          referrers: referrerStats,
          countries: countryStats
        }
      }
    });
  } catch (err) {
    console.error('Admin get URL details error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * URL Management - Update URL
 */
const handleUpdateUrl = async (req, res) => {
  try {
    const { urlId } = req.params;
    const { isActive, isDeleted, redirectURL } = req.body;
    
    // Find URL by ID or shortID
    const query = mongoose.Types.ObjectId.isValid(urlId)
      ? { _id: urlId }
      : { shortId: urlId };
    
    const url = await URL.findOne(query);
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    
    // Update fields if provided
    if (isActive !== undefined) {
      url.isActive = isActive;
    }
    
    if (isDeleted !== undefined) {
      url.isDeleted = isDeleted;
    }
    
    if (redirectURL) {
      // Validate URL
      try {
        new URL(redirectURL);
        url.redirectURL = redirectURL;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid redirect URL' });
      }
    }
    
    url.updatedAt = new Date();
    await url.save();
    
    return res.status(200).json({
      success: true,
      message: 'URL updated successfully',
      data: url
    });
  } catch (err) {
    console.error('Admin update URL error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

/**
 * System Stats - Get comprehensive system statistics
 */
const handleSystemStats = async (req, res) => {
  try {
    const [
      userStats,
      urlStats,
      dailyActivity,
      monthlyGrowth,
      topCountries
    ] = await Promise.all([
      // User statistics
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            admins: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } }
          }
        }
      ]),
      
      // URL statistics
      URL.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ["$isActive", 1, 0] } },
            deleted: { $sum: { $cond: ["$isDeleted", 1, 0] } },
            totalClicks: { $sum: "$clickCount" }
          }
        }
      ]),
      
      // Daily activity (last 30 days)
      VisitHistory.aggregate([
        { 
          $match: { 
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
          } 
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            visits: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Monthly growth of URLs and users
      Promise.all([
        // Monthly URL growth
        URL.aggregate([
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          { $limit: 12 }
        ]),
        
        // Monthly user growth
        User.aggregate([
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          { $limit: 12 }
        ])
      ]),
      
      // Top countries
      VisitHistory.aggregate([
        { $match: { country: { $ne: null } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    // Format monthly growth data
    const [urlGrowth, userGrowth] = monthlyGrowth;
    
    return res.status(200).json({
      success: true,
      data: {
        users: userStats[0] || { total: 0, active: 0, admins: 0 },
        urls: urlStats[0] || { total: 0, active: 0, deleted: 0, totalClicks: 0 },
        activity: {
          daily: dailyActivity,
          monthlyGrowth: {
            urls: urlGrowth.map(item => ({
              month: `${item._id.year}-${item._id.month}`,
              count: item.count
            })),
            users: userGrowth.map(item => ({
              month: `${item._id.year}-${item._id.month}`,
              count: item.count
            }))
          }
        },
        topCountries: topCountries.map(country => ({
          name: country._id,
          visits: country.count
        }))
      }
    });
  } catch (err) {
    console.error('Admin system stats error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

module.exports = {
  handleAdminDashboard,
  handleListUsers,
  handleGetUserDetails,
  handleUpdateUser,
  handleListUrls,
  handleGetUrlDetails,
  handleUpdateUrl,
  handleSystemStats
};