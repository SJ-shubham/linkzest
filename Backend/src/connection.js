const mongoose = require('mongoose');
const config = require('./config/index');

const url=config.dbUrl;

// Connect to MongoDB and handle connection errors
const connectMongoDB = async (url) => {
    try {
        await mongoose.connect(url);
        console.log('Connected to MongoDB successfully.');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1); // Exit the app if DB connection fails
    }
};

module.exports = { connectMongoDB };