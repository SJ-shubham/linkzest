const { nanoid } = require('nanoid');
const { URL } = require('../models/url.model');

const handleGenerateNewShortURL = async (req, res) => {

  try {
    const {redirectURL} = req.body;
    if (!redirectURL) return res.status(400).json({ error: 'URL is required' });

    const shortId = nanoid(8);

  const newUrl=await URL.create({
    shortId: shortId,
    redirectURL:redirectURL,
    visitHistory: [],
    createdBy: req.user._id,
  });

  return res.status(201).json({msg:'Short URL created',url:newUrl});
  } catch(error) {
    console.error('Error creating short URL:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const handleRedirect = async (req, res) => {
  try {
    const { shortId } = req.params;

    const urlDoc = await URL.findOneAndUpdate(
      { shortId },
      {
        $push: { visitHistory: { timestamp: Date.now() } }
      },
      { new: true }
    );

    if (!urlDoc) {
      return res.status(404).send('Short URL not found');
    }

    // Redirect to the original long URL
    res.redirect(302, urlDoc.redirectURL);

  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
};

const handleAnalytics = async (req, res) => {
  const userId=req.user._id;

  try {
    const urls = await URL.find({createdBy:userId});

    if (urls.length==0){
      return res.status(404).json({ error: 'No URLs found for this user'});
    }

    return res.status(200).json({urls});
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  handleGenerateNewShortURL,
  handleRedirect,
  handleAnalytics,
};