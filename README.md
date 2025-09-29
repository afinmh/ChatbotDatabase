# Si-Mbah

Si-Mbah adalah aplikasi berbasis web yang dirancang untuk membantu pengguna dalam mencari dan memperoleh informasi tentang herbal dan obat herbal berdasarkan penelitian ilmiah. Aplikasi ini menggunakan teknologi kecerdasan buatan (AI) untuk memungkinkan pencarian semantik terhadap dokumen jurnal ilmiah.

## Fitur Utama

- **Pencarian Semantik**: Menggunakan model embedding untuk mencari dokumen yang relevan berdasarkan makna pertanyaan, bukan hanya pencocokan kata kunci.
- **Integrasi Supabase**: Menyimpan dan mengelola dokumen jurnal ilmiah serta metadata terkait.
- **Penerjemahan Otomatis**: Mampu menerjemahkan pertanyaan dari bahasa Indonesia ke bahasa Inggris sebelum diproses lebih lanjut.
- **API AI Terpadu**: Menggunakan API Mistral AI untuk menghasilkan jawaban yang relevan berdasarkan konteks dokumen yang ditemukan.
- **Pemrosesan PDF**: Mampu mengintegrasikan dan mengindeks konten dari dokumen PDF jurnal ilmiah herbal.

## Teknologi yang Digunakan

- **Next.js 15**: Framework React untuk pengembangan aplikasi web.
- **React 19**: Library JavaScript untuk membangun antarmuka pengguna.
- **@supabase/supabase-js**: Client JavaScript untuk database Supabase.
- **@xenova/transformers**: Library untuk menjalankan model AI langsung di browser/node.
- **Mistral AI**: API untuk terjemahan dan pembuatan jawaban berbasis konteks.
- **PDF.js**: Library untuk menangani dokumen PDF.
- **Node.js**: Lingkungan runtime JavaScript.

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
   # Supabase
   SUPABASE_URL="https://<your-supabase-url>.supabase.co"
   SUPABASE_KEY="your-supabase-key"
   NEXT_PUBLIC_SUPABASE_URL="https://<your-supabase-url>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

   # Mistral AI
   MISTRAL_API_KEY="your-mistral-api-key"

   # News API (opsional)
   NEWS_API_KEY="your-news-api-key"

   # Xenova/Transformers
   HF_HUB_DISABLE_TELEMETRY="1"
   ```

4. **Menjalankan Aplikasi (Mode Development)**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000)

5. **Menjalankan Aplikasi (Mode Produksi)**
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
│   │   └── query/
│   │       └── route.js          # Endpoint untuk pencarian dokumen
│   ├── globals.css              # Gaya global untuk aplikasi
│   ├── layout.js                # Layout utama aplikasi
│   └── page.js                  # Halaman utama (mengarahkan ke index.html)
├── public/                      # File-file statis
├── .env.local                   # Variabel lingkungan (tidak disimpan dalam repo)
├── package.json                 # Dependensi dan skrip proyek
├── next.config.mjs              # Konfigurasi Next.js
└── README.md                    # Dokumentasi ini
```

## Cara Kerja

1. Pengguna mengajukan pertanyaan dalam bahasa Indonesia.
2. Pertanyaan diterjemahkan ke bahasa Inggris menggunakan API Mistral.
3. Model embedding Xenova menghasilkan vektor dari pertanyaan terjemahan.
4. Vektor tersebut dibandingkan dengan vektor dokumen yang tersimpan di Supabase menggunakan pencarian semantik.
5. Dokumen yang paling relevan diambil dan digunakan sebagai konteks.
6. API Mistral digunakan lagi untuk menghasilkan jawaban dalam bahasa Indonesia berdasarkan konteks yang diberikan.
7. Hasil (jawaban dan dokumen referensi) ditampilkan ke pengguna.

## API Endpoint

- `POST /api/query`: Endpoint utama untuk mengirim pertanyaan dan menerima jawaban serta dokumen referensi yang relevan.

## Konfigurasi Supabase

Aplikasi ini tergantung pada database Supabase untuk menyimpan dan mengindeks dokumen jurnal. Pastikan untuk mengonfigurasi:
- Tabel `jurnal_referensi` dengan kolom seperti `judul`, `author`, `year`, dan `file_url`
- Fungsi `match_documents` untuk pencarian semantik
- Storage untuk menyimpan file PDF dokumen jurnal
