# Pallawa Group Backend API

Backend API untuk aplikasi layanan rumah Pallawa Group dengan Node.js, Express, dan MySQL.

## Fitur

### Customer (User App)
- ✅ Login / Register (nomor HP / Google OAuth)
- ✅ Pilih layanan (Massage / Cleaning / Service AC)
- ✅ Masukkan alamat & jadwal
- ✅ Konfirmasi pesanan & estimasi biaya
- ✅ Notifikasi status order

### Mitra (Provider App)
- ✅ Login / Register (data + verifikasi admin)
- ✅ Terima / tolak order
- ✅ Lihat detail pesanan (alamat, waktu)
- ✅ Status selesai layanan

### Admin (Web Dashboard)
- ✅ Kelola user & mitra
- ✅ Lihat order masuk & status
- ✅ Laporan transaksi sederhana (harian)

## Instalasi

1. Clone repository
```bash
git clone <repository-url>
cd pallawaGroup
```

2. Install dependencies
```bash
npm install
```

3. Setup database MySQL
```bash
# Import schema database
mysql -u root -p < config/database.sql
```

4. Setup environment variables
```bash
cp .env.example .env
# Edit file .env sesuai konfigurasi Anda
```

5. Jalankan server
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pallawa_group

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Server Configuration
PORT=3000
NODE_ENV=development

# Email Configuration (untuk notifikasi)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register customer
- `POST /api/auth/login` - Login customer
- `POST /api/auth/google` - Google OAuth login/register
- `POST /api/auth/mitra/register` - Register mitra
- `POST /api/auth/mitra/login` - Login mitra
- `POST /api/auth/admin/login` - Login admin
- `GET /api/auth/profile` - Get profile user yang login

### Customer Endpoints
- `GET /api/customer/services` - Get semua layanan
- `GET /api/customer/services/:type` - Get layanan berdasarkan tipe
- `POST /api/customer/orders` - Buat pesanan baru
- `GET /api/customer/orders` - Get semua pesanan customer
- `GET /api/customer/orders/:id` - Get detail pesanan
- `PUT /api/customer/orders/:id/cancel` - Batalkan pesanan
- `PUT /api/customer/profile` - Update profil customer
- `GET /api/customer/notifications` - Get notifikasi customer

### Mitra Endpoints
- `GET /api/mitra/orders/available` - Get pesanan yang tersedia
- `GET /api/mitra/orders/my-orders` - Get pesanan mitra
- `POST /api/mitra/orders/:id/accept` - Ambil pesanan
- `POST /api/mitra/orders/:id/reject` - Tolak pesanan
- `PUT /api/mitra/orders/:id/start` - Mulai layanan
- `PUT /api/mitra/orders/:id/complete` - Selesaikan layanan
- `GET /api/mitra/orders/:id` - Get detail pesanan
- `PUT /api/mitra/profile` - Update profil mitra
- `GET /api/mitra/stats` - Get statistik mitra
- `GET /api/mitra/notifications` - Get notifikasi mitra

### Admin Endpoints
- `GET /api/admin/users` - Get semua users
- `GET /api/admin/mitra` - Get semua mitra
- `PUT /api/admin/mitra/:id/verify` - Verifikasi mitra
- `PUT /api/admin/mitra/:id/status` - Aktifkan/nonaktifkan mitra
- `GET /api/admin/orders` - Get semua pesanan
- `GET /api/admin/orders/:id` - Get detail pesanan
- `GET /api/admin/services` - Get semua layanan
- `POST /api/admin/services` - Tambah layanan baru
- `PUT /api/admin/services/:id` - Update layanan
- `GET /api/admin/reports/daily` - Laporan harian
- `GET /api/admin/reports/monthly` - Laporan bulanan
- `GET /api/admin/dashboard` - Dashboard stats

## Database Schema

Database menggunakan MySQL dengan tabel:
- `users` - Data customer
- `mitra` - Data provider/mitra
- `admin` - Data admin
- `services` - Data layanan
- `orders` - Data pesanan
- `notifications` - Data notifikasi

## Security Features

- JWT Authentication
- Password hashing dengan bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation dengan express-validator

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run production server
npm start
```

## Testing

```bash
# Test health endpoint
curl http://localhost:3000/health
```

## License

ISC
