# Nadella - Sistem Manajemen CRM dengan AI Analytics

Nadella adalah aplikasi CRM (Customer Relationship Management) berbasis web yang dilengkapi dengan chatbot analitik AI. Aplikasi ini memungkinkan pengguna untuk mengelola data members, produk, dan pesanan, serta melakukan analisis data menggunakan bahasa natural melalui AI assistant.

## Fitur Utama

- **Dashboard Analytics**: Tampilan overview statistik bisnis dengan data members, produk, dan pesanan.
- **Manajemen Data**: CRUD lengkap untuk members, produk, pesanan, dan item pesanan.
- **AI Analytics Chatbot**: Query data menggunakan bahasa natural yang dikonversi menjadi SQL secara otomatis.
- **Autentikasi & Autorisasi**: Sistem login/logout dengan role-based access menggunakan Supabase Auth.
- **Export PDF**: Generate laporan dalam format PDF untuk analisis bisnis.
- **SQL Query Generator**: AI yang mengkonversi pertanyaan natural language menjadi query SQL yang aman.
- **Multi-language Support**: Interface mendukung bahasa Indonesia dengan AI yang dapat memahami pertanyaan dalam bahasa Indonesia.

## Teknologi yang Digunakan

- **Next.js 15**: Framework React untuk pengembangan aplikasi web.
- **React 19**: Library JavaScript untuk membangun antarmuka pengguna.
- **@supabase/supabase-js**: Client JavaScript untuk database dan autentikasi Supabase.
- **Mistral AI**: API untuk natural language processing dan SQL generation.
- **PDF-lib**: Library untuk generate dokumen PDF laporan.
- **PostgreSQL**: Database untuk menyimpan data CRM (via Supabase).
- **Feather Icons**: Icon set untuk UI components.
- **SweetAlert2**: Library untuk notifikasi dan dialog interaktif.

## Instalasi dan Penggunaan

1. **Klon repositori ini**
   ```bash
   git clone <url-repositori>
   cd medherb-next
   ```

2. **Instal dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Variabel Lingkungan**
   Buat file `.env.local` di root direktori dan tambahkan variabel lingkungan berikut:
   ```
   # Supabase Configuration
   SUPABASE_URL="https://<your-supabase-url>.supabase.co"
   SUPABASE_KEY="your-supabase-anon-key"
   NEXT_PUBLIC_SUPABASE_URL="https://<your-supabase-url>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

   # Mistral AI Configuration
   MISTRAL_API_KEY="your-mistral-api-key"
   ```

4. **Setup Database Supabase**
   Jalankan script SQL yang ada di file `schema_supabase.txt` untuk membuat tabel-tabel yang diperlukan:
   - `members`: Data pelanggan/member
   - `products`: Data produk
   - `orders`: Data pesanan
   - `order_items`: Detail item dalam pesanan

   Pastikan juga membuat fungsi `exec_sql` di Supabase untuk menjalankan query dinamis dari AI.

5. **Menjalankan Aplikasi (Mode Development)**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000)

6. **Menjalankan Aplikasi (Mode Produksi)**
   - Bangun aplikasi:
     ```bash
     npm run build
     ```
   - Jalankan aplikasi:
     ```bash
     npm start
     ```

## Struktur Proyek

```
medherb-next/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.js          # Endpoint autentikasi login
│   │   │   ├── logout/route.js         # Endpoint logout
│   │   │   └── refresh/route.js        # Refresh token
│   │   ├── dashboard/route.js          # API statistik dashboard
│   │   ├── members/route.js            # CRUD operations untuk members
│   │   ├── products/route.js           # CRUD operations untuk products
│   │   ├── orders/route.js             # CRUD operations untuk orders
│   │   ├── order_items/route.js        # CRUD operations untuk order items
│   │   ├── assistant/route.js          # AI assistant chatbot
│   │   └── query/route.js              # Natural language to SQL query
│   ├── globals.css                     # Gaya global untuk aplikasi
│   ├── layout.js                       # Layout utama aplikasi
│   └── page.js                         # Halaman utama (redirect ke login)
├── public/                             # File-file statis dan halaman HTML
│   ├── index.html                      # Landing page Si-Mbah
│   ├── login.html                      # Halaman login
│   ├── dashboard.html                  # Dashboard utama Nadella
│   ├── members.html                    # Manajemen data members
│   ├── products.html                   # Manajemen data products
│   ├── orders.html                     # Manajemen data orders
│   ├── css/                           # Styling files
│   └── js/                            # JavaScript client-side
├── schema_supabase.txt                 # Schema database SQL
├── .env.local                          # Variabel lingkungan (tidak disimpan dalam repo)
├── package.json                        # Dependensi dan skrip proyek
├── next.config.mjs                     # Konfigurasi Next.js
└── README.md                           # Dokumentasi ini
```

