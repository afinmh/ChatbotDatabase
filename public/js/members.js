// members.js - CRUD for members data

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAccess()) return;
    
    loadMemberList();
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
    // Add member button
    const addMemberBtn = document.getElementById('add-member');
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', openMemberModal);
    }
    
    // Save member button
    document.getElementById('save-member').addEventListener('click', saveMember);
    
    // Close modal buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Close modal when clicking outside
    document.getElementById('member-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

async function loadMemberList(page = 1) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch(`/api/members?page=${page}&limit=12`, {
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
            throw new Error('Failed to load member data');
        }

        const data = await response.json();
        renderMemberGrid(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading member list:', error);
        showNotification('Gagal memuat data member', 'error');
    }
}

function renderMemberGrid(members) {
    const grid = document.getElementById('member-grid');
    if (!grid) return;

    if (!members || members.length === 0) {
        grid.innerHTML = '<p class="no-data">Tidak ada data member ditemukan</p>';
        return;
    }

    grid.innerHTML = members.map(member => `
        <div class="card-item">
            <div class="card-header">
                <h3>${member.name || 'Member Tanpa Nama'}</h3>
            </div>
            <div class="card-body">
                <p><strong>Email:</strong> ${member.email || '-'}</p>
                <p><strong>Telepon:</strong> ${member.phone || '-'}</p>
                <p><strong>Terdaftar:</strong> ${formatDate(member.created_at)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-icon" ${isValidUUID(member.id) ? `onclick="editMember('${member.id}')"` : 'disabled'}>
                    <i data-feather="edit"></i>
                </button>
                <button class="btn-icon danger" ${isValidUUID(member.id) ? `onclick="deleteMember('${member.id}')"` : 'disabled'}>
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');

    feather.replace();
}

function renderPagination(pagination) {
    if (!pagination || !pagination.totalPages) return;
    
    const paginationEl = document.getElementById('member-pagination');
    if (!paginationEl) return;

    let paginationHTML = '';

    // Previous button
    paginationHTML += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="loadMemberList(${pagination.page - 1})">
        <i data-feather="chevron-left"></i>
    </button>`;

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="loadMemberList(${i})">${i}</button>`;
        }
    }

    // Next button
    paginationHTML += `<button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="loadMemberList(${pagination.page + 1})">
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

// Client-side UUID validation (matches server-side pattern)
function isValidUUID(id) {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

function openMemberModal(member = null) {
    const modal = document.getElementById('member-modal');
    const title = document.getElementById('member-modal-title');
    
    if (member) {
        title.textContent = 'Edit Member';
        document.getElementById('member-id').value = member.id || '';
        document.getElementById('member-name').value = member.name || '';
        document.getElementById('member-email').value = member.email || '';
        document.getElementById('member-phone').value = member.phone || '';
    } else {
        title.textContent = 'Tambah Member';
        document.getElementById('member-form').reset();
        document.getElementById('member-id').value = '';
    }
    
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('member-modal');
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

async function saveMember() {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const name = document.getElementById('member-name').value.trim();
        const email = document.getElementById('member-email').value.trim();
        const phone = document.getElementById('member-phone').value.trim();
        const memberId = document.getElementById('member-id').value;

        // Validation
        if (!name) {
            showNotification('Nama member wajib diisi', 'error');
            return;
        }
        
        if (!email) {
            showNotification('Email member wajib diisi', 'error');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Format email tidak valid', 'error');
            return;
        }

        const formData = {
            name: name,
            email: email,
            phone: phone
        };

        let response;
        if (memberId && memberId.trim() !== '') {
            // Ensure the ID is a valid UUID before attempting update
            if (!isValidUUID(memberId)) {
                showNotification('ID member tidak valid', 'error');
                return;
            }

            // Update existing member
            response = await fetch('/api/members', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: memberId, ...formData })
            });
        } else {
            // Create new member
            response = await fetch('/api/members', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }

        if (response.status === 401) {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal menyimpan data member');
        }

        const result = await response.json();
        
        closeModal();
        loadMemberList();
        showNotification('Data member berhasil disimpan', 'success');
    } catch (error) {
        console.error('Error saving member:', error);
        showNotification(error.message || 'Gagal menyimpan data member', 'error');
    }
}

async function editMember(id) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        // Fetch the specific member by ID
        const response = await fetch(`/api/members?id=${id}`, {
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
            throw new Error('Gagal memuat data member');
        }

        const data = await response.json();
        const member = data.data;
        
        if (member) {
            openMemberModal(member);
        }
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showNotification('Gagal memuat data member', 'error');
    }
}

async function deleteMember(id) {
    Swal.fire({
        title: 'Anda yakin?',
        text: "Data member ini akan dihapus secara permanen!",
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

                const response = await fetch(`/api/members?id=${id}`, {
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
                    throw new Error(errorData.error || 'Gagal menghapus data member');
                }

                loadMemberList();
                showNotification('Data member berhasil dihapus', 'success');
            } catch (error) {
                console.error('Error deleting member:', error);
                showNotification(error.message || 'Gagal menghapus data member', 'error');
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