const URL = require('../models/url.model');
const VisitHistory = require('../models/visitHistory.model');
const { Parser } = require('json2csv');
const mongoose = require('mongoose');

/**
 * Get analytics for a specific URL
 * @route GET /api/analytics/:shortId
 */
const handleGetUrlAnalytics = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user._id;
    const { 
      startDate, 
      endDate, 
      groupBy = 'day' // day, week, month
    } = req.query;

    // Input validation
    if (!shortId) {
      return res.status(400).json({ error: 'Short ID is required' });
    }

    // Verify URL belongs to the user
    const urlDoc = await URL.findOne({ 
      shortId, 
      createdBy: userId, 
      isDeleted: false 
    }).lean();

    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found or unauthorized' });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
      if (isNaN(dateFilter.$gte)) {
        return res.status(400).json({ error: 'Invalid start date format' });
      }
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
      if (isNaN(dateFilter.$lte)) {
        return res.status(400).json({ error: 'Invalid end date format' });
      }
    }

    // Build pipeline stages
    const matchStage = { 
      urlId: urlDoc._id,
      ...(Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {})
    };

    // Use aggregation for efficient database processing
    const [analytics, recentVisits] = await Promise.all([
      VisitHistory.aggregate([
        { $match: matchStage },
        // Get total clicks
        { 
          $facet: {
            // Time series data
            clicksOverTime: [
              { 
                $group: {
                  _id: getTimeGroupingExpression(groupBy),
                  count: { $sum: 1 }
                }
              },
              { $sort: { "_id": 1 } }
            ],
            
            // Device stats
            deviceStats: [
              { $group: { _id: "$deviceType", count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            
            // Referrer stats
            referrerStats: [
              { 
                $group: { 
                  _id: { $ifNull: ["$referrer", "direct"] }, 
                  count: { $sum: 1 } 
                } 
              },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            
            // Country stats
            countryStats: [
              { 
                $match: { country: { $exists: true, $ne: null } } 
              },
              { $group: { _id: "$country", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            
            // City stats
            cityStats: [
              { 
                $match: { city: { $exists: true, $ne: null } } 
              },
              { $group: { _id: "$city", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            
            // Total count
            totalCount: [
              { $count: "value" }
            ]
          }
        }
      ]),
      
      // Get recent visits (separate query for pagination)
      VisitHistory.find(matchStage)
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
    ]);

    // Format time series data based on groupBy
    const formattedTimeSeries = analytics[0].clicksOverTime.map(entry => {
      if (groupBy === 'day') {
        return {
          date: formatDate(entry._id),
          count: entry.count
        };
      } else if (groupBy === 'week') {
        return {
          week: `${entry._id.year}-W${entry._id.week}`,
          count: entry.count
        };
      } else {
        return {
          month: `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}`,
          count: entry.count
        };
      }
    });

    // Get total count
    const totalClicks = analytics[0].totalCount.length > 0 
      ? analytics[0].totalCount[0].value 
      : 0;

    // Format device stats
    const formattedDeviceStats = analytics[0].deviceStats.map(entry => ({
      device: entry._id || "unknown",
      count: entry.count
    }));

    // Format referrer stats
    const formattedReferrerStats = analytics[0].referrerStats.map(entry => ({
      referrer: entry._id,
      count: entry.count
    }));

    // Format country stats
    const formattedCountryStats = analytics[0].countryStats.map(entry => ({
      country: entry._id,
      count: entry.count
    }));

    // Format city stats
    const formattedCityStats = analytics[0].cityStats.map(entry => ({
      city: entry._id,
      count: entry.count
    }));
    
    // Format recent visits for privacy
    const formattedRecentVisits = recentVisits.map(visit => ({
      timestamp: visit.timestamp,
      deviceType: visit.deviceType || "unknown",
      referrer: visit.referrer || "direct",
      country: visit.country || null,
      city: visit.city || null
    }));

    // Return structured analytics
    return res.status(200).json({
      message: 'Analytics fetched successfully',
      data: {
        url: {
          shortId: urlDoc.shortId,
          destination: urlDoc.redirectURL,
          createdAt: urlDoc.createdAt,
          lastAccessed: urlDoc.lastAccessedAt,
          title: urlDoc.title || null
        },
        analytics: {
          totalClicks,
          clicksOverTime: formattedTimeSeries,
          devices: formattedDeviceStats,
          referrers: formattedReferrerStats,
          countries: formattedCountryStats,
          cities: formattedCityStats,
        },
        recentVisits: formattedRecentVisits,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          groupBy
        }
      }
    });

  } catch (err) {
    console.error('Error fetching analytics:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Export analytics for a specific URL
 * @route GET /api/analytics/:shortId/export
 */
const handleExportUrlAnalytics = async (req, res) => {
  try {
    const { shortId } = req.params;
    const userId = req.user._id;
    const { 
      startDate, 
      endDate,
      format = 'csv' // csv or json
    } = req.query;

    // Verify URL belongs to the user
    const urlDoc = await URL.findOne({ 
      shortId, 
      createdBy: userId, 
      isDeleted: false 
    });

    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found or unauthorized' });
    }

    // Build query filters
    const filter = { urlId: urlDoc._id };
    
    // Add date filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      
      if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (!isNaN(parsedStartDate.getTime())) {
          filter.timestamp.$gte = parsedStartDate;
        } else {
          return res.status(400).json({ error: 'Invalid start date format' });
        }
      }
      
      if (endDate) {
        const parsedEndDate = new Date(endDate);
        if (!isNaN(parsedEndDate.getTime())) {
          filter.timestamp.$lte = parsedEndDate;
        } else {
          return res.status(400).json({ error: 'Invalid end date format' });
        }
      }
    }

    // Get visits with filtering
    const visits = await VisitHistory.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    if (visits.length === 0) {
      return res.status(404).json({ 
        error: 'No analytics data available for the specified criteria' 
      });
    }

    // Format data for export
    const formattedData = visits.map(visit => ({
      timestamp: visit.timestamp ? new Date(visit.timestamp).toISOString() : null,
      date: visit.timestamp ? formatDate(visit.timestamp) : null,
      time: visit.timestamp ? formatTime(visit.timestamp) : null,
      deviceType: visit.deviceType || 'unknown',
      referrer: visit.referrer || 'direct',
      country: visit.country || 'unknown',
      city: visit.city || 'unknown',
      // Anonymize IP for privacy
      visitorIP: visit.visitorIP ? anonymizeIP(visit.visitorIP) : 'unknown'
    }));

    // Handle different formats
    if (format.toLowerCase() === 'json') {
      // Return JSON directly
      return res.status(200).json({
        message: 'Analytics exported successfully',
        data: {
          url: {
            shortId: urlDoc.shortId,
            destination: urlDoc.redirectURL
          },
          totalCount: formattedData.length,
          visits: formattedData
        }
      });
    } else {
      // Default to CSV
      const fields = [
        'timestamp', 
        'date', 
        'time', 
        'deviceType', 
        'referrer', 
        'country', 
        'city', 
        'visitorIP'
      ];
      
      const opts = { 
        fields,
        header: true
      };
      
      try {
        const parser = new Parser(opts);
        const csv = parser.parse(formattedData);
        
        // Generate filename with date
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${urlDoc.shortId}_analytics_${timestamp}.csv`;
        
        // Set headers for download
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(csv);
      } catch (err) {
        console.error('CSV parsing error:', err);
        return res.status(500).json({ error: 'Error generating CSV file' });
      }
    }
  } catch (err) {
    console.error('Error exporting analytics:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Helper function to get time grouping expression for MongoDB aggregation
 */
function getTimeGroupingExpression(groupBy) {
  switch (groupBy) {
    case 'month':
      return { 
        year: { $year: "$timestamp" }, 
        month: { $month: "$timestamp" }
      };
    case 'week':
      return { 
        year: { $year: "$timestamp" }, 
        week: { $week: "$timestamp" }
      };
    case 'day':
    default:
      return { 
        year: { $year: "$timestamp" }, 
        month: { $month: "$timestamp" }, 
        day: { $dayOfMonth: "$timestamp" }
      };
  }
}

/**
 * Format date from MongoDB aggregation result or Date object
 */
function formatDate(dateObj) {
  if (!dateObj) return null;
  
  if (dateObj instanceof Date) {
    return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  // Handle aggregation _id object format
  if (dateObj.year && dateObj.month && dateObj.day) {
    return `${dateObj.year}-${String(dateObj.month).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
  }
  
  return 'Unknown Date';
}

/**
 * Format time from Date object
 */
function formatTime(date) {
  if (!date) return null;
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Anonymize IP address for privacy (keep first parts)
 */
function anonymizeIP(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';
  
  // Handle IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  
  // Handle IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 2) {
      return `${parts[0]}:${parts[1]}:****`;
    }
  }
  
  return ip; // Return original if format is unrecognized
}

module.exports = {
  handleGetUrlAnalytics,
  handleExportUrlAnalytics
};