const { URL } = require('../models/url.model.js');
const {User}=require('../models/users.model.js');

const handleAdminPanel = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const users = await User.find().lean();

    const urls = await URL.find()
      .populate({ path: 'createdBy', model: 'User', select: 'username email role' })
      .lean();

    res.status(200).json({ users, urls, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

module.exports={
    handleAdminPanel,
}