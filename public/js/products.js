// products.js - CRUD for products data

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAccess()) return;
    
    loadProductList();
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
    // Prevent binding listeners more than once
    if (window.__productsListenersBound) {
        console.info('[products] setupEventListeners skipped (already bound)');
        return;
    }
    window.__productsListenersBound = true;

    // Add product button
    const addProductBtn = document.getElementById('add-product');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', openProductModal);
    }

    // Save product button (combined modal)
    const saveProductBtn = document.getElementById('save-product');
    if (saveProductBtn) {
        // Named handler to avoid accidental duplicate anonymous bindings
        const handleSaveClick = (e) => { e.preventDefault(); saveProduct(); };
        saveProductBtn.addEventListener('click', handleSaveClick);
    }

    // Close modal buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Close modal when clicking outside (product modal)
    const productModalEl = document.getElementById('product-modal');
    if (productModalEl) {
        productModalEl.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
}

async function loadProductList(page = 1) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch(`/api/products?page=${page}&limit=12`, {
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
            throw new Error('Failed to load product data');
        }

        const data = await response.json();
        renderProductGrid(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading product list:', error);
        showNotification('Gagal memuat data produk', 'error');
    }
}

function renderProductGrid(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = '<p class="no-data">Tidak ada data produk ditemukan</p>';
        return;
    }

    grid.innerHTML = products.map(product => `
        <div class="card-item">
            <div class="card-header">
                <h3>${product.name || 'Produk Tanpa Nama'}</h3>
            </div>
            <div class="card-body">
                <p><strong>Harga:</strong> Rp${formatNumber(product.price) || '0'}</p>
                <p><strong>Kategori:</strong> ${product.category || '-'}</p>
                <p><strong>Dibuat:</strong> ${formatDate(product.created_at)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-icon" ${isValidUUID(product.id) ? `onclick="editProduct('${product.id}')"` : 'disabled'}>
                    <i data-feather="edit"></i>
                </button>
                <button class="btn-icon danger" ${isValidUUID(product.id) ? `onclick="deleteProduct('${product.id}')"` : 'disabled'}>
                    <i data-feather="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');

    feather.replace();
}

function renderPagination(pagination) {
    if (!pagination || !pagination.totalPages) return;
    
    const paginationEl = document.getElementById('products-pagination');
    if (!paginationEl) return;

    let paginationHTML = '';

    // Previous button
    paginationHTML += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="loadProductList(${pagination.page - 1})">
        <i data-feather="chevron-left"></i>
    </button>`;

    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button class="page-btn" onclick="loadProductList(${i})">${i}</button>`;
        }
    }

    // Next button
    paginationHTML += `<button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="loadProductList(${pagination.page + 1})">
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

function formatNumber(num) {
    try {
        return new Intl.NumberFormat('id-ID').format(num);
    } catch (e) {
        return String(num);
    }
}

// Client-side UUID validation (matches server-side pattern)
function isValidUUID(id) {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');

    if (product) {
        title.textContent = 'Edit Product';
        document.getElementById('product-id').value = product.id || '';
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-price').value = product.price || '';
        document.getElementById('product-category').value = product.category || '';
    } else {
        title.textContent = 'Tambah Product';
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
    }

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const productModal = document.getElementById('product-modal');
    if (productModal) {
        productModal.setAttribute('aria-hidden', 'true');
        productModal.classList.remove('show');
    }
    document.body.style.overflow = '';
}

async function saveProduct() {
    try {
        // Prevent double submission
        if (window.__productSaveInProgress) {
            console.info('[products] saveProduct prevented: already in progress');
            return;
        }
        window.__productSaveInProgress = true;
        const saveBtn = document.getElementById('save-product');
        if (saveBtn) saveBtn.disabled = true;
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        const name = document.getElementById('product-name').value.trim();
        const price = parseFloat(document.getElementById('product-price').value);
        const category = document.getElementById('product-category').value.trim();
        const productId = document.getElementById('product-id').value;

        // Validation
        if (!name) {
            showNotification('Nama produk wajib diisi', 'error');
            return;
        }
        
        if (isNaN(price) || price < 0) {
            showNotification('Harga harus berupa angka positif', 'error');
            return;
        }

        const formData = {
            name: name,
            price: price,
            category: category
        };

        let response;
        if (productId && productId.trim() !== '') {
            // Update existing product
            if (!isValidUUID(productId)) {
                showNotification('ID produk tidak valid', 'error');
                return;
            }

            response = await fetch('/api/products', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: productId, ...formData })
            });
        } else {
            // Create new product
            response = await fetch('/api/products', {
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
            throw new Error(errorData.error || 'Gagal menyimpan data produk');
        }

        const result = await response.json();
        
        closeModal();
        loadProductList();
        showNotification('Data produk berhasil disimpan', 'success');
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification(error.message || 'Gagal menyimpan data produk', 'error');
    } finally {
        // Re-enable save button and clear in-progress flag
        window.__productSaveInProgress = false;
        const saveBtn = document.getElementById('save-product');
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function editProduct(id) {
    try {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '/login.html';
            return;
        }

        // Fetch the specific product by ID
        const response = await fetch(`/api/products?id=${id}`, {
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
            throw new Error('Gagal memuat data produk');
        }

        const data = await response.json();
        const product = data.data;
        
        if (product) {
            openProductModal(product);
        }
    } catch (error) {
        console.error('Error loading product for edit:', error);
        showNotification('Gagal memuat data produk', 'error');
    }
}

async function deleteProduct(id) {
    Swal.fire({
        title: 'Anda yakin?',
        text: "Data produk ini akan dihapus secara permanen!",
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

                const response = await fetch(`/api/products?id=${id}`, {
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
                    throw new Error(errorData.error || 'Gagal menghapus data produk');
                }

                loadProductList();
                showNotification('Data produk berhasil dihapus', 'success');
            } catch (error) {
                console.error('Error deleting product:', error);
                showNotification(error.message || 'Gagal menghapus data produk', 'error');
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