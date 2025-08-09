const { nanoid } = require('nanoid');
const { URL } = require('../models/url.model');

const handleGenerateNewShortURL = async (req, res) => {
  try {
    const { redirectURL, customShortId } = req.body;
    const userId = req.user._id;

    //Check if redirect URL is provided
    if (!redirectURL) {
      return res.status(400).json({ error: 'Destination URL is required.' });
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

      // Check global uniqueness
      const exists = await URL.findOne({ shortId: customShortId });
      if (exists) {
        return res.status(400).json({ error: 'Custom short ID is already in use.' });
      }

      finalShortId = customShortId;
    } else {
      //Generate unique random short ID
      let isUnique = false;
      let generatedId;

      while (!isUnique) {
        generatedId = nanoid(8);
        const exists = await URL.findOne({ shortId: generatedId });
        if (!exists) {
          isUnique = true;
        }
      }

      finalShortId = generatedId;
    }

    //Save the new short URL
    const newUrl = await URL.create({
      shortId: finalShortId,
      redirectURL: redirectURL,
      visitHistory: [],
      createdBy: userId,
      isActive: true,        // optional default
      isDeleted: false,      // optional default
      expirationDate: null,  // optional default
    });

    return res.status(201).json({
      message: 'Short URL created successfully',
      data: newUrl,
    });

  } catch (error) {
    console.error('Error creating short URL:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const handleRedirect = async (req, res) => {
  try {
    const { shortId } = req.params;

    const urlDoc = await URL.findOne({ shortId });

    if (!urlDoc) {
      return res.status(404).send('URL not found');
    }

    //Check if link is deleted
    if (urlDoc.isDeleted) {
      return res.status(410).send('This link has been deleted.');
    }

    //Check if link is paused
    if (!urlDoc.isActive) {
      return res.status(403).send('This link is paused.');
    }

    //Check if link has expired
    if (urlDoc.expirationDate && new Date() > urlDoc.expirationDate) {
      return res.status(410).send('This link has expired.');
    }

    //Passed all checks — log visit
    await URL.updateOne(
      { _id: urlDoc._id },
      {
        $push: { visitHistory: { timestamp: new Date() } }
      }
    );

    //Redirect to the original long URL
    res.redirect(302, urlDoc.redirectURL);

  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
};

const handleAnalytics = async (req, res) => {
  const userId = req.user._id;

  try {
    const urls = await URL.find({ createdBy: userId });

    if (!urls || urls.length === 0) {
      return res.status(404).json({ error: 'No URLs found for this user' });
    }

    const analytics = urls.map((url) => {
      const totalVisits = url.visitHistory.length;
      const lastVisited = totalVisits > 0
        ? new Date(url.visitHistory[totalVisits - 1].timestamp)
        : null;

      const isExpired = url.expirationDate
        ? new Date() > new Date(url.expirationDate)
        : false;

      return {
        shortId: url.shortId,
        shortUrl: `${process.env.BASE_URL || 'https://yourdomain.com'}/${url.shortId}`,
        redirectURL: url.redirectURL,
        createdAt: url.createdAt,
        isActive: url.isActive,
        isDeleted: url.isDeleted,
        isExpired,
        expirationDate: url.expirationDate || null,
        totalVisits,
        lastVisited,
      };
    });

    return res.status(200).json({ message: 'Analytics fetched successfully', data: analytics });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const handleEditUrl = async (req, res) => {
  const { shortId } = req.params;
  const userId = req.user._id;
  const { newDestinationUrl, newCustomShortID, expirationDate } = req.body;

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

      const exists = await URL.findOne({ shortId: newCustomShortID });
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

    await urlDoc.save();

    res.status(200).json({ message: 'URL updated successfully', data: urlDoc });
  } catch (error) {
    console.error(error);
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

const handleDeleteMode = async (req, res) => {
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

module.exports = {
  handleGenerateNewShortURL,
  handleRedirect,
  handleAnalytics,
  handleEditUrl,
  handleUrlStatus,
  handleDeleteMode
};