// public/js/user-profile.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in and is a regular user
    if (typeof checkPageAccess === 'function') {
        checkPageAccess('user');
    }

    // Initialize page elements and event listeners
    initializeProfilePage();

    // Load user profile data
    loadUserProfile();
});

function initializeProfilePage() {
    // Initialize Feather icons
    feather.replace();

    // Setup menu navigation
    const menuLinks = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Update active link
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active content
            contentSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    // Handle profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Handle change/set password
    const changePwdBtn = document.getElementById('btn-change-password');
    if (changePwdBtn) {
        changePwdBtn.addEventListener('click', handleChangePassword);
    }

    // Avatar upload handlers
    const avatarInput = document.getElementById('avatar-input');
    const avatarBtn = document.getElementById('btn-upload-avatar');
    if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', handleAvatarSelected);
    }

    // Handle logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Handle sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && 
                !sidebar.contains(e.target) && 
                !sidebarToggle.contains(e.target) &&
                sidebar.classList.contains('show')) {
                sidebar.classList.remove('show');
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
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            // Explicitly remove avatar cache key (in case clear was scoped)
            try { localStorage.removeItem('avatar_data_url'); } catch {}
            window.location.href = '../login.html';
        }
    });
}

async function loadUserProfile() {
    try {
        const userStr = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');

        // Set default values first
        const defaultName = 'User';
        const defaultEmail = 'user@example.com';
        const defaultInitial = 'U';

        // Set default values in UI
        document.getElementById('sidebar-profile-name').textContent = defaultName;
        document.getElementById('sidebar-profile-email').textContent = defaultEmail;
        
    // Set default avatar with favicon.png (absolute path to avoid relative issues)
        const avatarContainer = document.getElementById('sidebar-avatar-container');
    avatarContainer.innerHTML = `<img src="/favicon.png" alt="Avatar" class="sidebar-avatar">`;

        if (!userStr || !token) {
            console.warn('No user data found, using favicon as default avatar');
            return;
        }

        const user = JSON.parse(userStr);

        // Update sidebar user info with real data
        if (user.name) {
            document.getElementById('sidebar-profile-name').textContent = user.name;
        }
        if (user.email) {
            document.getElementById('sidebar-profile-email').textContent = user.email;
        }

        // Update avatar in sidebar and preview from cached value or localStorage first
        const cached = localStorage.getItem('avatar_data_url');
        try {
            console.debug('[Avatar][Profile] initial sources:', {
                cached: cached ? `data-url(${cached.length} chars)` : null,
                picture: user.picture || null,
                avatar: user.avatar || null,
                avatar_url: user.avatar_url || null
            });
        } catch {}
        if (cached || user.avatar || user.picture || user.avatar_url) {
            const avatarUrl = cached || user.avatar_url || user.avatar || user.picture;
            avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='/favicon.png';">`;
            const curr = document.getElementById('current-avatar-img');
            if (curr) { curr.src = avatarUrl; }
        } else {
            avatarContainer.innerHTML = `<img src="/favicon.png" alt="Avatar" class="sidebar-avatar">`;
            const curr = document.getElementById('current-avatar-img');
            if (curr) { curr.src = '/favicon.png'; }
        }

        // Populate form fields in the 'Profil' section
        const fullNameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        
        if (fullNameInput && user.name) {
            fullNameInput.value = user.name;
        }
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }

        // Fetch additional profile data (like phone number) from API
        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const profileData = await response.json();
                try {
                    console.debug('[Avatar][Profile] API response user:', {
                        avatar: profileData?.user?.avatar || null,
                        avatar_url: profileData?.user?.avatar_url || null
                    });
                } catch {}
                // Toggle password hint and button label based on password_set
                const isSet = !!profileData.profile?.password_set;
                const hint = document.getElementById('password-hint');
                const btnText = document.getElementById('btn-change-password-text');
                if (hint) hint.style.display = isSet ? 'none' : 'block';
                if (btnText) btnText.textContent = isSet ? 'Ganti Password' : 'Set Password';

                // Hydrate avatar from API response if available
                const apiUser = profileData.user || {};
                const apiAvatar = apiUser.avatar_url || apiUser.avatar || apiUser.picture;
                if (apiAvatar) {
                    // Update UI images
                    avatarContainer.innerHTML = `<img src="${apiAvatar}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='/favicon.png';">`;
                    const curr = document.getElementById('current-avatar-img');
                    if (curr) { curr.src = apiAvatar; }
                    try { console.debug('[Avatar][Profile] using API avatar:', apiAvatar); } catch {}

                    // Merge into localStorage user
                    const stored = JSON.parse(localStorage.getItem('user') || '{}');
                    stored.avatar = apiAvatar;
                    stored.avatar_url = apiAvatar;
                    if (apiUser.name) stored.name = apiUser.name;
                    if (apiUser.email) stored.email = apiUser.email;
                    localStorage.setItem('user', JSON.stringify(stored));

                    // Also cache the avatar as data URL to avoid CORS/caching glitches
                    try {
                        const r = await fetch(apiAvatar, { cache: 'no-store' });
                        if (r.ok) {
                            const blob = await r.blob();
                            if (blob.size < 2.5 * 1024 * 1024) { // 2.5MB guard
                                const reader = new FileReader();
                                const p = new Promise(res => { reader.onloadend = () => res(reader.result); });
                                reader.readAsDataURL(blob);
                                const dataUrl = await p;
                                localStorage.setItem('avatar_data_url', dataUrl);
                            }
                        }
                    } catch(err) { try { console.debug('[Avatar][Profile] cache error:', err?.message || err); } catch {} }

                    // Update navbar avatar if function exists
                    if (typeof updateAuthSection === 'function') { updateAuthSection(); }
                    if (typeof updateNavbarAuth === 'function') { updateNavbarAuth(); }
                }
            }
        } catch (apiError) {
            console.warn('Could not fetch additional profile data:', apiError);
        }

    } catch (error) {
        console.error('Error loading profile:', error);
        // Keep default values if there's an error
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const fullName = document.getElementById('full-name').value;
    const token = localStorage.getItem('access_token');

    if (!token) {
        Swal.fire({
            title: 'Sesi Berakhir',
            text: 'Anda harus login terlebih dahulu untuk menyimpan perubahan.',
               icon: 'warning',
               confirmButtonColor: '#4A6C8A'
        });
        return;
    }

    // Show loading indicator
    Swal.fire({
        title: 'Menyimpan...',
        text: 'Mohon tunggu sebentar',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // API call to update profile
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: fullName })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Gagal memperbarui profil');
        }

        // Update local storage
    const user = JSON.parse(localStorage.getItem('user'));
        user.name = fullName;
        localStorage.setItem('user', JSON.stringify(user));

        // Update UI elements
        document.getElementById('sidebar-profile-name').textContent = fullName;
        
        // Update avatar initial
        const avatarContainer = document.getElementById('sidebar-avatar-container');
        const currentUser = JSON.parse(localStorage.getItem('user'));
        
        // Use Google avatar, user avatar, or favicon as fallback
        if (currentUser.picture || currentUser.avatar || currentUser.avatar_url) {
            const avatarUrl = currentUser.avatar_url || currentUser.avatar || currentUser.picture;
            avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='/favicon.png';">`;
        } else {
            avatarContainer.innerHTML = `<img src="/favicon.png" alt="Avatar" class="sidebar-avatar">`;
        }
        
        // Update the navbar if updateAuthSection function exists
    if (typeof updateAuthSection === 'function') { updateAuthSection(); }

        Swal.fire({
            title: 'Berhasil!',
            text: 'Profil Anda telah berhasil diperbarui.',
            icon: 'success',
        confirmButtonColor: '#4A6C8A'
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        Swal.fire({
            title: 'Error!',
            text: error.message || 'Terjadi kesalahan saat memperbarui profil.',
            icon: 'error',
            confirmButtonColor: '#4A6C8A'
        });
    }
}

