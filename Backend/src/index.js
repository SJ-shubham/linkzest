const config = require('./config/index.js');
const { connectMongoDB } = require('./connection.js');
const cors = require('cors'); 

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { checkAuth, checkRole } = require('./middlewares/auth.middleware.js');


// Import routes
const authRoute = require('./routes/auth.route.js');
const refreshRouter = require('./routes/refreshAccess.route.js');
const userRouter = require('./routes/user.route.js');
const urlRouter = require('./routes/url.route.js');
const folderRouter = require('./routes/folderUrl.route.js');
const analyticsRouter = require('./routes/analyticsUrl.route.js');
const recycleBinRouter = require('./routes/recycleBin.route.js');
const adminRoutes = require('./routes/admin.route.js');
const redirectRoute = require('./routes/redirectUrl.route.js');

const app = express();
const PORT = config.port;

// MongoDB connect
connectMongoDB(config.dbUrl)
  .then(() => console.log('MongoDB connected.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Security middleware
app.use(helmet()); // Add security headers

app.use(cors({
  origin: 'http://localhost:5173', // Your React URL
  credentials: true
}));

app.use(cookieParser());
app.use(express.json()); // parse application/json bodies
app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded bodies (optional)


// Logging middleware
app.use(morgan('dev'));

// Auth routes (public for signup/login/logout)
app.use('/api/auth', authRoute);
app.use('/api/refresh', refreshRouter);

// User routes (protected: profile management)
app.use('/api/user', checkAuth, userRouter);

// URL routes (protected: only logged-in users can manage their URLs)
app.use('/api/url', checkAuth, urlRouter);

// Folder routes (protected: folder management tied to user)
app.use('/api/folder', checkAuth, folderRouter);

// Analytics routes (protected: analytics is per-user URLs only)
app.use('/api/analytics', checkAuth, analyticsRouter);

// Recycle Bin routes (protected: manage deleted items)
app.use('/api/recycle-bin', checkAuth, recycleBinRouter);

// Redirect routes (public: anyone with shortId can be redirected)
app.use('/r', redirectRoute);

// Admin routes (restricted: must be logged-in AND admin role)
app.use('/api/admin', checkAuth, checkRole("admin"), adminRoutes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server started at port: ${PORT}`);
});