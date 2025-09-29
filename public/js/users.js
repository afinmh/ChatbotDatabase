// users.js - CRUD for user data

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAccess()) return;
    
    loadUserList();
    setupEventListeners();
    feather.replace();
});

function checkAccess() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function setupEventListeners() {
    // Add user button - Note: Adding users typically happens through registration
    // so this might be more for admin functions like creating accounts
    
    // Search functionality
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            // Debounce search
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                loadUserList(1, e.target.value);
            }, 300);
        });
    }
}

async function loadUserList(page = 1, search = '') {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        let url = `/api/users/admin?page=${page}&limit=12`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load user data');
        }

        const data = await response.json();
        renderUserGrid(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading user list:', error);
        showNotification('Gagal memuat data pengguna', 'error');
    }
}

function renderUserGrid(users) {
    const grid = document.getElementById('user-grid');
    if (!grid) return;

    if (!users || users.length === 0) {
        grid.innerHTML = '<p class="no-data">Tidak ada data pengguna ditemukan</p>';
        return;
    }

    grid.innerHTML = users.map(user => `
        <div class="card-item">
            <div class="card-header">
                <h3>${user.name || user.email || 'User Tak Dikenal'}</h3>
                <span class="status ${user.is_verified ? 'approved' : 'pending'}">${user.is_verified ? 'Terverifikasi' : 'Belum Terverifikasi'}</span>
            </div>
            <div class="card-body">
                <p><strong>Email:</strong> ${user.email || '-'}</p>
                <p><strong>Role:</strong> ${user.role || 'user'}</p>
                <p><strong>Terdaftar:</strong> ${formatDate(user.created_at)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-icon" onclick="editUser('${user.id}', '${user.name || ''}', '${user.email || ''}', '${user.role || 'user'}', ${user.is_verified})">
                    <i data-feather="edit"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteUser('${user.id}')">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');

    feather.replace();
}

function renderPagination(pagination) {
    if (!pagination || !pagination.totalPages) return;
    
    const paginationEl = document.getElementById('user-pagination');
    if (!paginationEl) return;

    let paginationHTML = '';

    // Previous button
    paginationHTML += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="loadUserList(${pagination.page - 1})">
        <i data-feather="chevron-left"></i>
    </button>`;

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="loadUserList(${i})">${i}</button>`;
        }
    }

    // Next button
    paginationHTML += `<button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="loadUserList(${pagination.page + 1})">
        <i data-feather="chevron-right"></i>
    </button>`;

    paginationEl.innerHTML = paginationHTML;
    feather.replace();
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function editUser(id, name, email, role, isVerified) {
    // Create a simple form modal for editing user details
    const modalHtml = `
        <div class="modal show" id="edit-user-modal" style="display: flex;">
            <div class="modal-dialog" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Edit Pengguna</h3>
                    <button class="modal-close" onclick="closeEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="edit-name">Nama</label>
                        <input type="text" id="edit-name" value="${name}" />
                    </div>
                    <div class="form-group">
                        <label for="edit-email">Email</label>
                        <input type="email" id="edit-email" value="${email}" readonly />
                    </div>
                    <div class="form-group">
                        <label for="edit-role">Role</label>
                        <select id="edit-role">
                            <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-verified">
                            <input type="checkbox" id="edit-verified" ${isVerified ? 'checked' : ''} />
                            Terverifikasi
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeEditModal()">Batal</button>
                    <button class="btn-primary" onclick="saveUserEdit('${id}')">Simpan</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modals first
    const existingModal = document.getElementById('edit-user-modal');
    if (existingModal) existingModal.remove();
    
    // Add the new modal to the body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
    feather.replace();
}

function closeEditModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

async function saveUserEdit(id) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const updatedData = {
            id: id,
            name: document.getElementById('edit-name').value,
            email: document.getElementById('edit-email').value,
            role: document.getElementById('edit-role').value,
            is_verified: document.getElementById('edit-verified').checked
        };

        const response = await fetch('/api/users/admin', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        if (response.status === 401) {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal menyimpan data pengguna');
        }

        const result = await response.json();
        
        closeEditModal();
        loadUserList();
        showNotification('Data pengguna berhasil diperbarui', 'success');
    } catch (error) {
        console.error('Error saving user:', error);
        showNotification(error.message || 'Gagal menyimpan data pengguna', 'error');
    }
}

async function deleteUser(id) {
    Swal.fire({
        title: 'Anda yakin?',
        text: "Data pengguna ini akan dihapus secara permanen!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const accessToken = localStorage.getItem('access_token');
                if (!accessToken) {
                    window.location.href = '/login.html';
                    return;
                }

                const response = await fetch(`/api/users/admin?id=${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.status === 401) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login.html';
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Gagal menghapus data pengguna');
                }

                loadUserList();
                showNotification('Data pengguna berhasil dihapus', 'success');
            } catch (error) {
                console.error('Error deleting user:', error);
                showNotification(error.message || 'Gagal menghapus data pengguna', 'error');
            }
        }
    });
}

function showNotification(message, type = 'info') {
    // Simple notification using SweetAlert2
    Swal.fire({
        title: type === 'success' ? 'Berhasil!' : type === 'error' ? 'Gagal!' : 'Info',
        text: message,
        icon: type,
        confirmButtonText: 'OK',
        timer: 3000,
        timerProgressBar: true
    });
}