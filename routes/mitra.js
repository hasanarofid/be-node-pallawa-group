const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, authenticateMitra } = require('../middleware/auth');
const { updateOrderStatus } = require('../utils/notification');

const router = express.Router();

// Middleware untuk memastikan hanya mitra yang bisa akses
router.use(authenticateToken, authenticateMitra);

// Get pesanan yang tersedia untuk mitra (belum ada mitra yang assign)
router.get('/orders/available', async (req, res) => {
  try {
    const mitraId = req.user.id;
    
    // Get service type yang bisa ditangani mitra
    const [mitraData] = await db.promise().execute(
      'SELECT service_type FROM mitra WHERE id = ?',
      [mitraId]
    );

    if (mitraData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data mitra tidak ditemukan'
      });
    }

    const serviceType = mitraData[0].service_type;

    // Get pesanan yang sesuai dengan service type mitra dan belum ada mitra
    const [orders] = await db.promise().execute(
      `SELECT o.*, s.name as service_name, s.type as service_type, u.name as customer_name, u.phone as customer_phone
       FROM orders o
       JOIN services s ON o.service_id = s.id
       JOIN users u ON o.user_id = u.id
       WHERE s.type = ? AND o.mitra_id IS NULL AND o.status = 'pending'
       ORDER BY o.created_at ASC`,
      [serviceType]
    );

    res.json({
      success: true,
      data: { orders }
    });
  } catch (error) {
    console.error('Error get available orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get pesanan yang sudah diambil mitra
router.get('/orders/my-orders', async (req, res) => {
  try {
    const mitraId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT o.*, s.name as service_name, s.type as service_type, u.name as customer_name, u.phone as customer_phone
      FROM orders o
      JOIN services s ON o.service_id = s.id
      JOIN users u ON o.user_id = u.id
      WHERE o.mitra_id = ?
    `;
    
    const params = [mitraId];
    
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
    let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE mitra_id = ?';
    const countParams = [mitraId];
    
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
    console.error('Error get my orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Ambil pesanan (accept)
router.post('/orders/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const mitraId = req.user.id;

    // Cek apakah pesanan ada dan belum ada mitra
    const [orders] = await db.promise().execute(
      'SELECT * FROM orders WHERE id = ? AND mitra_id IS NULL AND status = "pending"',
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan atau sudah diambil mitra lain'
      });
    }

    const order = orders[0];

    // Cek apakah service type sesuai dengan mitra
    const [services] = await db.promise().execute(
      'SELECT type FROM services WHERE id = ?',
      [order.service_id]
    );

    const [mitraData] = await db.promise().execute(
      'SELECT service_type FROM mitra WHERE id = ?',
      [mitraId]
    );

    if (services[0].type !== mitraData[0].service_type) {
      return res.status(400).json({
        success: false,
        message: 'Tipe layanan tidak sesuai dengan keahlian mitra'
      });
    }

    // Update pesanan dengan mitra_id
    await db.promise().execute(
      'UPDATE orders SET mitra_id = ?, status = ? WHERE id = ?',
      [mitraId, 'accepted', id]
    );

    // Update status dan kirim notifikasi
    await updateOrderStatus(id, 'accepted', order.user_id, mitraId);

    res.json({
      success: true,
      message: 'Pesanan berhasil diambil'
    });
  } catch (error) {
    console.error('Error accept order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Tolak pesanan
router.post('/orders/:id/reject', [
  body('reason').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const mitraId = req.user.id;

    // Cek apakah pesanan ada dan belum ada mitra
    const [orders] = await db.promise().execute(
      'SELECT * FROM orders WHERE id = ? AND mitra_id IS NULL AND status = "pending"',
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan atau sudah diambil mitra lain'
      });
    }

    const order = orders[0];

    // Update status pesanan menjadi rejected
    await db.promise().execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['rejected', id]
    );

    // Update status dan kirim notifikasi
    await updateOrderStatus(id, 'rejected', order.user_id, mitraId);

    res.json({
      success: true,
      message: 'Pesanan berhasil ditolak'
    });
  } catch (error) {
    console.error('Error reject order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Mulai layanan (in progress)
router.put('/orders/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const mitraId = req.user.id;

    // Cek apakah pesanan ada dan milik mitra
    const [orders] = await db.promise().execute(
      'SELECT * FROM orders WHERE id = ? AND mitra_id = ? AND status = "accepted"',
      [id, mitraId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan atau belum diterima'
      });
    }

    // Update status pesanan
    await db.promise().execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['in_progress', id]
    );

    // Update status dan kirim notifikasi
    await updateOrderStatus(id, 'in_progress', orders[0].user_id, mitraId);

    res.json({
      success: true,
      message: 'Layanan dimulai'
    });
  } catch (error) {
    console.error('Error start service:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Selesaikan layanan
router.put('/orders/:id/complete', [
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const mitraId = req.user.id;

    // Cek apakah pesanan ada dan milik mitra
    const [orders] = await db.promise().execute(
      'SELECT * FROM orders WHERE id = ? AND mitra_id = ? AND status = "in_progress"',
      [id, mitraId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan atau belum dimulai'
      });
    }

    // Update status pesanan
    const updateQuery = notes 
      ? 'UPDATE orders SET status = ?, notes = CONCAT(IFNULL(notes, ""), "\n", ?) WHERE id = ?'
      : 'UPDATE orders SET status = ? WHERE id = ?';
    
    const params = notes ? ['completed', notes, id] : ['completed', id];
    
    await db.promise().execute(updateQuery, params);

    // Update status dan kirim notifikasi
    await updateOrderStatus(id, 'completed', orders[0].user_id, mitraId);

    res.json({
      success: true,
      message: 'Layanan berhasil diselesaikan'
    });
  } catch (error) {
    console.error('Error complete service:', error);
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
    const mitraId = req.user.id;

    const [orders] = await db.promise().execute(
      `SELECT o.*, s.name as service_name, s.type as service_type, s.description as service_description,
              u.name as customer_name, u.phone as customer_phone, u.email as customer_email
       FROM orders o
       JOIN services s ON o.service_id = s.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ? AND o.mitra_id = ?`,
      [id, mitraId]
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

// Update profil mitra
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
    const mitraId = req.user.id;

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

    params.push(mitraId);

    await db.promise().execute(
      `UPDATE mitra SET ${updates.join(', ')} WHERE id = ?`,
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

// Get statistik mitra
router.get('/stats', async (req, res) => {
  try {
    const mitraId = req.user.id;

    // Get total pesanan
    const [totalOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE mitra_id = ?',
      [mitraId]
    );

    // Get pesanan selesai
    const [completedOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE mitra_id = ? AND status = "completed"',
      [mitraId]
    );

    // Get total pendapatan
    const [totalEarnings] = await db.promise().execute(
      'SELECT SUM(total_price) as total FROM orders WHERE mitra_id = ? AND status = "completed"',
      [mitraId]
    );

    // Get pesanan bulan ini
    const [monthlyOrders] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM orders WHERE mitra_id = ? AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())',
      [mitraId]
    );

    res.json({
      success: true,
      data: {
        total_orders: totalOrders[0].total,
        completed_orders: completedOrders[0].total,
        total_earnings: totalEarnings[0].total || 0,
        monthly_orders: monthlyOrders[0].total
      }
    });
  } catch (error) {
    console.error('Error get stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get notifikasi mitra
router.get('/notifications', async (req, res) => {
  try {
    const mitraId = req.user.id;
    const { page = 1, limit = 10, is_read } = req.query;

    let query = 'SELECT * FROM notifications WHERE mitra_id = ?';
    const params = [mitraId];

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
    let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE mitra_id = ?';
    const countParams = [mitraId];
    
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
    const mitraId = req.user.id;

    await db.promise().execute(
      'UPDATE notifications SET is_read = true WHERE id = ? AND mitra_id = ?',
      [id, mitraId]
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
