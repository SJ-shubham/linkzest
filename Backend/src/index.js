const config = require('./config/index.js');
const { connectMongoDB } = require('./connection.js');

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { checkAuth, checkRole } = require('./middlewares/auth.middleware.js');


// Import routes
const authRoute = require('./routes/auth.route.js');
const refreshRouter = require('./routes/refreshAccess.route.js');
const urlRouter = require('./routes/url.route.js');
const folderRouter = require('./routes/folderUrl.route.js');
const analyticsRouter = require('./routes/analyticsUrl.route.js');
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

app.use(cookieParser());

// Logging middleware
app.use(morgan('dev'));

// Auth routes (public for signup/login/refresh)
app.use('/api/auth', authRoute);  
app.use('/api/refresh', refreshRouter);

app.use('/api/url', checkAuth, urlRouter);      // URL routes (protected: only logged-in users can manage their URLs)

app.use('/api/folder', checkAuth, folderRouter);    // Folder routes (protected: folder management tied to user)

app.use('/api/analytics', checkAuth, analyticsRouter);    // Analytics routes (protected: analytics is per-user URLs only)

app.use('/r', redirectRoute);    // Redirect routes (public: anyone with shortId can be redirected)

app.use('/api/admin', checkAuth, checkRole("admin"), adminRoutes);    // Admin routes (restricted: must be logged-in AND admin role)

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server started at port: ${PORT}`);
});