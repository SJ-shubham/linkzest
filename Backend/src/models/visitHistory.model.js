const mongoose = require('mongoose');

const visitHistorySchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'url',   // Reference to the URL document
    required: true,
    index: true,  // Faster lookups when querying visits for a given URL
  },
  visitorIP: {
    type: String, // Store raw IP (could be anonymized if needed)
  },
  deviceType: {
    type: String, // e.g., 'desktop', 'mobile', 'tablet'
  },
  userAgent: {
    type: String, // Full UA string (optional, useful for later parsing)
  },
  referrer: {
    type: String, // e.g., "https://google.com"
  },
  country: {
    type: String, // e.g., "India"
  },
  city: {
    type: String, // e.g., "Bangalore"
  },
  timestamp: {
    type: Date,
    default: Date.now, // Record time of visit
    index: true,       // Useful for time-based analytics queries
  },
}, { timestamps: true });

const VisitHistory = mongoose.model('visitHistory', visitHistorySchema);

module.exports = VisitHistory;