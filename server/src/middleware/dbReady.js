const mongoose = require('mongoose');

module.exports = (req, res, next) => {
  // Allow health and tracking endpoints without DB
  if (req.path.startsWith('/health') || req.path.startsWith('/tracking')) return next();

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'Service unavailable - database not connected' });
  }

  next();
};