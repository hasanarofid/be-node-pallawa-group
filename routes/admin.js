const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { sendNotificationToUser, sendNotificationToMitra } = require('../utils/notification');

const router = express.Router();

// Middleware untuk memastikan hanya admin yang bisa akses
router.use(authenticateToken, authenticateAdmin);

// Get semua users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    let query = 'SELECT id, name, phone, email, address, created_at FROM users WHERE 1=1';
    const params = [];
    
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC';
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [users] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error get users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get semua mitra
router.get('/mitra', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, service_type, is_verified } = req.query;
    
    let query = 'SELECT id, name, phone, email, address, service_type, is_verified, is_active, created_at FROM mitra WHERE 1=1';
    const params = [];
    
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (service_type) {
      query += ' AND service_type = ?';
      params.push(service_type);
    }
    
    if (is_verified !== undefined) {
      query += ' AND is_verified = ?';
      params.push(is_verified === 'true');
    }
    
    query += ' ORDER BY created_at DESC';
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [mitra] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM mitra WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (service_type) {
      countQuery += ' AND service_type = ?';
      countParams.push(service_type);
    }
    
    if (is_verified !== undefined) {
      countQuery += ' AND is_verified = ?';
      countParams.push(is_verified === 'true');
    }
    
    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        mitra,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error get mitra:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Verifikasi mitra
