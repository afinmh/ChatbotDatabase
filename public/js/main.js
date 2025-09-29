document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // Authentication State Management
    initializeAuth();

    // Elemen Chat
    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const collapseChatBtn = document.getElementById('collapse-chat-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Fungsi utilitas
    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Fungsi untuk menyimpan percakapan ke localStorage
// Fungsi untuk menyimpan percakapan (pastikan sudah benar)
const saveConversation = () => {
    const messages = [];
    chatMessages.querySelectorAll('.message').forEach(msgElement => {
        const sender = msgElement.classList.contains('user-message') ? 'user' : 'bot';
        
        const contentElement = msgElement.querySelector('.message-content').cloneNode(true);
        const statusElement = contentElement.querySelector('#model-status');
        if (statusElement) {
            statusElement.remove();
        }
        const content = contentElement.innerHTML;

        if (content.trim() !== '') {
            messages.push({ sender, content });
        }
    });
    localStorage.setItem('chatHistory', JSON.stringify(messages));
};

const addMessage = (content, sender) => {
    // 1. Membuat DIV PEMBUNGKUS LUAR
    const messageWrapper = document.createElement('div');
    // 2. Memberi DUA kelas: 'message' dan 'user-message' (atau 'bot-message')
    messageWrapper.className = `message ${sender}-message`;

    // 3. Membuat DIV KONTEN DALAM
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;

    // 4. Memasukkan div konten ke dalam div pembungkus
    messageWrapper.appendChild(messageContent);
    // 5. Memasukkan semuanya ke dalam area chat
    chatMessages.appendChild(messageWrapper);
    
    scrollToBottom();
    
    if (sender !== 'initial') {
        saveConversation();
    }
    return messageWrapper;
};

// Fungsi untuk memuat percakapan (pastikan sudah benar)
const loadConversation = () => {
    const history = JSON.parse(localStorage.getItem('chatHistory'));
    if (history && history.length > 0) {
        // Memanggil fungsi addMessage yang sudah diperbaiki
        history.forEach(msg => addMessage(msg.content, msg.sender));
    } else {
        const initialMsgContent = `<p>Halo! Saya asisten SiMbah. Ada yang bisa saya bantu terkait tanaman herbal?</p><small id="model-status">Menghubungkan ke server...</small>`;
        addMessage(initialMsgContent, 'bot');
    }
};

    // Event Listener untuk Tombol Header
    chatBubble.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatBubble.classList.add('hidden');
    });

    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    });

    collapseChatBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('collapsed');
        // Ganti ikon panah
        const icon = collapseChatBtn.querySelector('i');
        icon.setAttribute('data-feather', chatWindow.classList.contains('collapsed') ? 'chevron-up' : 'chevron-down');
        feather.replace();
    });

    clearChatBtn.addEventListener('click', () => {
        if (confirm('Anda yakin ingin menghapus semua riwayat obrolan ini?')) {
            localStorage.removeItem('chatHistory');
            chatMessages.innerHTML = ''; // Hapus dari UI
            loadConversation(); // Muat ulang pesan selamat datang
            checkModelStatus(); // Cek status model lagi
        }
    });

    // Cek status model AI (sederhana)
    // Karena endpoint /api/status dihapus, kita asumsikan server chat siap.
    const checkModelStatus = async () => {
        try {
            // Aktifkan input dan tombol chat
            chatInput.disabled = false;
            sendBtn.disabled = false;

            const modelStatusEl = document.getElementById('model-status');
            if (modelStatusEl) {
                modelStatusEl.textContent = 'Terhubung. Siap menerima pertanyaan!';
            }
        } catch (error) {
            console.error('Error during local status check:', error);
        }
    };
    
    // Kirim pesan
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = chatInput.value.trim();
        if (!question) return;

        addMessage(`<p>${question}</p>`, 'user');
        chatInput.value = '';

        const typingIndicator = addMessage(
            `<div class="typing-indicator"><span></span><span></span><span></span></div>`, 'bot'
        );

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });

            // Handle PDF responses (application/pdf) separately
            if (response.headers.get('content-type')?.includes('application/pdf')) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                typingIndicator.remove();
                addMessage(`<p>Laporan siap: <a href="${url}" download="rekap_penjualan.pdf">Download PDF</a></p>`, 'bot');
                return;
            }

            const data = await response.json();
            typingIndicator.remove();

            if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan.');

            const cleanedAnswer = (data.answer || '').replace(/\*\*/g, '');
            let sourcesHtml = '';
            let showSourceButtonHtml = '';

            // ... kode Anda yang lain ...

            if (data.retrieved_docs && data.retrieved_docs.length > 0) {
                showSourceButtonHtml = `<button class="source-toggle" data-action="show">Lihat Sumber</button>`;
                sourcesHtml = `
                    <div class="sources-container hidden">
                        ${data.retrieved_docs.map(doc => `
                            <div class="doc-item">
                                <a href="${doc.file_url || '#'}" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                class="doc-title-link"
                                style="font-weight: bold; color: #303d3fff; text-decoration: none;"
                                >
                                    ${doc.rank}. ${doc.title}
                                </a>
                                <p class="doc-meta">
                                    ${doc.author ? `Penulis: ${doc.author}` : ''}
                                    ${doc.year ? ` | Tahun: ${doc.year}` : ''}
                                    ${doc.similarity ? ` | Similarity: ${doc.similarity}` : ''}
                                </p>
                                <p class="doc-snippet">"${doc.snippet}"</p>
                            </div>
                        `).join('')}
                        <button class="source-toggle" data-action="hide">Tutup Sumber</button>
                    </div>`;
            }
            
            addMessage(
                `<p>${cleanedAnswer.replace(/\n/g, '<br>')}</p>
                 ${showSourceButtonHtml}
                 ${sourcesHtml}`,
                'bot'
            );

        } catch (error) {
            typingIndicator.remove();
            addMessage(`<p>Maaf, terjadi error: ${error.message}</p>`, 'bot');
        }
    });

    // Event delegation untuk tombol "Lihat Sumber"
    chatMessages.addEventListener('click', (e) => {
        if (e.target.matches('.source-toggle')) {
            const action = e.target.dataset.action;
            const messageContent = e.target.closest('.message-content');
            const showButton = messageContent.querySelector('.source-toggle[data-action="show"]');
            const sourcesContainer = messageContent.querySelector('.sources-container');

            if (action === 'show') {
                showButton.classList.add('hidden');
                sourcesContainer.classList.remove('hidden');
            } else if (action === 'hide') {
                sourcesContainer.classList.add('hidden');
                showButton.classList.remove('hidden');
            }
            scrollToBottom();
        }
    });

    // Inisialisasi
    loadConversation();
    checkModelStatus();
});

