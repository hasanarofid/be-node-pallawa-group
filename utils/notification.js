const db = require('../config/database');

// Kirim notifikasi ke user
const sendNotificationToUser = async (userId, title, message, type = 'general', orderId = null) => {
  try {
    const query = `
      INSERT INTO notifications (user_id, order_id, title, message, type) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await db.promise().execute(query, [userId, orderId, title, message, type]);
    console.log(`Notifikasi terkirim ke user ${userId}: ${title}`);
  } catch (error) {
    console.error('Error mengirim notifikasi ke user:', error);
  }
};

// Kirim notifikasi ke mitra
const sendNotificationToMitra = async (mitraId, title, message, type = 'general', orderId = null) => {
  try {
    const query = `
      INSERT INTO notifications (mitra_id, order_id, title, message, type) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await db.promise().execute(query, [mitraId, orderId, title, message, type]);
    console.log(`Notifikasi terkirim ke mitra ${mitraId}: ${title}`);
  } catch (error) {
    console.error('Error mengirim notifikasi ke mitra:', error);
  }
};

// Update status order dan kirim notifikasi
const updateOrderStatus = async (orderId, status, userId = null, mitraId = null) => {
  try {
    // Update status order
    const updateQuery = 'UPDATE orders SET status = ? WHERE id = ?';
    await db.promise().execute(updateQuery, [status, orderId]);

    // Kirim notifikasi berdasarkan status
    let title, message;
    
    switch (status) {
      case 'accepted':
        title = 'Pesanan Diterima';
        message = 'Pesanan Anda telah diterima oleh mitra. Mitra akan menghubungi Anda segera.';
        if (userId) {
          await sendNotificationToUser(userId, title, message, 'order_status', orderId);
        }
        break;
        
      case 'rejected':
        title = 'Pesanan Ditolak';
        message = 'Maaf, pesanan Anda ditolak oleh mitra. Silakan coba mitra lain.';
        if (userId) {
          await sendNotificationToUser(userId, title, message, 'order_status', orderId);
        }
        break;
        
      case 'in_progress':
        title = 'Layanan Dimulai';
        message = 'Mitra telah memulai layanan Anda.';
        if (userId) {
          await sendNotificationToUser(userId, title, message, 'order_status', orderId);
        }
        break;
        
      case 'completed':
        title = 'Layanan Selesai';
        message = 'Layanan Anda telah selesai. Terima kasih telah menggunakan layanan kami.';
        if (userId) {
          await sendNotificationToUser(userId, title, message, 'order_status', orderId);
        }
        break;
        
      case 'cancelled':
        title = 'Pesanan Dibatalkan';
        message = 'Pesanan Anda telah dibatalkan.';
        if (userId) {
          await sendNotificationToUser(userId, title, message, 'order_status', orderId);
        }
        break;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

module.exports = {
  sendNotificationToUser,
  sendNotificationToMitra,
  updateOrderStatus
};
