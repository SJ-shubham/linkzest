// controllers/redirectController.js
const URL = require('../models/url.model');
const visitHistory = require('../models/visitHistory.model');

const handleRedirect = async (req, res) => {
  try {
    const { shortId } = req.params;

    // Input validation
    if (!shortId || shortId.trim() === '') {
      return res.status(400).json({ error: 'Invalid short ID' });
    }

    // 1. Find the URL with optimized query (use lean for better performance)
    const urlDoc = await URL.findOne({
      shortId: shortId.trim(),
      isDeleted: false,
      isActive: true,
      $or: [
        { expirationDate: null },
        { expirationDate: { $gt: new Date() } }
      ]
    }).lean();

    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found or expired' });
    }

    // 2. Collect visitor info with better parsing
    const visitorIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceType = parseDeviceType(userAgent);
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;
    const { country, city } = getGeolocation(visitorIP); // GeoIP lookup (use geoip-lite or similar)

     // 3. Save visit history asynchronously (don't block redirect)
    const visitDoc = new visitHistory({
      urlId: urlDoc._id,
      visitorIP,
      deviceType,
      userAgent,
      referrer,
      country, // Using the country from GeoIP lookup
      city,    // Using the city from GeoIP lookup
      timestamp: new Date(),
    });

    // Save visit history asynchronously (no blocking)
    visitDoc.save().catch(error => {
      console.error('Error saving visit history:', error);
      // Don't fail the redirect if saving visit history fails
    });

    // 4. Validate redirect URL
    if (!isValidURL(urlDoc.redirectURL)) {
      return res.status(400).json({ error: 'Invalid redirect URL' });
    }

    // 5. Redirect with 301 (permanent) for better SEO, or keep 302 for tracking
    return res.redirect(301, urlDoc.redirectURL);

  } catch (error) {
    console.error('Redirect error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get client IP
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

// Helper function to parse device type
const parseDeviceType = (userAgent) => {
  const ua = userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad|playbook|silk|kindle/i.test(ua)) {
    return 'tablet';
  }
  if (/bot|crawler|spider|scraper/i.test(ua)) {
    return 'bot';
  }
  return 'desktop';
};

// Helper function to validate URL
const isValidURL = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

module.exports = { handleRedirect };