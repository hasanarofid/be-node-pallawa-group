const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register Customer
router.post('/register', [
  body('name').notEmpty().withMessage('Nama harus diisi'),
  body('phone').isMobilePhone('id-ID').withMessage('Nomor HP tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { name, phone, password, email } = req.body;

    // Cek apakah phone sudah terdaftar
    const [existingUser] = await db.promise().execute(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Nomor HP sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user baru
    const [result] = await db.promise().execute(
      'INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)',
      [name, phone, email || null, hashedPassword]
    );

    // Generate token
    const token = generateToken({
      id: result.insertId,
      phone,
      role: 'customer'
    });

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user: {
          id: result.insertId,
          name,
          phone,
          email
        },
        token
      }
    });
  } catch (error) {
    console.error('Error register:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Login Customer
router.post('/login', [
  body('phone').isMobilePhone('id-ID').withMessage('Nomor HP tidak valid'),
  body('password').notEmpty().withMessage('Password harus diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { phone, password } = req.body;

    // Cari user
    const [users] = await db.promise().execute(
      'SELECT * FROM users WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Nomor HP atau password salah'
      });
    }

    const user = users[0];

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Nomor HP atau password salah'
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      phone: user.phone,
      role: 'customer'
    });

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email
        },
        token
      }
    });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Google OAuth Login/Register
router.post('/google', [
  body('token').notEmpty().withMessage('Google token harus diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { token } = req.body;

    // Verifikasi Google token
    const googleUser = await verifyGoogleToken(token);

    // Cek apakah user sudah terdaftar
    const [existingUser] = await db.promise().execute(
      'SELECT * FROM users WHERE google_id = ? OR email = ?',
      [googleUser.googleId, googleUser.email]
    );

    let user;
    if (existingUser.length > 0) {
      // Update google_id jika belum ada
      if (!existingUser[0].google_id) {
        await db.promise().execute(
          'UPDATE users SET google_id = ? WHERE id = ?',
          [googleUser.googleId, existingUser[0].id]
        );
      }
      user = existingUser[0];
    } else {
      // Register user baru
      const [result] = await db.promise().execute(
        'INSERT INTO users (name, email, google_id) VALUES (?, ?, ?)',
        [googleUser.name, googleUser.email, googleUser.googleId]
      );

      user = {
        id: result.insertId,
        name: googleUser.name,
        email: googleUser.email,
        google_id: googleUser.googleId
      };
    }

    // Generate token
    const jwtToken = generateToken({
      id: user.id,
      email: user.email,
      role: 'customer'
    });

    res.json({
      success: true,
      message: 'Login Google berhasil',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone
        },
        token: jwtToken
      }
    });
  } catch (error) {
    console.error('Error Google auth:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Register Mitra
router.post('/mitra/register', [
  body('name').notEmpty().withMessage('Nama harus diisi'),
  body('phone').isMobilePhone('id-ID').withMessage('Nomor HP tidak valid'),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  body('address').notEmpty().withMessage('Alamat harus diisi'),
  body('service_type').isIn(['massage', 'cleaning', 'ac_service']).withMessage('Tipe layanan tidak valid')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { name, phone, password, email, address, service_type } = req.body;

    // Cek apakah phone sudah terdaftar
    const [existingMitra] = await db.promise().execute(
      'SELECT id FROM mitra WHERE phone = ?',
      [phone]
    );

    if (existingMitra.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Nomor HP sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert mitra baru
    const [result] = await db.promise().execute(
      'INSERT INTO mitra (name, phone, email, password, address, service_type) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, email || null, hashedPassword, address, service_type]
    );

    res.status(201).json({
      success: true,
      message: 'Registrasi mitra berhasil. Menunggu verifikasi admin.',
      data: {
        mitra: {
          id: result.insertId,
          name,
          phone,
          email,
          address,
          service_type,
          is_verified: false
        }
      }
    });
  } catch (error) {
    console.error('Error register mitra:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Login Mitra
router.post('/mitra/login', [
  body('phone').isMobilePhone('id-ID').withMessage('Nomor HP tidak valid'),
  body('password').notEmpty().withMessage('Password harus diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { phone, password } = req.body;

    // Cari mitra
    const [mitra] = await db.promise().execute(
      'SELECT * FROM mitra WHERE phone = ?',
      [phone]
    );

    if (mitra.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Nomor HP atau password salah'
      });
    }

    const mitraData = mitra[0];

    // Cek apakah mitra sudah diverifikasi
    if (!mitraData.is_verified) {
      return res.status(401).json({
        success: false,
        message: 'Akun mitra belum diverifikasi oleh admin'
      });
    }

    // Cek apakah mitra aktif
    if (!mitraData.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Akun mitra tidak aktif'
      });
    }

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, mitraData.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Nomor HP atau password salah'
      });
    }

    // Generate token
    const token = generateToken({
      id: mitraData.id,
      phone: mitraData.phone,
      role: 'mitra'
    });

    res.json({
      success: true,
      message: 'Login mitra berhasil',
      data: {
        mitra: {
          id: mitraData.id,
          name: mitraData.name,
          phone: mitraData.phone,
          email: mitraData.email,
          address: mitraData.address,
          service_type: mitraData.service_type,
          is_verified: mitraData.is_verified
        },
        token
      }
    });
  } catch (error) {
    console.error('Error login mitra:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Login Admin
router.post('/admin/login', [
  body('username').notEmpty().withMessage('Username harus diisi'),
  body('password').notEmpty().withMessage('Password harus diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak valid',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Cari admin
    const [admin] = await db.promise().execute(
      'SELECT * FROM admin WHERE username = ?',
      [username]
    );

    if (admin.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    const adminData = admin[0];

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, adminData.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah'
      });
    }

    // Generate token
    const token = generateToken({
      id: adminData.id,
      username: adminData.username,
      role: 'admin'
    });

    res.json({
      success: true,
      message: 'Login admin berhasil',
      data: {
        admin: {
          id: adminData.id,
          username: adminData.username,
          email: adminData.email
        },
        token
      }
    });
  } catch (error) {
    console.error('Error login admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get profile user yang sedang login
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role === 'customer') {
      const [users] = await db.promise().execute(
        'SELECT id, name, phone, email, address FROM users WHERE id = ?',
        [id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }

      res.json({
        success: true,
        data: { user: users[0] }
      });
    } else if (role === 'mitra') {
      const [mitra] = await db.promise().execute(
        'SELECT id, name, phone, email, address, service_type, is_verified, is_active FROM mitra WHERE id = ?',
        [id]
      );
      
      if (mitra.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Mitra tidak ditemukan'
        });
      }

      res.json({
        success: true,
        data: { mitra: mitra[0] }
      });
    } else if (role === 'admin') {
      const [admin] = await db.promise().execute(
        'SELECT id, username, email FROM admin WHERE id = ?',
        [id]
      );
      
      if (admin.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Admin tidak ditemukan'
        });
      }

      res.json({
        success: true,
        data: { admin: admin[0] }
      });
    }
  } catch (error) {
    console.error('Error get profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
