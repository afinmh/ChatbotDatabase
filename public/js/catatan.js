// Catatan Herbal: fetch + render grid 3x3 with pagination and search
document.addEventListener('DOMContentLoaded', () => {
	const grid = document.getElementById('herb-grid');
	const paginationControls = document.getElementById('pagination-controls');
	const prevBtn = document.getElementById('prev-btn');
	const nextBtn = document.getElementById('next-btn');
	const pageInfo = document.getElementById('page-info');
	const searchInput = document.getElementById('search-input');

	let currentPage = 1;
	let totalPages = 1;
	let currentSearch = '';
	const pageSize = 9; // 3 x 3
	let debounceTimer;

	const formatDate = (iso) => {
		if (!iso) return '-';
		try {
			const d = new Date(iso);
			return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' });
		} catch {
			return iso;
		}
	};

	const sanitize = (s) => (s == null || s === '' ? '-' : String(s));

	// Optionally fetch creator name by uploaded_by
	const fetchCreatorName = async (uploaded_by) => {
		if (!uploaded_by) return 'Anonim';
		try {
			const res = await fetch(`/api/users/${encodeURIComponent(uploaded_by)}`);
			if (!res.ok) return 'Anonim';
			const json = await res.json();
			return json?.user?.name || json?.user?.email || 'Anonim';
		} catch {
			return 'Anonim';
		}
	};

		const createCard = async (item) => {
		const el = document.createElement('div');
		el.className = 'herb-card';

			const creatorName = await fetchCreatorName(item.uploaded_by);
			const imgUrl = item.gambar_url || '/images/herbal-bg.jpg';

				// Use Referensi-style card structure
				el.className = 'doc-card herb-note-card';
				el.innerHTML = `
					<div class="doc-thumb">
						<img src="${imgUrl}" alt="${sanitize(item.nama_umum)}" onerror="this.src='/images/herbal-bg.jpg'" />
					</div>
					<div class="doc-header">
						<div class="doc-title-row">
							<h3 class="doc-title" title="${sanitize(item.nama_umum)}">${sanitize(item.nama_umum)}</h3>
						</div>
						<div class="doc-subrow">
							<div class="doc-subtitle" title="${sanitize(item.nama_ilmiah)}">${sanitize(item.nama_ilmiah)}</div>
							<div class="doc-subright" title="${sanitize(item.bagian)}">Bagian: ${sanitize(item.bagian)}</div>
						</div>
					</div>
				<div class="doc-content">
					<div class="doc-details">
						<div class="detail-block">
							<div class="detail-label">Penggunaan</div>
							<div class="detail-text clamp-3">${sanitize(item.cara_penggunaan)}</div>
						</div>
						<div class="detail-block">
							<div class="detail-label">Manfaat</div>
							<div class="detail-text clamp-3">${sanitize(item.manfaat)}</div>
						</div>
					</div>
				</div>
				<div class="doc-footer">
						<div class="byline">${sanitize(creatorName)} <span class="dot"></span> ${formatDate(item.created_at)}</div>
				</div>
			`;
		// Open modal with full details
		el.addEventListener('click', () => openHerbModal(item, creatorName));
		return el;
	};

	const showLoading = () => {
		grid.innerHTML = `
			<div class="loading-indicator" style="grid-column: 1/-1;">
				<div class="loading-spinner"></div>
				<span>Memuat data...</span>
			</div>`;
	};

	const showEmpty = () => {
		grid.innerHTML = `
			<div class="empty-message" style="grid-column: 1/-1;">
				<i data-feather="inbox"></i>
				<p>Tidak ada catatan herbal.</p>
			</div>`;
		feather.replace({ element: grid });
	};

	const display = async (page = 1, search = '') => {
		currentPage = page;
		currentSearch = search;
		showLoading();
		try {
			const url = new URL('/api/herbalpedia', window.location.origin);
			url.searchParams.set('page', String(page));
			url.searchParams.set('limit', String(pageSize));
			url.searchParams.set('status', 'approved');
			if (search) url.searchParams.set('search', search);

			const res = await fetch(url);
			if (!res.ok) throw new Error('Gagal memuat');
			const json = await res.json();
			const items = json?.items || [];
			const pagination = json?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 };
			totalPages = pagination.totalPages || 1;

			if (!items.length) {
				showEmpty();
				paginationControls.style.display = 'none';
				return;
			}

			grid.innerHTML = '';
			// Render cards sequentially because we await creator lookups per item
			for (const item of items) {
				const card = await createCard(item);
				grid.appendChild(card);
			}
			paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';
			pageInfo.textContent = `Halaman ${pagination.currentPage} dari ${pagination.totalPages}`;
		} catch (e) {
			grid.innerHTML = `
				<div class="error-message" style="grid-column: 1/-1;">
					<i data-feather="alert-triangle"></i>
					<p>Terjadi kesalahan saat memuat data.</p>
				</div>`;
			feather.replace({ element: grid });
			paginationControls.style.display = 'none';
		}
	};

	// Search debounce
	if (searchInput) {
		searchInput.addEventListener('input', () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => display(1, searchInput.value.trim()), 400);
		});
		searchInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				clearTimeout(debounceTimer);
				display(1, searchInput.value.trim());
			}
		});
	}

	// Pagination
	prevBtn?.addEventListener('click', () => {
		if (currentPage > 1) display(currentPage - 1, currentSearch);
	});
	nextBtn?.addEventListener('click', () => {
		if (currentPage < totalPages) display(currentPage + 1, currentSearch);
	});

	// Initial
	display(1, '');

	// Modal logic
	const modal = document.getElementById('herb-detail-modal');
	const modalBody = document.getElementById('herb-modal-body');
	const modalCloseBtn = () => modal?.querySelector('.modal-close');
	const closeModal = () => {
		if (!modal) return;
		modal.classList.add('hidden');
		modal.setAttribute('aria-hidden', 'true');
		if (modalBody) modalBody.innerHTML = '';
		document.body.classList.remove('modal-open');
	};
	const openHerbModal = (item, creatorName) => {
		if (!modal || !modalBody) return;
		const imgUrl = item.gambar_url || '/images/herbal-bg.jpg';
		modalBody.innerHTML = `
			<div class="modal-media"><img src="${imgUrl}" alt="${sanitize(item.nama_umum)}" onerror="this.src='/images/herbal-bg.jpg'" /></div>
			<div class="modal-content">
				<div class="modal-section">
					<div class="section-title">Nama</div>
					<div class="section-text"><strong>${sanitize(item.nama_umum)}</strong><br/><em>${sanitize(item.nama_ilmiah)}</em></div>
				</div>
				<div class="modal-section">
					<div class="section-title">Bagian</div>
					<div class="section-text">${sanitize(item.bagian)}</div>
				</div>
				<div class="modal-section">
					<div class="section-title">Penggunaan</div>
					<div class="section-text">${sanitize(item.cara_penggunaan)}</div>
				</div>
				<div class="modal-section">
					<div class="section-title">Manfaat</div>
					<div class="section-text">${sanitize(item.manfaat)}</div>
				</div>
				<div class="modal-section">
					<div class="section-title">Info</div>
					<div class="section-text">${sanitize(creatorName)} · ${formatDate(item.created_at)}</div>
				</div>
			</div>
		`;
		modal.classList.remove('hidden');
		modal.setAttribute('aria-hidden', 'false');
		document.body.classList.add('modal-open');
		// focus close button for quick access
		setTimeout(() => { modalCloseBtn()?.focus?.(); }, 0);
	};

	// Close modal handlers
	document.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof Element)) return;
		if (target.matches('[data-close]') || target.closest('[data-close]')) {
			closeModal();
		}
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') { closeModal(); hideCreateModal(); }
	});

	// --- Create Herbal (FAB + Modal) ---
	const fab = document.getElementById('fab-add-herb');
	const createModal = document.getElementById('create-herb-modal');
	const showCreateModal = () => { if (createModal) { createModal.classList.remove('hidden'); createModal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }};
	const hideCreateModal = () => { if (createModal) { createModal.classList.add('hidden'); createModal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); const form = document.getElementById('create-herb-form'); form?.reset(); const prev = document.getElementById('create-image-preview'); if(prev) prev.innerHTML=''; }};

	// Always show FAB; gate action by login check
	fab?.classList.remove('hidden');
	const isLoggedIn = () => {
		try {
			const at = localStorage.getItem('access_token');
			const userStr = localStorage.getItem('user');
			return !!(at && userStr);
		} catch { return false; }
	};

	// Open create modal (or ask login first)
	fab?.addEventListener('click', () => {
		if (!isLoggedIn()) {
			if (window.Swal && typeof Swal.fire === 'function') {
				Swal.fire({
					title: 'Perlu Masuk',
					text: 'Silakan masuk terlebih dahulu untuk menambahkan data herbal.',
					icon: 'info',
					confirmButtonText: 'Masuk',
					showCancelButton: true,
					cancelButtonText: 'Batal'
				}).then(r => { if (r.isConfirmed) window.location.href = '/login.html'; });
			} else {
				alert('Silakan login terlebih dahulu untuk menambahkan data.');
			}
			return;
		}
		showCreateModal();
	});

	// Close create modal via backdrop/close buttons
	document.addEventListener('click', (e) => {
		const t = e.target;
		if (!(t instanceof Element)) return;
		if (createModal && !createModal.classList.contains('hidden')) {
			if (t.matches('#create-herb-modal [data-close]') || t.closest('#create-herb-modal [data-close]') || t === createModal.querySelector('.modal-backdrop')) {
				hideCreateModal();
			}
		}
	});

	// Image preview and optional upload
	const imageInput = document.getElementById('create-image');
	const imagePreviewWrap = document.getElementById('create-image-preview');
	if (imageInput) {
		imageInput.addEventListener('change', () => {
			const file = imageInput.files && imageInput.files[0];
			if (!file) { if(imagePreviewWrap) imagePreviewWrap.innerHTML=''; return; }
			const url = URL.createObjectURL(file);
			if (imagePreviewWrap) imagePreviewWrap.innerHTML = `<img src="${url}" alt="preview"/>`;
		});
	}

	// Submit create form
	const createForm = document.getElementById('create-herb-form');
	createForm?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const nama_umum = document.getElementById('create-nama-umum').value.trim();
		const nama_ilmiah = document.getElementById('create-nama-ilmiah').value.trim() || null;
		const bagian = document.getElementById('create-bagian').value.trim() || null;
		const cara_penggunaan = document.getElementById('create-penggunaan').value.trim() || null;
		const manfaat = document.getElementById('create-manfaat').value.trim() || null;
		const submitBtn = document.getElementById('create-submit');
		if (!nama_umum) { alert('Nama Umum wajib diisi'); return; }

		let gambar_url = null;
		const fileEl = document.getElementById('create-image');
		const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
		if (file) {
			try {
				const formData = new FormData();
				formData.append('nama', nama_umum);
				formData.append('file', file);
				const up = await fetch('/api/herbalpedia/upload', { method: 'POST', body: formData });
				const uj = await up.json();
				if (up.ok && uj?.url) gambar_url = uj.url; else console.warn('Upload gagal:', uj?.error);
			} catch (err) { console.warn('Upload error', err); }
		}

		// Build payload with status forced to pending
		const payload = { nama_umum, nama_ilmiah, bagian, cara_penggunaan, manfaat, gambar_url, status: 'pending' };
		// Include Authorization header if access_token exists so backend can set uploaded_by
		const headers = { 'Content-Type': 'application/json' };
		try { const at = localStorage.getItem('access_token'); if (at) headers['Authorization'] = `Bearer ${at}`; } catch {}

		try {
			submitBtn?.setAttribute('disabled','true');
			const res = await fetch('/api/herbalpedia', { method: 'POST', headers, body: JSON.stringify(payload) });
			const js = await res.json();
			if (!res.ok) throw new Error(js?.error || 'Gagal menyimpan');
			hideCreateModal();
			// refresh first page to show latest (pending items may be hidden elsewhere but list API returns all)
			display(1, currentSearch);
		} catch (err) {
			alert(err.message || 'Terjadi kesalahan');
		} finally {
			submitBtn?.removeAttribute('disabled');
		}
	});
});