async function handleAvatarSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
    Swal.fire({ title: 'File tidak valid', text: 'Pilih gambar (PNG/JPG).', icon: 'warning', confirmButtonColor: '#4A6C8A' });
        return;
    }
    if (file.size > 3 * 1024 * 1024) {
    Swal.fire({ title: 'Terlalu besar', text: 'Maksimal 3MB.', icon: 'warning', confirmButtonColor: '#4A6C8A' });
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
    Swal.fire({ title: 'Sesi berakhir', text: 'Silakan login ulang.', icon: 'warning', confirmButtonColor: '#4A6C8A' });
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    Swal.fire({ title: 'Mengunggah...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengunggah');

        // Update preview + sidebar + localStorage
        const url = data.url;
        const curr = document.getElementById('current-avatar-img');
        if (curr) curr.src = url;

        const avatarContainer = document.getElementById('sidebar-avatar-container');
        if (avatarContainer) {
            avatarContainer.innerHTML = `<img src="${url}" alt="Avatar" class="sidebar-avatar" onerror="this.onerror=null; this.src='../favicon.png';">`;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.avatar = url;
        user.avatar_url = url;
        localStorage.setItem('user', JSON.stringify(user));

        if (typeof updateAuthSection === 'function') { updateAuthSection(); }

    Swal.fire({ title: 'Berhasil', text: 'Foto profil diperbarui.', icon: 'success', confirmButtonColor: '#2F8ED6' });
    } catch (err) {
    Swal.fire({ title: 'Gagal', text: err.message, icon: 'error', confirmButtonColor: '#4A6C8A' });
    }
}

async function handleChangePassword() {
    const token = localStorage.getItem('access_token');
    if (!token) {
    Swal.fire({ title: 'Sesi berakhir', text: 'Silakan login ulang.', icon: 'warning', confirmButtonColor: '#4A6C8A' });
        return;
    }

    // Ask for new password (and optionally confirmation)
        const { value: formValues } = await Swal.fire({
                title: 'Setel / Ganti Password',
                html: `
                        <div style="text-align:left; display:flex; flex-direction:column; gap:.9rem;">
                            <div>
                                <label for="swal-pass" style="display:block;font-size:.95rem;font-weight:600;color:#374151;margin-bottom:.35rem;">Password baru</label>
                                <input type="password" id="swal-pass" class="swal2-input" placeholder="Minimal 6 karakter" style="margin:0;width:100%;box-sizing:border-box;">
                            </div>
                            <div>
                                <label for="swal-pass2" style="display:block;font-size:.95rem;font-weight:600;color:#374151;margin-bottom:.35rem;">Ulangi password</label>
                                <input type="password" id="swal-pass2" class="swal2-input" placeholder="Ketik ulang password" style="margin:0;width:100%;box-sizing:border-box;">
                            </div>
                        </div>
                `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
    confirmButtonColor: '#4A6C8A',
        willOpen: () => {
            // Enter submits, Escape cancels
            const pass = Swal.getPopup().querySelector('#swal-pass');
            const pass2 = Swal.getPopup().querySelector('#swal-pass2');
            pass.addEventListener('keyup', e => { if (e.key === 'Enter') Swal.clickConfirm(); });
            pass2.addEventListener('keyup', e => { if (e.key === 'Enter') Swal.clickConfirm(); });
        },
        preConfirm: () => {
            const p1 = document.getElementById('swal-pass').value.trim();
            const p2 = document.getElementById('swal-pass2').value.trim();
            if (!p1 || p1.length < 6) {
                Swal.showValidationMessage('Password minimal 6 karakter');
                return false;
            }
            if (p1 !== p2) {
                Swal.showValidationMessage('Konfirmasi password tidak sama');
                return false;
            }
            return p1;
        }
    });

    if (!formValues) return; // cancelled

    try {
        const res = await fetch('/api/auth/password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: formValues })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyetel password');

        // Update UI
        const hint = document.getElementById('password-hint');
        const btnText = document.getElementById('btn-change-password-text');
        if (hint) hint.style.display = 'none';
        if (btnText) btnText.textContent = 'Ganti Password';

    Swal.fire({ title: 'Berhasil', text: 'Password berhasil diperbarui.', icon: 'success', confirmButtonColor: '#2F8ED6' });
    } catch (err) {
    Swal.fire({ title: 'Gagal', text: err.message, icon: 'error', confirmButtonColor: '#4A6C8A' });
    }
}
