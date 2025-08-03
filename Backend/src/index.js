const config = require('./config/index.js');

const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const { connectMongoDB } = require('./connection.js');
const urlRoute = require('./routes/url.route.js');
const authRoute = require('./routes/auth.route.js');
const { checkAuth, checkRole } = require('./middlewares/auth.middleware.js');
const { adminRoutes } = require('./routes/admin.route.js');
const refreshRouter = require('./routes/refreshAccess.route.js');
const { redirectRoute } = require('./routes/redirectUrl.route.js');
const morgan = require('morgan');

const PORT = config.port;

// MongoDB connect
connectMongoDB(config.dbUrl)
  .then(() => console.log('MongoDB connected.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); 
app.use(morgan('dev'));

// Routes
app.use('/api/url', checkAuth, urlRoute); // ✅ protected
app.use('/r',redirectRoute);
app.use('/api/auth', authRoute);
app.use('/api/refresh-access',refreshRouter);
app.use('/api/admin',checkAuth,checkRole,adminRoutes);

// Handle 404 - Not Found
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => console.log(`Server started at port: ${PORT}`));