// Authentication Management Functions
function initializeAuth() {
    // Check for authentication tokens in URL (for OAuth redirect)
    checkUrlForTokens();
    
    // Attempt to refresh token if expired/near expiry
    maybeRefreshSession().catch(() => {/* noop */});

    // Update navbar based on auth state
    updateNavbarAuth();
    
    // Setup auth event listeners
    setupAuthEventListeners();
    
    // Check page access permissions
    checkPageAccess();
}

function checkUrlForTokens() {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const type = urlParams.get('type');
    
    if (accessToken) {
        try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            const userData = {
                id: payload.sub,
                email: payload.email,
                name: payload.user_metadata?.full_name || payload.email,
                avatar: payload.user_metadata?.avatar_url,
                avatar_url: payload.user_metadata?.avatar_url,
                provider: payload.app_metadata?.provider
            };
            
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('access_token', accessToken);
            
            // Store refresh token if available
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken);
            }
            
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Update navbar
            updateNavbarAuth();
            
            console.log('Authentication successful, user logged in');
        } catch (error) {
            console.error('Error parsing token:', error);
        }
    }
}

function updateNavbarAuth() {
    const navbarExtra = document.querySelector('.navbar-extra');
    if (!navbarExtra) return;
    
    // Find existing auth elements and remove them
    const existingAuth = navbarExtra.querySelector('.login-btn, .user-profile');
    if (existingAuth) {
        existingAuth.remove();
    }
    
    const user = getCurrentUser();
    
    if (user) {
        // User is logged in - show profile
        const userProfile = createUserProfile(user);
        navbarExtra.insertBefore(userProfile, navbarExtra.firstChild);
    } else {
        // User is not logged in - show login button
        const loginBtn = createLoginButton();
        navbarExtra.insertBefore(loginBtn, navbarExtra.firstChild);
    }
    
    // Re-initialize Feather icons
    feather.replace();
}

// Simple avatar cache helpers (data URL)
function getCachedAvatar() {
    try { return localStorage.getItem('avatar_data_url') || null; } catch { return null; }
}
function setCachedAvatar(dataUrl) {
    try { if (dataUrl) localStorage.setItem('avatar_data_url', dataUrl); } catch {}
}
function clearCachedAvatar() {
    try { localStorage.removeItem('avatar_data_url'); } catch {}
}

function createLoginButton() {
    const loginBtn = document.createElement('a');
    loginBtn.href = '/login.html';
    loginBtn.className = 'login-btn';
    loginBtn.innerHTML = '<i data-feather="log-in"></i> Masuk';
    return loginBtn;
}

