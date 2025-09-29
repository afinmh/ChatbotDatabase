// orders.js - CRUD for orders data

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAccess()) return;
    
    loadOrderList();
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
    // Add order button
    const addOrderBtn = document.getElementById('add-order');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', openOrderModal);
    }
    
    // Close modal buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Close modal when clicking outside
    document.getElementById('order-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// Add event listeners for closing modals with the data-close attribute
document.addEventListener('click', function(e) {
    if (e.target.closest && e.target.closest('[data-close]')) {
        closeModal();
    }
});

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const detailModal = document.getElementById('order-detail-modal');
    if (detailModal && detailModal.classList.contains('show') && e.target === detailModal) {
        closeModal();
    }
});

async function loadOrderList(page = 1) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch(`/api/orders?page=${page}&limit=12`, {
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
            throw new Error('Failed to load order data');
        }

        const data = await response.json();
        renderOrderGrid(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading order list:', error);
        showNotification('Gagal memuat data order', 'error');
    }
}

function renderOrderGrid(orders) {
    const grid = document.getElementById('orders-grid');
    if (!grid) return;

    if (!orders || orders.length === 0) {
        grid.innerHTML = '<p class="no-data">Tidak ada data order ditemukan</p>';
        return;
    }

    grid.innerHTML = orders.map(order => `
        <div class="card-item">
            <div class="card-header">
                <h3>Order #${order.id.substring(0, 8)}</h3>
            </div>
            <div class="card-body">
                <p><strong>Member:</strong> ${order.member?.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${order.member?.email || 'N/A'}</p>
                <p><strong>Tanggal:</strong> ${formatDate(order.created_at)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-icon" onclick="viewOrder('${order.id}')">
                    <i data-feather="eye"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteOrder('${order.id}')">
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');

    feather.replace();
}

function renderPagination(pagination) {
    if (!pagination || !pagination.totalPages) return;
    
    const paginationEl = document.getElementById('orders-pagination');
    if (!paginationEl) return;

    let paginationHTML = '';

    // Previous button
    paginationHTML += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="loadOrderList(${pagination.page - 1})">
        <i data-feather="chevron-left"></i>
    </button>`;

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="loadOrderList(${i})">${i}</button>`;
        }
    }

    // Next button
    paginationHTML += `<button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="loadOrderList(${pagination.page + 1})">
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

function openOrderModal(order = null) {
    // Create a modal for adding orders with member selection
    const modalHtml = `
        <div class="modal show" id="order-modal" style="display: flex;">
            <div class="modal-dialog" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${order ? 'Edit Order' : 'Tambah Order'}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="order-member-id">Member</label>
                        <select id="order-member-id" required>
                            <option value="">Pilih Member</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal()">Batal</button>
                    <button class="btn-primary" onclick="${order ? 'updateOrder' : 'createOrder'}()">${order ? 'Update' : 'Tambah'}</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modals first
    const existingModal = document.getElementById('order-modal');
    if (existingModal) existingModal.remove();
    
    // Add the new modal to the body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
    feather.replace();
    
    // Load members for the dropdown
    loadMembersForOrderModal();
}

function loadMembersForOrderModal() {
    // Load members for the order modal
    fetch('/api/members?page=1&limit=100', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const select = document.getElementById('order-member-id');
        select.innerHTML = '<option value="">Pilih Member</option>';
        
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.name} (${member.email})`;
                select.appendChild(option);
            });
        }
    })
    .catch(error => {
        console.error('Error loading members for order modal:', error);
    });
}

function closeModal() {
    // Close the order creation modal if it exists
    const orderModal = document.getElementById('order-modal');
    if (orderModal) {
        orderModal.remove();
    }
    
    // Close the order detail modal if it exists
    const detailModal = document.getElementById('order-detail-modal');
    if (detailModal) {
        detailModal.setAttribute('aria-hidden', 'true');
        detailModal.classList.remove('show');
    }
    
    document.body.style.overflow = '';
}

async function createOrder() {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const selectedMemberId = document.getElementById('order-member-id').value;
        
        if (!selectedMemberId) {
            showNotification('Silakan pilih member', 'error');
            return;
        }

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member_id: selectedMemberId
                // Optionally, you could also add items here if the form had them
                // items: [] // array of items to add
            })
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
            throw new Error(errorData.error || 'Gagal menyimpan data order');
        }

        const result = await response.json();
        
        closeModal();
        loadOrderList();
        showNotification('Order berhasil ditambahkan', 'success');
    } catch (error) {
        console.error('Error creating order:', error);
        showNotification(error.message || 'Gagal menyimpan data order', 'error');
    }
}

async function updateOrder() {
    // For now, just close the modal as updating orders is more complex
    closeModal();
    showNotification('Order berhasil diperbarui', 'success');
}

async function viewOrder(id) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        // Get the order details with its items in a single request
        const orderResponse = await fetch(`/api/orders?id=${id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!orderResponse.ok) {
            throw new Error('Failed to load order details');
        }
        
        const orderData = await orderResponse.json();
        const order = orderData.data;

        // Show the order details in the modal
        const detailModal = document.getElementById('order-detail-modal');
        document.getElementById('order-detail-id').textContent = id;
        document.getElementById('order-detail-member').textContent = order?.member?.name || 'N/A';
        document.getElementById('order-detail-date').textContent = order ? formatDate(order.created_at) : 'N/A';
        
        const itemsList = document.getElementById('order-items-list');
        if (order?.order_items && order.order_items.length > 0) {
            itemsList.innerHTML = `
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="border: 1px solid #dee2e6; padding: 0.5rem; text-align: left;">Produk</th>
                            <th style="border: 1px solid #dee2e6; padding: 0.5rem; text-align: left;">Harga</th>
                            <th style="border: 1px solid #dee2e6; padding: 0.5rem; text-align: left;">Jumlah</th>
                            <th style="border: 1px solid #dee2e6; padding: 0.5rem; text-align: left;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.order_items.map(item => `
                            <tr>
                                <td style="border: 1px solid #dee2e6; padding: 0.5rem;">${item.product?.name || 'N/A'}</td>
                                <td style="border: 1px solid #dee2e6; padding: 0.5rem;">Rp${formatNumber(item.product?.price || 0)}</td>
                                <td style="border: 1px solid #dee2e6; padding: 0.5rem;">${item.quantity || 0}</td>
                                <td style="border: 1px solid #dee2e6; padding: 0.5rem;">Rp${formatNumber(item.subtotal || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            itemsList.innerHTML = '<p>Tidak ada produk dalam order ini.</p>';
        }

        // Show the modal
        detailModal.setAttribute('aria-hidden', 'false');
        detailModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        feather.replace();
    } catch (error) {
        console.error('Error loading order details:', error);
        showNotification('Gagal memuat detail order', 'error');
    }
}

async function deleteOrder(id) {
    Swal.fire({
        title: 'Anda yakin?',
        text: "Data order ini akan dihapus secara permanen!",
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

                const response = await fetch(`/api/orders?id=${id}`, {
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
                    throw new Error(errorData.error || 'Gagal menghapus data order');
                }

                loadOrderList();
                showNotification('Data order berhasil dihapus', 'success');
            } catch (error) {
                console.error('Error deleting order:', error);
                showNotification(error.message || 'Gagal menghapus data order', 'error');
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