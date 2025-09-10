const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, authenticateCustomer } = require('../middleware/auth');
const { sendNotificationToUser } = require('../utils/notification');

const router = express.Router();

// Middleware untuk memastikan hanya customer yang bisa akses
router.use(authenticateToken, authenticateCustomer);

// Get semua layanan
router.get('/services', async (req, res) => {
  try {
    const [services] = await db.promise().execute(
      'SELECT * FROM services WHERE is_active = true ORDER BY type, name'
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

// Get layanan berdasarkan tipe
router.get('/services/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['massage', 'cleaning', 'ac_service'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipe layanan tidak valid'
      });
    }

    const [services] = await db.promise().execute(
      'SELECT * FROM services WHERE type = ? AND is_active = true ORDER BY name',
      [type]
    );

    res.json({
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Error get services by type:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Buat pesanan baru
router.post('/orders', [
  body('service_id').isInt().withMessage('Service ID harus berupa angka'),
  body('address').notEmpty().withMessage('Alamat harus diisi'),
  body('scheduled_date').isISO8601().withMessage('Tanggal jadwal tidak valid'),
  body('scheduled_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Waktu jadwal tidak valid'),
  body('notes').optional().isString()
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

    const { service_id, address, scheduled_date, scheduled_time, notes } = req.body;
    const userId = req.user.id;

    // Cek apakah service ada dan aktif
    const [services] = await db.promise().execute(
      'SELECT * FROM services WHERE id = ? AND is_active = true',
      [service_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Layanan tidak ditemukan'
      });
    }

    const service = services[0];

    // Insert pesanan baru
    const [result] = await db.promise().execute(
      'INSERT INTO orders (user_id, service_id, address, scheduled_date, scheduled_time, total_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, service_id, address, scheduled_date, scheduled_time, service.base_price, notes || null]
    );

    // Kirim notifikasi ke admin
    await sendNotificationToUser(
      null, // admin tidak ada user_id, akan dihandle khusus
      'Pesanan Baru',
      `Pesanan baru dari ${req.user.name} untuk layanan ${service.name}`,
      'order_status',
      result.insertId
    );

    res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat',
      data: {
        order: {
          id: result.insertId,
          service: service.name,
          address,
          scheduled_date,
          scheduled_time,
          total_price: service.base_price,
          status: 'pending'
        }
      }
    });
  } catch (error) {
    console.error('Error create order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get semua pesanan customer
router.get('/orders', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = `
      SELECT o.*, s.name as service_name, s.type as service_type, m.name as mitra_name
      FROM orders o
      JOIN services s ON o.service_id = s.id
      LEFT JOIN mitra m ON o.mitra_id = m.id
      WHERE o.user_id = ?
    `;
    
    const params = [userId];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC';
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [orders] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE user_id = ?';
    const countParams = [userId];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
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
    const userId = req.user.id;

    const [orders] = await db.promise().execute(
      `SELECT o.*, s.name as service_name, s.type as service_type, s.description as service_description,
              m.name as mitra_name, m.phone as mitra_phone, m.address as mitra_address
       FROM orders o
       JOIN services s ON o.service_id = s.id
       LEFT JOIN mitra m ON o.mitra_id = m.id
       WHERE o.id = ? AND o.user_id = ?`,
      [id, userId]
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

// Batalkan pesanan
router.put('/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Cek apakah pesanan ada dan milik user
    const [orders] = await db.promise().execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan'
      });
    }

    const order = orders[0];

    // Cek apakah pesanan bisa dibatalkan
    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Pesanan tidak bisa dibatalkan'
      });
    }

    // Update status pesanan
    await db.promise().execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['cancelled', id]
    );

    // Kirim notifikasi ke mitra jika ada
    if (order.mitra_id) {
      await sendNotificationToUser(
        null, // akan dihandle khusus untuk mitra
        'Pesanan Dibatalkan',
        `Pesanan #${id} telah dibatalkan oleh customer`,
        'order_status',
        id
      );
    }

    res.json({
      success: true,
      message: 'Pesanan berhasil dibatalkan'
    });
  } catch (error) {
    console.error('Error cancel order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update profil customer
router.put('/profile', [
  body('name').optional().notEmpty().withMessage('Nama tidak boleh kosong'),
  body('email').optional().isEmail().withMessage('Email tidak valid'),
  body('address').optional().isString()
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

    const { name, email, address } = req.body;
    const userId = req.user.id;

    // Build update query
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (address) {
      updates.push('address = ?');
      params.push(address);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data yang diupdate'
      });
    }

    params.push(userId);

    await db.promise().execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Profil berhasil diupdate'
    });
  } catch (error) {
    console.error('Error update profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get notifikasi customer
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, is_read } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (is_read !== undefined) {
      query += ' AND is_read = ?';
      params.push(is_read === 'true');
    }

    query += ' ORDER BY created_at DESC';

    // Pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [notifications] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    const countParams = [userId];
    
    if (is_read !== undefined) {
      countQuery += ' AND is_read = ?';
      countParams.push(is_read === 'true');
    }
    
    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error get notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Mark notifikasi sebagai dibaca
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.promise().execute(
      'UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notifikasi ditandai sebagai dibaca'
    });
  } catch (error) {
    console.error('Error mark notification read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
