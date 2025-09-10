# Panduan Deploy Backend ke cPanel

## 📋 **Langkah-langkah Deploy:**

### **1. Upload File ke cPanel**
- Upload semua file project ke folder `public_html/api/` atau folder yang ditentukan
- Pastikan file `.env.production` sudah diupload dengan konfigurasi yang benar

### **2. Install Dependencies**
```bash
npm install --production
```

### **3. Setup Environment Variables**
Buat file `.env` di server dengan isi:
```env
NODE_ENV=production
DB_HOST=localhost
DB_USER=solz1468_solkit
DB_PASSWORD=DemiAllah@1
DB_NAME=solz1468_api
JWT_SECRET=pallawa_group_jwt_secret_key_2024_production_secure_key
JWT_EXPIRES_IN=7d
PORT=3000
BASE_URL=http://api.solusicodekata.com
```

### **4. Start Application**
```bash
npm start
```

### **5. Setup Domain/Subdomain**
- Point subdomain `api.solusicodekata.com` ke folder project
- Atau gunakan folder `public_html/api/`

## 🔧 **Konfigurasi cPanel Node.js:**

1. **Masuk ke cPanel → Node.js Selector**
2. **Create Application:**
   - Node.js Version: 18.x atau 20.x
   - Application Mode: Production
   - Application Root: `/public_html/api`
   - Application URL: `api.solusicodekata.com`
   - Application Startup File: `server.js`

3. **Environment Variables:**
   - Tambahkan semua variabel dari file `.env`

4. **Start Application**

## 📁 **Struktur File di Server:**
```
public_html/
└── api/
    ├── server.js
    ├── package.json
    ├── config/
    ├── routes/
    ├── middleware/
    ├── utils/
    └── .env
```

## 🚀 **Script untuk Deploy:**
```bash
# Install dependencies
npm install --production

# Start application
npm start
```

## 🔍 **Testing:**
- Health check: `http://api.solusicodekata.com/health`
- API base: `http://api.solusicodekata.com/api`