router.put('/mitra/:id/verify', [
  body('is_verified').isBoolean().withMessage('Status verifikasi harus boolean')
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

    const { id } = req.params;
    const { is_verified } = req.body;

    // Cek apakah mitra ada
    const [mitra] = await db.promise().execute(
      'SELECT * FROM mitra WHERE id = ?',
      [id]
    );

    if (mitra.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mitra tidak ditemukan'
      });
    }

    // Update status verifikasi
    await db.promise().execute(
      'UPDATE mitra SET is_verified = ? WHERE id = ?',
      [is_verified, id]
    );

    // Kirim notifikasi ke mitra
    const message = is_verified 
      ? 'Selamat! Akun mitra Anda telah diverifikasi. Anda sekarang dapat login dan menerima pesanan.'
      : 'Akun mitra Anda belum diverifikasi. Silakan hubungi admin untuk informasi lebih lanjut.';

    await sendNotificationToMitra(
      id,
      is_verified ? 'Akun Diverifikasi' : 'Verifikasi Ditolak',
      message,
      'general'
    );

    res.json({
      success: true,
      message: `Mitra berhasil ${is_verified ? 'diverifikasi' : 'ditolak'}`
    });
  } catch (error) {
    console.error('Error verify mitra:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Aktifkan/nonaktifkan mitra
router.put('/mitra/:id/status', [
  body('is_active').isBoolean().withMessage('Status aktif harus boolean')
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

    const { id } = req.params;
    const { is_active } = req.body;

    // Cek apakah mitra ada
    const [mitra] = await db.promise().execute(
      'SELECT * FROM mitra WHERE id = ?',
      [id]
    );

    if (mitra.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mitra tidak ditemukan'
      });
    }

    // Update status aktif
    await db.promise().execute(
      'UPDATE mitra SET is_active = ? WHERE id = ?',
      [is_active, id]
    );

    // Kirim notifikasi ke mitra
    const message = is_active 
      ? 'Akun mitra Anda telah diaktifkan kembali.'
      : 'Akun mitra Anda telah dinonaktifkan. Silakan hubungi admin untuk informasi lebih lanjut.';

    await sendNotificationToMitra(
      id,
      is_active ? 'Akun Diaktifkan' : 'Akun Dinonaktifkan',
      message,
      'general'
    );

    res.json({
      success: true,
      message: `Mitra berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`
    });
  } catch (error) {
    console.error('Error update mitra status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get semua pesanan
router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, service_type, date_from, date_to } = req.query;
    
    let query = `
      SELECT o.*, s.name as service_name, s.type as service_type,
             u.name as customer_name, u.phone as customer_phone,
             m.name as mitra_name, m.phone as mitra_phone
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN mitra m ON o.mitra_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    if (service_type) {
      query += ' AND s.type = ?';
      params.push(service_type);
    }
    
    if (date_from) {
      query += ' AND DATE(o.created_at) >= ?';
      params.push(date_from);
    }
    
    if (date_to) {
      query += ' AND DATE(o.created_at) <= ?';
      params.push(date_to);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [orders] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM orders o
      JOIN services s ON o.service_id = s.id
      WHERE 1=1
    `;
    const countParams = [];
    
    if (status) {
      countQuery += ' AND o.status = ?';
      countParams.push(status);
    }
    
    if (service_type) {
      countQuery += ' AND s.type = ?';
      countParams.push(service_type);
    }
    
    if (date_from) {
      countQuery += ' AND DATE(o.created_at) >= ?';
      countParams.push(date_from);
    }
    
    if (date_to) {
      countQuery += ' AND DATE(o.created_at) <= ?';
      countParams.push(date_to);
    }
    
    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error get orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get detail pesanan
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await db.promise().execute(
      `SELECT o.*, s.name as service_name, s.type as service_type, s.description as service_description,
              u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
              m.name as mitra_name, m.phone as mitra_phone, m.email as mitra_email
       FROM orders o
       JOIN services s ON o.service_id = s.id
       JOIN users u ON o.user_id = u.id
       LEFT JOIN mitra m ON o.mitra_id = m.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: { order: orders[0] }
    });
  } catch (error) {
    console.error('Error get order detail:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Kelola layanan
router.get('/services', async (req, res) => {
  try {
    const [services] = await db.promise().execute(
      'SELECT * FROM services ORDER BY type, name'
    );

    res.json({
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Error get services:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Tambah layanan baru
router.post('/services', [
  body('name').notEmpty().withMessage('Nama layanan harus diisi'),
  body('type').isIn(['massage', 'cleaning', 'ac_service']).withMessage('Tipe layanan tidak valid'),
  body('description').optional().isString(),
  body('base_price').isFloat({ min: 0 }).withMessage('Harga dasar harus berupa angka positif')
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

    const { name, type, description, base_price } = req.body;

    const [result] = await db.promise().execute(
      'INSERT INTO services (name, type, description, base_price) VALUES (?, ?, ?, ?)',
      [name, type, description || null, base_price]
    );

    res.status(201).json({
      success: true,
      message: 'Layanan berhasil ditambahkan',
      data: {
        service: {
          id: result.insertId,
          name,
          type,
          description,
          base_price
        }
      }
    });
  } catch (error) {
    console.error('Error add service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update layanan
router.put('/services/:id', [
  body('name').optional().notEmpty().withMessage('Nama layanan tidak boleh kosong'),
  body('type').optional().isIn(['massage', 'cleaning', 'ac_service']).withMessage('Tipe layanan tidak valid'),
  body('description').optional().isString(),
  body('base_price').optional().isFloat({ min: 0 }).withMessage('Harga dasar harus berupa angka positif'),
  body('is_active').optional().isBoolean().withMessage('Status aktif harus boolean')
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

    const { id } = req.params;
    const { name, type, description, base_price, is_active } = req.body;

    // Build update query
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type) {
      updates.push('type = ?');
      params.push(type);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (base_price) {
      updates.push('base_price = ?');
      params.push(base_price);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data yang diupdate'
      });
    }

    params.push(id);

    await db.promise().execute(
      `UPDATE services SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Layanan berhasil diupdate'
    });
  } catch (error) {
    console.error('Error update service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Laporan transaksi harian
router.get('/reports/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    // Get total pesanan hari ini
    const [totalOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE DATE(created_at) = ?',
      [reportDate]
    );

    // Get total pendapatan hari ini
    const [totalRevenue] = await db.promise().execute(
      'SELECT SUM(total_price) as total FROM orders WHERE DATE(created_at) = ? AND status = "completed"',
      [reportDate]
    );

    // Get pesanan per status
    const [ordersByStatus] = await db.promise().execute(
      'SELECT status, COUNT(*) as count FROM orders WHERE DATE(created_at) = ? GROUP BY status',
      [reportDate]
    );

    // Get pesanan per layanan
    const [ordersByService] = await db.promise().execute(
      `SELECT s.name as service_name, s.type, COUNT(*) as count, SUM(o.total_price) as revenue
       FROM orders o
       JOIN services s ON o.service_id = s.id
       WHERE DATE(o.created_at) = ?
       GROUP BY s.id, s.name, s.type`,
      [reportDate]
    );

    // Get pesanan per mitra
    const [ordersByMitra] = await db.promise().execute(
      `SELECT m.name as mitra_name, COUNT(*) as count, SUM(o.total_price) as revenue
       FROM orders o
       JOIN mitra m ON o.mitra_id = m.id
       WHERE DATE(o.created_at) = ? AND o.status = "completed"
       GROUP BY m.id, m.name`,
      [reportDate]
    );

    res.json({
      success: true,
      data: {
        date: reportDate,
        summary: {
          total_orders: totalOrders[0].total,
          total_revenue: totalRevenue[0].total || 0
        },
        orders_by_status: ordersByStatus,
        orders_by_service: ordersByService,
        orders_by_mitra: ordersByMitra
      }
    });
  } catch (error) {
    console.error('Error get daily report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Laporan transaksi bulanan
router.get('/reports/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;
    const reportMonth = month || new Date().getMonth() + 1;
    const reportYear = year || new Date().getFullYear();

    // Get total pesanan bulan ini
    const [totalOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?',
      [reportMonth, reportYear]
    );

    // Get total pendapatan bulan ini
    const [totalRevenue] = await db.promise().execute(
      'SELECT SUM(total_price) as total FROM orders WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? AND status = "completed"',
      [reportMonth, reportYear]
    );

    // Get pesanan per hari dalam bulan
    const [ordersByDay] = await db.promise().execute(
      `SELECT DAY(created_at) as day, COUNT(*) as count, SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END) as revenue
       FROM orders 
       WHERE MONTH(created_at) = ? AND YEAR(created_at) = ?
       GROUP BY DAY(created_at)
       ORDER BY day`,
      [reportMonth, reportYear]
    );

    // Get top mitra bulan ini
    const [topMitra] = await db.promise().execute(
      `SELECT m.name as mitra_name, COUNT(*) as count, SUM(o.total_price) as revenue
       FROM orders o
       JOIN mitra m ON o.mitra_id = m.id
       WHERE MONTH(o.created_at) = ? AND YEAR(o.created_at) = ? AND o.status = "completed"
       GROUP BY m.id, m.name
       ORDER BY revenue DESC
       LIMIT 10`,
      [reportMonth, reportYear]
    );

    res.json({
      success: true,
      data: {
        month: reportMonth,
        year: reportYear,
        summary: {
          total_orders: totalOrders[0].total,
          total_revenue: totalRevenue[0].total || 0
        },
        orders_by_day: ordersByDay,
        top_mitra: topMitra
      }
    });
  } catch (error) {
    console.error('Error get monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get total users
    const [totalUsers] = await db.promise().execute('SELECT COUNT(*) as total FROM users');
    
    // Get total mitra
    const [totalMitra] = await db.promise().execute('SELECT COUNT(*) as total FROM mitra');
    
    // Get total orders
    const [totalOrders] = await db.promise().execute('SELECT COUNT(*) as total FROM orders');
    
    // Get total revenue
    const [totalRevenue] = await db.promise().execute(
      'SELECT SUM(total_price) as total FROM orders WHERE status = "completed"'
    );

    // Get orders today
    const [ordersToday] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE DATE(created_at) = CURDATE()'
    );

    // Get pending orders
    const [pendingOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE status = "pending"'
    );

    // Get unverified mitra
    const [unverifiedMitra] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM mitra WHERE is_verified = false'
    );

    res.json({
      success: true,
      data: {
        total_users: totalUsers[0].total,
        total_mitra: totalMitra[0].total,
        total_orders: totalOrders[0].total,
        total_revenue: totalRevenue[0].total || 0,
        orders_today: ordersToday[0].total,
        pending_orders: pendingOrders[0].total,
        unverified_mitra: unverifiedMitra[0].total
      }
    });
  } catch (error) {
    console.error('Error get dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
