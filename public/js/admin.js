// Pastikan init tetap berjalan meski DOMContentLoaded sudah lewat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { console.info('[admin] DOMContentLoaded'); initializeApp(); });
} else {
    console.info('[admin] init (document already ready)');
    initializeApp();
}

function initializeApp() {
    console.info('[admin] initializeApp called');
    // 2. Periksa akses, hentikan jika bukan admin
    if (!checkAdminAccess()) return;

    // 3. Muat semua data dummy
    loadDashboardData();

    // 4. Atur semua event listener interaktif
    setupEventListeners();

    // 5. Ganti semua ikon Feather
    feather.replace();
}

function checkAdminAccess() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = '../login.html'; // Alihkan tanpa alert untuk pengalaman lebih cepat
            return false;
        }
        return true;
    } catch (error) {
        window.location.href = '../login.html';
        return false;
    }
}

function setupEventListeners() {
    if (window.__adminListenersBound) {
        console.info('[admin] setupEventListeners skipped (already bound)');
        return;
    }
    window.__adminListenersBound = true;
    console.info('[admin] setupEventListeners');
    // Toggle sidebar di mobile (delegated + reusable)
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    console.info('[admin] elements', { hasSidebar: !!sidebar, hasOverlay: !!sidebarOverlay, hasToggle: !!sidebarToggle });

    const toggleSidebar = (show) => {
        if (!sidebar) return;
        const willShow = typeof show === 'boolean' ? show : !sidebar.classList.contains('show');
        sidebar.classList.toggle('show', willShow);
        if (sidebarOverlay) sidebarOverlay.classList.toggle('show', willShow);
        document.body.style.overflow = willShow ? 'hidden' : '';
        console.info('[admin] toggleSidebar', { willShow });
    };

    // Button by id
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.info('[admin] toggle button clicked');
            toggleSidebar();
        });
    } else {
        // Fallback: event delegation only when button not found at init
        document.addEventListener('click', (e) => {
            const btn = e.target && (e.target.closest ? e.target.closest('#sidebar-toggle') : null);
            if (btn) {
                e.preventDefault();
                console.info('[admin] delegated toggle click');
                toggleSidebar();
            }
        });
    }

    // Tutup sidebar saat overlay diklik
    if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => { console.info('[admin] overlay click'); toggleSidebar(false); });
    }

    // Tutup sidebar dengan tombol ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('show')) {
            console.info('[admin] ESC pressed');
            toggleSidebar(false);
        }
    });

    // Tombol Logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Toggle notifications dropdown
    const notifToggle = document.getElementById('notif-toggle');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifToggle && notifDropdown) {
        notifToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('show');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifToggle) {
                notifDropdown.classList.remove('show');
            }
        });

        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                notifDropdown.classList.remove('show');
            }
        });

    }
}

function handleLogout() {
    Swal.fire({
        title: 'Anda yakin ingin keluar?',
        icon: 'warning',
        showCancelButton: true,
    confirmButtonColor: '#4A6C8A',
        cancelButtonColor: '#E53E3E',
        confirmButtonText: 'Ya, keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../login.html';
        }
    });
}

function loadDashboardData() {
    loadAdminProfile();
    loadDashboardStats();
    loadRecentActivity();
}

function loadAdminProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;
        
        const userName = user.name || 'User';
        const userInitial = userName.charAt(0).toUpperCase();
    const welcomeEl = document.getElementById('welcome-message');
    if (welcomeEl) welcomeEl.textContent = `Selamat Datang, ${userName}!`;
    const nameEl = document.getElementById('admin-name-sidebar');
    if (nameEl) nameEl.textContent = userName;
    const avatarEl = document.getElementById('admin-avatar-sidebar');
    if (avatarEl) avatarEl.textContent = userInitial;

    } catch (error) {
        console.error('Gagal memuat profil user:', error);
    }
}

