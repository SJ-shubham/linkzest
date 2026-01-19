const { nanoid } = require('nanoid');
const URL = require('../models/url.model');
const Folder = require('../models/folder.model');

const handleGenerateNewShortURL = async (req, res) => {
  try {
    const { redirectURL, customShortId } = req.body;
    const userId = req.user._id;

    // Check if redirect URL is provided
    if (!redirectURL) {
      return res.status(400).json({ error: 'Destination URL is required.' });
    }

    // Normalize URL to include protocol if missing
    const normalizedURL = !redirectURL.match(/^[a-zA-Z]+:\/\//)
      ? `https://${redirectURL}` 
      : redirectURL;
    
    // Validate URL format (basic validation)
    try {
      new URL(normalizedURL);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    let finalShortId;

    // Handle custom ID if provided
    if (customShortId) {
      // Validate custom short ID
      const isValid = /^[a-zA-Z0-9_-]{3,8}$/.test(customShortId);
      if (!isValid) {
        return res.status(400).json({
          error: 'Custom ID must be 3–8 characters, letters, numbers, dashes, or underscores.',
        });
      }

      // Check global uniqueness with case-insensitive search
      const exists = await URL.findOne({ 
        shortId: { $regex: new RegExp(`^${customShortId}$`, 'i') } 
      });
      
      if (exists) {
        return res.status(400).json({ error: 'Custom short ID is already in use.' });
      }

      finalShortId = customShortId;
    } else {
      // Generate unique random short ID efficiently
      finalShortId = await generateUniqueShortId();
    }

    // Save the new short URL
    const newUrl = new URL({
      shortId: finalShortId,
      redirectURL: normalizedURL,
      createdBy: userId,
      isActive: true,
      isDeleted: false,
      expirationDate: null,
      createdAt: new Date(),
    });

    await newUrl.save();

    // Format and return response
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    
    return res.status(201).json({
      message: 'Short URL created successfully',
      data: {
        ...newUrl.toObject(),
        shortUrl: `${appBaseUrl}/${finalShortId}`
      }
    });

  } catch (error) {
    console.error('Error creating short URL:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * Generate a unique short ID efficiently
 */
const generateUniqueShortId = async (length = 8) => {
  let isUnique = false;
  let generatedId;

  while (!isUnique) {
    generatedId = nanoid(length);
    // Use exists query for better performance
    const exists = await URL.exists({ shortId: generatedId });
    if (!exists) {
      isUnique = true;
    }
  }

  return generatedId;
};

const handleEditUrl = async (req, res) => {
  const { shortId } = req.params;
  const userId = req.user._id;
  const { newDestinationUrl, newCustomShortID, expirationDate, folderId } = req.body;

  try {
    const urlDoc = await URL.findOne({ shortId, createdBy: userId });
    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found' });
    }
    // Update destination URL
    if (newDestinationUrl) {
      urlDoc.redirectURL = newDestinationUrl;
    }

    // Update custom short ID
    if (newCustomShortID && newCustomShortID !== shortId) {
      const isValidShortId = /^[a-zA-Z0-9_-]{3,8}$/.test(newCustomShortID);
      if (!isValidShortId) {
        return res.status(400).json({
          error: 'Short ID must be 3–8 characters, and contain only letters, numbers, dashes, or underscores.',
        });
      }

      const exists = await URL.exists({ shortId: newCustomShortID });
      if (exists) {
        return res.status(400).json({ error: 'Short ID already in use' });
      }

      urlDoc.shortId = newCustomShortID;
    }

    // Set or update expiration date
    if (expirationDate) {
      const date = new Date(expirationDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid expirationDate format' });
      }
      urlDoc.expirationDate = date;
    }

// --- Handle Folder 
    if (folderId !== undefined && urlDoc.folder?.toString() !== folderId) {
        // Unassign from the current folder (if one exists)
        if (urlDoc.folderId) {
          await Folder.updateOne(
            { _id: urlDoc.folderId, createdBy: userId },
            { $pull: { urls: urlDoc._id } }
          );
        }

        if (folderId) {
          // Check if target folder exists and belongs to user
          const targetFolder = await Folder.findOne({ _id: folderId, createdBy: userId });
          if (!targetFolder) {
            return res.status(404).json({ error: 'Target folder not found or unauthorized.' });
          }

          // Add URL to the new folder and update the URL document
          await Folder.updateOne(
            { _id: folderId, createdBy: userId },
            { $addToSet: { urls: urlDoc._id } }
          );
          urlDoc.folderId = folderId;
        } else {
          // If folderId is null/empty/undefined, unassign folder
          urlDoc.folderId = null;
        }
    }

    await urlDoc.save();

    return res.status(200).json({ message: 'URL updated successfully', data: urlDoc });
  } catch (error) {
    console.error('Error editing URL:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const handleUrlStatus=async(req,res)=>{
  const {shortId}=req.params;
  const {action}=req.body;
  const userId=req.user._id;

  if(!['activate','deactivate'].includes(action)){
    return res.status(400).json({error:'Use "activate" or "deactivate".'});
  }
  try {
    const urlDoc= await URL.findOne({shortId,createdBy:userId});
    if(!urlDoc){
      return res.status(404).json({error:'Url not found.'});
    }
    const newStatus=action==='activate';

    if(urlDoc.isActive===newStatus){
      return res.status(200).json({message:`link is already ${action}d.`});
    }
    urlDoc.isActive=newStatus;

    await urlDoc.save();
    res.status(200).json({
    message: `Link ${action}d successfully.`,
    data: urlDoc,});

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const handleDeleteUrl = async (req, res) => {
  const { shortId } = req.params;
  const { mode } = req.body;
  const userId = req.user._id;

  if (!["trash", "permanent"].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use "trash" or "permanent".' });
  }

  try {
    const urlDoc = await URL.findOne({ shortId, createdBy: userId });

    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found or unauthorized' });
    }

    if (mode === "trash") {
      if (urlDoc.isDeleted) {
        return res.status(400).json({ message: 'Link is already in Trash.' });
      }

      urlDoc.isDeleted = true;
      urlDoc.deletedAt = new Date();
      await urlDoc.save();

      return res.status(200).json({ message: 'Link moved to Trash successfully.' });
    }

    if (mode === "permanent") {
      await URL.deleteOne({ _id: urlDoc._id });
      return res.status(200).json({ message: 'Link permanently deleted.' });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const handleListUserUrls = async (req, res) => {
  try {
    // The userId comes from `checkAuth` middleware (decoded JWT)
    const userId = req.user._id;

    // Fetch all URLs created by this user (exclude trashed by default)
    const urls = await URL.find({
      createdBy: userId,
      isDeleted: false
    })
      .select('-__v') // exclude version key
      .sort({ createdAt: -1 }); // latest first

    return res.status(200).json({
      message: 'URLs fetched successfully',
      count: urls.length,
      data: urls,
    });
  } catch (error) {
    console.error('Error fetching user URLs:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};

module.exports = { handleListUserUrls };

module.exports = {
  handleGenerateNewShortURL,
  handleEditUrl,
  handleUrlStatus,
  handleDeleteUrl,
  handleListUserUrls,
};