## Cara Kerja

### AI Analytics Chatbot:
1. Pengguna mengajukan pertanyaan analisis dalam bahasa natural (Indonesia/Inggris).
2. Mistral AI mengkonversi pertanyaan menjadi query SQL yang aman dan valid.
3. Query divalidasi untuk memastikan hanya operasi SELECT yang diizinkan pada tabel yang diperbolehkan.
4. Query dieksekusi pada database Supabase untuk mengambil data.
5. Mistral AI memproses hasil dan memberikan ringkasan dalam bahasa Indonesia.
6. Hasil dapat diekspor dalam format PDF untuk pelaporan.

### Sistem Keamanan:
- Validasi SQL untuk mencegah SQL injection dan operasi berbahaya
- Whitelist tabel yang diperbolehkan (members, products, orders, order_items)
- Autentikasi berbasis token dengan Supabase Auth
- Role-based access control

### Management Interface:
- Dashboard dengan statistik bisnis realtime
- Interface CRUD yang intuitif untuk semua entitas data
- Responsive design untuk desktop dan mobile

## API Endpoints

### Autentikasi:
- `POST /api/auth/login`: Login dengan email dan password
- `POST /api/auth/logout`: Logout user session
- `POST /api/auth/refresh`: Refresh authentication token

### Analytics:
- `POST /api/query`: Natural language query ke SQL dengan AI (fitur utama)
- `POST /api/assistant`: General purpose AI assistant
- `GET /api/dashboard`: Statistik dashboard (total members, products, orders)

### Data Management:
- `GET/POST/PUT/DELETE /api/members`: CRUD operations untuk data members
- `GET/POST/PUT/DELETE /api/products`: CRUD operations untuk data products  
- `GET/POST/PUT/DELETE /api/orders`: CRUD operations untuk data orders
- `GET/POST/PUT/DELETE /api/order_items`: CRUD operations untuk order items

## Contoh Penggunaan AI Query

Contoh pertanyaan yang dapat diajukan ke `/api/query`:

```
"Berapa total penjualan bulan ini?"
"Siapa member yang paling banyak berbelanja?"
"Produk apa yang paling laris?"
"Tampilkan 10 pesanan terakhir"
"Berapa rata-rata nilai pesanan per member?"
```

Endpoint akan mengembalikan:
- Jawaban dalam bahasa Indonesia
- SQL query yang dieksekusi  
- Data hasil query
- Jumlah baris data
- Opsi export PDF untuk laporan

## Konfigurasi Database Supabase

Aplikasi ini menggunakan Supabase sebagai backend dengan struktur database berikut:

### Tabel Utama:
- **members**: Data pelanggan (id, name, email, phone, created_at)
- **products**: Data produk (id, name, price, category, created_at)  
- **orders**: Data pesanan (id, member_id, created_at)
- **order_items**: Detail item pesanan (id, order_id, product_id, quantity, subtotal)

### Fungsi Database yang Diperlukan:
- **exec_sql**: Fungsi untuk menjalankan query SQL dinamis dari AI assistant
- **Autentikasi**: Supabase Auth untuk login/logout dan session management
- **RLS (Row Level Security)**: Untuk keamanan akses data

### Setup Database:
1. Buat project baru di [Supabase](https://supabase.com)
2. Jalankan script SQL dari file `schema_supabase.txt`
3. Buat fungsi `exec_sql` untuk query dinamis
4. Konfigurasi authentication policies sesuai kebutuhan
5. Dapatkan URL dan API keys untuk konfigurasi environment

## Deployment

Aplikasi ini dapat di-deploy ke:

### Vercel (Recommended):
```bash
npm run build
vercel --prod
```

### Netlify:
```bash
npm run build
# Upload folder .next ke Netlify
```

### Manual Server:
```bash
npm run build
npm start
```

Pastikan environment variables sudah dikonfigurasi di platform deployment yang dipilih.