function loadDashboardStats() {
    // Members count (ambil dari /api/members)
    const membersEl = document.getElementById('total-members');
    const productsEl = document.getElementById('total-products');
    const ordersEl = document.getElementById('total-orders');
    if (membersEl) membersEl.textContent = '...';
    if (productsEl) productsEl.textContent = '...';
    if (ordersEl) ordersEl.textContent = '...';

    // Ambil total members dari API /api/members
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/members?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.total;
                if (typeof total === 'number') {
                    if (membersEl) membersEl.textContent = formatNumber(total);
                } else {
                    if (membersEl) membersEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total members:', err);
                if (membersEl) membersEl.textContent = '-';
            });
    }

    // Ambil total products dari API Next.js /api/products
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/products?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.total;
                if (typeof total === 'number') {
                    if (productsEl) productsEl.textContent = formatNumber(total);
                } else {
                    if (productsEl) productsEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total products:', err);
                if (productsEl) productsEl.textContent = '-';
            });
    }

    // Ambil total orders dari API /api/orders
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/orders?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const total = data?.pagination?.total;
                if (typeof total === 'number') {
                    if (ordersEl) ordersEl.textContent = formatNumber(total);
                } else {
                    if (ordersEl) ordersEl.textContent = '-';
                }
            })
            .catch((err) => {
                console.error('Gagal memuat total orders:', err);
                if (ordersEl) ordersEl.textContent = '-';
            });
    }
}

function formatNumber(num) {
    try {
        return new Intl.NumberFormat('id-ID').format(num);
    } catch (e) {
        return String(num);
    }
}

function loadRecentActivity() {
    // 1) Aktivitas member terbaru (ikon user-plus)
    const userItemIcon = document.querySelector('.recent-activity .activity-item i[data-feather="user-plus"]');
    const userItem = userItemIcon ? userItemIcon.parentElement : null;
    if (userItem) {
        const textEl = userItem.querySelector('.activity-text');
        const timeEl = userItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat member terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/members?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const usr = Array.isArray(data?.data) ? data.data[0] : null;
                if (!usr) {
                    if (textEl) textEl.textContent = 'Belum ada member.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }
                const name = usr.name || 'Member Baru';
                const createdAt = usr.created_at || usr.createdAt || null;
                const shortName = truncateWords(name, 3);
                if (textEl) textEl.textContent = `Member ${shortName} baru saja terdaftar.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat member terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat member terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }

    // 2) Aktivitas produk terbaru (ikon shopping-bag)
    const productItemIcon = document.querySelector('.recent-activity .activity-item i[data-feather="shopping-bag"]');
    const productItem = productItemIcon ? productItemIcon.parentElement : null;
    if (productItem) {
        const textEl = productItem.querySelector('.activity-text');
        const timeEl = productItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat produk terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/products?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const product = Array.isArray(data?.data) ? data.data[0] : null;

                if (!product) {
                    if (textEl) textEl.textContent = 'Belum ada produk.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }

                const name = product.name || 'Tanpa Nama';
                const createdAt = product.created_at || product.createdAt || null;
                const shortName = truncateWords(name, 3);
                if (textEl) textEl.textContent = `Produk "${shortName}" baru saja ditambahkan.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat aktivitas produk terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat produk terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }

    // 3) Aktivitas order terbaru (gunakan ikon shopping-cart)
    const orderIcon = document.querySelector('.recent-activity .activity-item i[data-feather="shopping-cart"]');
    const orderItem = orderIcon ? orderIcon.parentElement : null;
    if (orderItem) {
        const textEl = orderItem.querySelector('.activity-text');
        const timeEl = orderItem.querySelector('.activity-time');
        if (textEl) textEl.textContent = 'Memuat order terbaru...';
        if (timeEl) timeEl.textContent = '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const accessToken = localStorage.getItem('access_token');
        fetch('/api/orders?limit=1&page=1', { 
            signal: controller.signal, 
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            } 
        })
            .then(async (res) => {
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const item = Array.isArray(data?.data) ? data.data[0] : null;
                if (!item) {
                    if (textEl) textEl.textContent = 'Belum ada order.';
                    if (timeEl) timeEl.textContent = '-';
                    return;
                }
                const createdAt = item.created_at || null;
                if (textEl) textEl.textContent = `Order baru telah dibuat.`;
                if (timeEl) timeEl.textContent = formatDateID(createdAt);
            })
            .catch((err) => {
                console.error('Gagal memuat order terbaru:', err);
                if (textEl) textEl.textContent = 'Gagal memuat order terbaru.';
                if (timeEl) timeEl.textContent = '-';
            });
    }
}

function truncateWords(text, count) {
    try {
        const words = String(text).trim().split(/\s+/);
        const slice = words.slice(0, count).join(' ');
        return words.length > count ? `${slice}..` : slice;
    } catch {
        return String(text);
    }
}

function formatDateID(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
