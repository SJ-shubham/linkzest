const Folder = require('../models/folder.model');
const URL = require('../models/url.model'); // Fix import - don't use destructuring

// Create Folder
const handleCreateFolder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Trim name to avoid whitespace-only issues
    const trimmedName = name.trim();
    
    // Check for duplicate with trimmed name
    const existing = await Folder.findOne({ 
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },  // Case-insensitive
      createdBy: userId, 
      isDeleted: false 
    });
    
    if (existing) {
      return res.status(409).json({ error: 'Folder with this name already exists' }); // 409 Conflict
    }

    const folder = new Folder({
      name: trimmedName,
      description: description?.trim() || '',
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(), // Add updatedAt field
      urls: []
    });

    await folder.save();

    return res.status(201).json({
      message: 'Folder created successfully',
      data: folder,
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// List Folders
const handleListFolders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    // Convert page and limit to integers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Validate sort options
    const allowedSortFields = ['name', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    
    // Create sort object
    const sortOptions = { [sortField]: sortOrder };
    
    // Use aggregation to get folder count in one query
    const folders = await Folder.aggregate([
      { $match: { createdBy: userId, isDeleted: false } },
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'urls', // Adjust if your collection name is different
          localField: 'urls',
          foreignField: '_id',
          as: 'urlDetails'
        }
      },
      {
        $addFields: {
          urlCount: { 
            $size: {
              $filter: {
                input: "$urlDetails",
                as: "url",
                cond: { $eq: ["$$url.isDeleted", false] }
              }
            }
          }
        }
      },
      { $project: { urlDetails: 0 } } // Remove the joined URL objects
    ]);
    
    // Get total count for pagination
    const totalFolders = await Folder.countDocuments({ createdBy: userId, isDeleted: false });

    return res.status(200).json({
      message: 'Folders fetched successfully',
      data: folders,
      pagination: {
        total: totalFolders,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalFolders / limitNum)
      }
    });
  } catch (error) {
    console.error('Error listing folders:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Folder Details
const handleGetFolderDetails = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;
    
    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid folder ID format' });
    }

    const folder = await Folder.findOne({
      _id: folderId,
      createdBy: userId,
      isDeleted: false
    }).populate({
      path: 'urls',
      match: { isDeleted: false },
      select: '-__v', // Exclude version field
      options: { sort: { createdAt: -1 } } // Sort URLs by creation date
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found or unauthorized' });
    }
    
    // Get statistics about URLs in this folder
    const urlStats = {
      total: folder.urls.length,
      active: folder.urls.filter(url => url.isActive).length,
      clicks: folder.urls.reduce((sum, url) => sum + (url.clickCount || 0), 0)
    };

    return res.status(200).json({
      message: 'Folder details fetched successfully',
      data: {
        ...folder.toObject(),
        urlStats
      }
    });
  } catch (error) {
    console.error('Error fetching folder details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Edit Folder
const handleEditFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;
    const { name, description } = req.body;
    
    // Validate ObjectId format
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid folder ID format' });
    }
    
    // Check that at least one field to update is provided
    if (name === undefined && description === undefined) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    const folder = await Folder.findOne({ 
      _id: folderId, 
      createdBy: userId, 
      isDeleted: false 
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found or unauthorized' });
    }

    // Update name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Folder name is required and must be a string' });
      }
      
      const trimmedName = name.trim();
      
      // Only check for duplicates if name is actually changing
      if (trimmedName !== folder.name) {
        const exists = await Folder.findOne({ 
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }, // Case-insensitive
          createdBy: userId, 
          _id: { $ne: folderId },
          isDeleted: false
        });
        
        if (exists) {
          return res.status(409).json({ error: 'A folder with this name already exists' });
        }
        folder.name = trimmedName;
      }
    }

    // Update description if provided
    if (description !== undefined) {
      folder.description = description?.trim() || '';
    }

    // Update the modified timestamp
    folder.updatedAt = new Date();

    await folder.save();

    return res.status(200).json({
      message: 'Folder updated successfully',
      data: folder,
    });
  } catch (error) {
    console.error('Error editing folder:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Folder
const handleDeleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { mode } = req.body;
    const userId = req.user._id;
    
    // Validate input parameters
    if (!folderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid folder ID format' });
    }

    if (!['trash', 'permanent'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Use "trash" or "permanent"' });
    }

    const folder = await Folder.findOne({ _id: folderId, createdBy: userId });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found or unauthorized' });
    }

    const urlIds = folder.urls || [];
    let message;

    if (mode === 'trash') {
      if (folder.isDeleted) {
        return res.status(400).json({ error: 'Folder is already in Trash' });
      }

      folder.isDeleted = true;
      folder.deletedAt = new Date();
      await folder.save();

      // Only update URLs that aren't already deleted
      const result = await URL.updateMany(
        { _id: { $in: urlIds }, createdBy: userId, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      );

      message = `Folder moved to Trash. ${result.modifiedCount} URLs were also moved to Trash.`;
    } else if (mode === 'permanent') {
      if (folder.isDeleted) {
        // Delete URLs that are in this folder and already trashed
        await URL.deleteMany({ 
          _id: { $in: urlIds }, 
          createdBy: userId,
          isDeleted: true 
        });
        
        // Folder is already in trash, so delete it
        await Folder.deleteOne({ _id: folder._id });
        message = 'Folder and its URLs have been permanently deleted';
      } else {
        // Direct permanent delete (not from trash)
        await URL.deleteMany({ _id: { $in: urlIds }, createdBy: userId });
        await Folder.deleteOne({ _id: folder._id });
        message = 'Folder and all its URLs have been permanently deleted';
      }
    }

    return res.status(200).json({ message });
  } catch (err) {
    console.error('Error deleting folder:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  handleCreateFolder,
  handleListFolders,
  handleGetFolderDetails,
  handleEditFolder,
  handleDeleteFolder,
};