function createUserProfile(user) {
    const userProfile = document.createElement('div');
    userProfile.className = 'user-profile';
    
    // Debug: print avatar sources
    try {
        const cached = getCachedAvatar();
        console.debug('[Avatar][Navbar] sources:', {
            cached: cached ? `data-url(${cached.length} chars)` : null,
            user_avatar: user?.avatar || null,
            user_avatar_url: user?.avatar_url || null,
            user_picture: user?.picture || null
        });
    } catch {}

    const avatar = getCachedAvatar() || user.avatar_url || user.avatar || user.picture || '/favicon.png'; // prefer DB avatar
    const displayName = user.name || user.email;
    
    userProfile.innerHTML = `
    <img src="${avatar}" alt="${displayName}" class="user-avatar" onerror="this.src='/favicon.png'">
        <span class="user-name">${displayName}</span>
        <i data-feather="chevron-down"></i>
    <div class="user-dropdown">
            <a href="#" class="dropdown-item" data-action="profile">
                <i data-feather="user"></i>
                Profil Saya
            </a>
            <div class="dropdown-divider"></div>
            <a href="#" class="dropdown-item" data-action="logout">
                <i data-feather="log-out"></i>
                Keluar
            </a>
        </div>
    `;
    
    return userProfile;
}

function setupAuthEventListeners() {
    // Handle user profile dropdown
    document.addEventListener('click', (e) => {
        const userProfile = e.target.closest('.user-profile');
        const dropdown = document.querySelector('.user-dropdown');
        
        if (userProfile && dropdown) {
            e.preventDefault();
            dropdown.classList.toggle('show');
        } else if (dropdown && !dropdown.contains(e.target)) {
            // Close dropdown when clicking outside
            dropdown.classList.remove('show');
        }
        
        // Handle dropdown actions
        if (e.target.closest('.dropdown-item')) {
            e.preventDefault();
            const action = e.target.closest('.dropdown-item').dataset.action;
            handleDropdownAction(action);
        }
    });
}

function handleDropdownAction(action) {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    switch (action) {
        case 'profile':
            // Go to profile page
            redirectToProfile();
            break;
        case 'logout':
            logout();
            break;
    }
}

// Simplified profile routing function
function redirectToProfile() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Go directly to user profile page
    window.location.href = '/user/profile.html';
}

// redirectToSettings removed per request

// Page protection function
function checkPageAccess() {
    const currentPath = window.location.pathname;
    const user = getCurrentUser();
    
    // If user is not logged in and trying to access protected pages
    if (!user && (currentPath.includes('/user/') || currentPath.includes('/admin/'))) {
        window.location.href = '/login.html';
        return false;
    }
    
    return true;
}

function logout() {
    // Show confirmation dialog
    Swal.fire({
        title: 'Keluar dari Akun?',
        text: 'Anda yakin ingin keluar dari akun Anda?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#5A7D7C',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            performLogout();
        }
    });
}

function performLogout() {
    const accessToken = localStorage.getItem('access_token');
    
    // Show loading
    Swal.fire({
        title: 'Logging out...',
        text: 'Sedang memproses logout',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Call logout API if we have a token
    if (accessToken) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                console.log('Server logout successful');
            } else {
                console.log('Server logout failed, continuing with client logout');
            }
        }).catch(error => {
            console.log('Logout API error:', error);
        }).finally(() => {
            // Always perform client-side logout regardless of server response
            performClientLogout();
        });
    } else {
        // No token, just perform client-side logout
        performClientLogout();
    }
}

function performClientLogout() {
    // Clear local storage
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    
    // Clear any other auth-related data
    localStorage.removeItem('refresh_token');
    clearCachedAvatar();
    
    // Update navbar
    updateNavbarAuth();
    
    // Show success message
    Swal.fire({
        title: 'Logout Berhasil!',
        text: 'Anda telah berhasil keluar dari akun',
        icon: 'success',
        confirmButtonColor: '#5A7D7C',
        confirmButtonText: 'OK',
        timer: 2000,
        timerProgressBar: true
    }).then(() => {
        // Optional: redirect to dashboard page if not already there
        if (window.location.pathname !== '/dashboard.html' && window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = '/dashboard.html';
        }
    });
}

function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

function isAuthenticated() {
    return getCurrentUser() !== null;
}

// --- Minimal token refresh helpers ---
function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
    } catch { return null; }
}

function isAccessTokenExpiringSoon(token, skewSeconds = 60) {
    const p = decodeJwt(token);
    if (!p?.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return p.exp - now <= skewSeconds;
}

async function maybeRefreshSession() {
    const at = localStorage.getItem('access_token');
    const rt = localStorage.getItem('refresh_token');
    if (!rt) return; // nothing to do

    // Refresh if no access token or expiring soon/expired
    if (!at || isAccessTokenExpiringSoon(at, 60)) {
        try {
            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: rt })
            });
            if (!res.ok) {
                // If refresh fails, clear tokens to force re-login later
                localStorage.removeItem('access_token');
                // keep refresh token; user might still try again after navigation
                return;
            }
            const data = await res.json();
            if (data?.session?.access_token) {
                localStorage.setItem('access_token', data.session.access_token);
            }
            if (data?.session?.refresh_token) {
                localStorage.setItem('refresh_token', data.session.refresh_token);
            }
        } catch (e) {
            // network issues; ignore
        }
    }
}