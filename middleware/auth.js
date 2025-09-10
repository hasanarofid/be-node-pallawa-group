const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware untuk verifikasi JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token akses diperlukan' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Token tidak valid' 
      });
    }
    req.user = user;
    next();
  });
};

// Middleware untuk verifikasi admin
const authenticateAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya admin yang diizinkan' 
    });
  }
  next();
};

// Middleware untuk verifikasi mitra
const authenticateMitra = (req, res, next) => {
  if (req.user.role !== 'mitra') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya mitra yang diizinkan' 
    });
  }
  next();
};

// Middleware untuk verifikasi customer
const authenticateCustomer = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya customer yang diizinkan' 
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  authenticateMitra,
  authenticateCustomer
};
