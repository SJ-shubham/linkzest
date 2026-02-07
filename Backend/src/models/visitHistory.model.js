const mongoose = require('mongoose');

const visitHistorySchema = new mongoose.Schema({
  urlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'url',
    required: true,
    index: true,
  },
  visitorIP: {
    type: String,
  },
  deviceType: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  referrer: {
    type: String,
  },
  country: {
    type: String,
  },
  city: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

const VisitHistory = mongoose.model('visitHistory', visitHistorySchema);

module.exports = VisitHistory;