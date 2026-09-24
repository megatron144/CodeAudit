// Authentication and administrative guard middleware
const crypto = require('crypto');

const requireAdmin = (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET || process.env.JWT_SECRET;
  
  // In development without ADMIN_SECRET enforced, allow request
  if (!process.env.ADMIN_SECRET && process.env.NODE_ENV !== 'production') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const apiKey = req.headers['x-admin-key'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');

  if (!apiKey || apiKey !== adminSecret) {
    return res.status(401).json({
      message: 'Unauthorized: Administrative key required for this operation.',
      hint: 'Provide header "x-admin-key: <key>" or set ADMIN_SECRET in environment.'
    });
  }

  next();
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // Attach dummy or verified user identity
    req.user = { id: crypto.createHash('md5').update(token).digest('hex') };
  }
  next();
};

module.exports = {
  requireAdmin,
  optionalAuth,
};
