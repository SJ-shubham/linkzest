const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,       // e.g., "College Projects" or "Marketing Campaign"
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',          // Folder belongs to a user
    required: true,
  },
  urls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'url',           // Array of short URLs in this folder
  }],
  // 🔹 New fields for soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  }
}, { timestamps: true });

const Folder = mongoose.model('folder', folderSchema);

module.exports = Folder;