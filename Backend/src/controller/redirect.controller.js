const URL = require("../models/url.model");
const VisitHistory = require("../models/visitHistory.model");
const geoip = require("geoip-lite");

/**
 * Handle short URL redirect
 * @route GET /r/:shortId
 */
const handleRedirect = async (req, res) => {
  try {
    const { shortId } = req.params;

    // 1. Validate shortId
    if (!shortId || shortId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Invalid short ID",
      });
    }

    // 2. Find the URL
    const urlDoc = await URL.findOne({
      shortId: shortId.trim(),
      isDeleted: false,
    }).lean();

    // 3. Check if URL exists
    if (!urlDoc) {
      return res.status(404).json({
        success: false,
        message: "URL not found",
      });
    }

    // 4. Check if URL is active
    if (!urlDoc.isActive) {
      return res.status(410).json({
        success: false,
        message: "This link has been deactivated",
      });
    }

    // 5. Check if URL has expired
    if (urlDoc.expirationDate && new Date(urlDoc.expirationDate) < new Date()) {
      return res.status(410).json({
        success: false,
        message: "This link has expired",
      });
    }

    // 6. Validate redirect URL
    if (!isValidURL(urlDoc.redirectURL)) {
      return res.status(400).json({
        success: false,
        message: "Invalid destination URL",
      });
    }

    // 7. Collect visitor information
    const visitorIP = getClientIP(req);
    const userAgent = req.headers["user-agent"] || null;
    const deviceType = parseDeviceType(userAgent);
    const referrer = parseReferrer(req.headers["referer"] || req.headers["referrer"]);
    const { country, city } = getGeolocation(visitorIP);

    // 8. Log visit asynchronously (don't block redirect)
    const visitDoc = new VisitHistory({
      urlId: urlDoc._id,
      visitorIP: visitorIP,
      deviceType: deviceType,
      userAgent: userAgent,
      referrer: referrer,
      country: country,
      city: city,
      timestamp: new Date(),
    });

    // Save without blocking the redirect
    visitDoc.save().catch((error) => {
      console.error("Error saving visit history:", error);
    });

    // 9. Redirect to destination URL
    // Using 302 (temporary) for better tracking, use 301 for permanent/SEO
    return res.redirect(302, urlDoc.redirectURL);
  } catch (error) {
    console.error("Redirect Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get client IP address from request
 */
const getClientIP = (req) => {
  // Check various headers for proxied requests
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one (client)
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0];
  }

  // Check other common headers
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP;
  }

  // Check CF-Connecting-IP for Cloudflare
  const cfIP = req.headers["cf-connecting-ip"];
  if (cfIP) {
    return cfIP;
  }

  // Fallback to connection info
  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
};

/**
 * Parse device type from user agent string
 */
const parseDeviceType = (userAgent) => {
  if (!userAgent) return "unknown";

  const ua = userAgent.toLowerCase();

  // Check for bots first
  if (/bot|crawler|spider|scraper|curl|wget|python|java|php/i.test(ua)) {
    return "bot";
  }

  // Check for mobile devices
  if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }

  // Check for tablets
  if (/tablet|ipad|playbook|silk|kindle|nexus\s?(7|10)/i.test(ua)) {
    return "tablet";
  }

  // Check for smart TVs
  if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast/i.test(ua)) {
    return "tv";
  }

  // Default to desktop
  return "desktop";
};

/**
 * Parse and clean referrer URL
 */
const parseReferrer = (referrer) => {
  if (!referrer) return null;

  try {
    const url = new globalThis.URL(referrer);
    // Return just the origin (domain) for cleaner analytics
    return url.origin;
  } catch {
    // If URL parsing fails, return the raw referrer
    return referrer;
  }
};

/**
 * Get geolocation from IP address using geoip-lite
 */
const getGeolocation = (ip) => {
  const result = {
    country: null,
    city: null,
  };

  if (!ip) return result;

  try {
    // Clean the IP address
    let cleanIP = ip;

    // Handle IPv6 localhost
    if (cleanIP === "::1" || cleanIP === "::ffff:127.0.0.1") {
      return result; // localhost, no geo data
    }

    // Remove IPv6 prefix if present
    if (cleanIP.startsWith("::ffff:")) {
      cleanIP = cleanIP.substring(7);
    }

    // Lookup geolocation
    const geo = geoip.lookup(cleanIP);

    if (geo) {
      result.country = geo.country || null; // ISO 3166-1 alpha-2 country code
      result.city = geo.city || null;

      // Optionally expand country code to full name
      result.country = getCountryName(geo.country) || geo.country;
    }
  } catch (error) {
    console.error("Geolocation lookup error:", error);
  }

  return result;
};

/**
 * Convert country code to country name
 */
const getCountryName = (countryCode) => {
  const countries = {
    US: "United States",
    GB: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
    IN: "India",
    JP: "Japan",
    CN: "China",
    BR: "Brazil",
    RU: "Russia",
    IT: "Italy",
    ES: "Spain",
    MX: "Mexico",
    KR: "South Korea",
    NL: "Netherlands",
    SE: "Sweden",
    NO: "Norway",
    DK: "Denmark",
    FI: "Finland",
    PL: "Poland",
    AT: "Austria",
    CH: "Switzerland",
    BE: "Belgium",
    IE: "Ireland",
    NZ: "New Zealand",
    SG: "Singapore",
    HK: "Hong Kong",
    AE: "United Arab Emirates",
    SA: "Saudi Arabia",
    ZA: "South Africa",
    NG: "Nigeria",
    EG: "Egypt",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PE: "Peru",
    VE: "Venezuela",
    PH: "Philippines",
    ID: "Indonesia",
    MY: "Malaysia",
    TH: "Thailand",
    VN: "Vietnam",
    PK: "Pakistan",
    BD: "Bangladesh",
    TR: "Turkey",
    IL: "Israel",
    UA: "Ukraine",
    CZ: "Czech Republic",
    RO: "Romania",
    HU: "Hungary",
    GR: "Greece",
    PT: "Portugal",
  };

  return countries[countryCode] || null;
};

/**
 * Validate URL format
 */
const isValidURL = (urlString) => {
  if (!urlString) return false;

  try {
    const url = new globalThis.URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

module.exports = { handleRedirect };