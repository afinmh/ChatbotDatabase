// public/js/herbalku.js - load and manage user's own herbal contributions
(function(){
  document.addEventListener('DOMContentLoaded', () => {
    feather.replace();
    initHerbalku();
  });

  const state = { page: 1, limit: 6, totalPages: 1, reqSeq: 0 };

  function getUserId(){
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).id || null : null;
    } catch { return null; }
  }
  function getAccessToken(){ try { return localStorage.getItem('access_token'); } catch { return null; } }

  function initHerbalku(){
    const section = document.getElementById('herbalku-section');
    if (!section) return;
    document.getElementById('btn-add-my-herb')?.addEventListener('click', onAdd);
    loadPage(1);
  }

  function onAdd(){
    const token = getAccessToken();
    if (!token) {
      if (window.Swal && typeof Swal.fire === 'function') {
        Swal.fire({ title:'Perlu Masuk', text:'Masuk dulu untuk menambah herbal.', icon:'info', confirmButtonText:'Masuk', showCancelButton:true, cancelButtonText:'Batal', confirmButtonColor:'#4A6C6A' }).then(r=>{ if(r.isConfirmed) window.location.href='/login.html'; });
      } else { alert('Silakan login terlebih dahulu.'); }
      return;
    }
  // Open local create modal (embedded in profile)
  if (window.showCreateModal) window.showCreateModal();
  }

  async function loadPage(page){
    state.page = page; const mySeq = ++state.reqSeq;
    const grid = document.getElementById('my-herb-grid'); const empty = document.getElementById('my-herb-empty'); const pager = document.getElementById('my-herb-pagination');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:16px;">Memuat...</div>';

    const uid = getUserId();
    if (!uid) { // no user -> show empty
      grid.innerHTML = '';
      if (empty) empty.style.display = '';
      if (pager) pager.innerHTML = '';
      return;
    }

    const url = new URL('/api/herbalpedia', window.location.origin);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(state.limit));
    url.searchParams.set('uploaded_by', uid);

    const res = await fetch(url);
    const data = await res.json();
    if (mySeq !== state.reqSeq) return;
    const items = data?.items || [];
    state.totalPages = data?.pagination?.totalPages || 1;

    if (!items.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = '';
      if (pager) pager.innerHTML = '';
      feather.replace();
      return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = items.map(renderCard).join('');
    feather.replace();
    renderPagination();
  }

  // Expose for external refresh triggers
  window.__herbalkuLoadPage = loadPage;

  function renderCard(item){
    const img = item.gambar_url || '/images/herbal-bg.jpg';
    const created = formatDateID(item.created_at);
    return `
      <div class="herb-card" data-id="${item.id}">
        <div class="herb-media"><img src="${img}" alt="${escapeHtml(item.nama_umum||'-')}" class="herb-img" onerror="this.src='/images/herbal-bg.jpg'" /></div>
        <div class="herb-body">
          <div class="title-row">
            <div class="herb-title">${escapeHtml(item.nama_umum || '-')}</div>
          </div>
          <div class="herb-sub"><em>${escapeHtml(item.nama_ilmiah || '-')}</em></div>
          <div class="herb-sub">Bagian: ${escapeHtml(item.bagian || '-')}</div>
          <div class="herb-meta">
            <div class="meta-row">
              <div>Manfaat: ${hasText(item.manfaat)}</div>
              <div>Panduan: ${hasText(item.cara_penggunaan)}</div>
            </div>
            <div class="meta-col">Dibuat: <span class="chip">${created}</span></div>
            <div class="meta-col">Status: <span class="badge status-${escapeHtml((item.status||'pending').toLowerCase())}">${escapeHtml(item.status || 'pending')}</span></div>
          </div>
        </div>
        <div class="herb-footer">
          <div class="actions">
            <button class="btn-icon" data-edit="${item.id}" title="Edit"><i data-feather="edit-2"></i></button>
            <button class="btn-icon danger" data-delete="${item.id}" title="Hapus"><i data-feather="trash-2"></i></button>
          </div>
        </div>
      </div>`;
  }

  function renderPagination(){
    const el = document.getElementById('my-herb-pagination'); if(!el) return;
    const { page, totalPages } = state; let html = '';
    const btn = (p, label, disabled=false, active=false) => `<button class="page-btn ${active?'active':''}" ${disabled?'disabled':''} data-page="${p}">${label}</button>`;
    html += btn(Math.max(1, page-1), 'Prev', page<=1);
    for(let i=1;i<=totalPages;i++){ html += btn(i, i, false, i===page); }
    html += btn(Math.min(totalPages, page+1), 'Next', page>=totalPages);
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(b=> b.addEventListener('click', (e)=>{ const p = parseInt(e.currentTarget.getAttribute('data-page')); if(!isNaN(p)) loadPage(p); }));
  }

  // Event delegation for edit/delete
  document.addEventListener('click', async (e) => {
    const t = e.target; if (!(t instanceof Element)) return;
    const editBtn = t.closest('[data-edit]');
    const delBtn = t.closest('[data-delete]');
    if (editBtn) {
      const id = editBtn.getAttribute('data-edit'); if (!id) return;
      // Load item, prefill modal, and PATCH on submit
      const res = await fetch(`/api/herbalpedia/${id}`);
      if (!res.ok) { alert('Gagal memuat data.'); return; }
  const js = await res.json(); const item = js?.item || js;
      // Prefill create modal fields
      document.getElementById('create-nama-umum').value = item.nama_umum || '';
      document.getElementById('create-nama-ilmiah').value = item.nama_ilmiah || '';
      document.getElementById('create-bagian').value = item.bagian || '';
      document.getElementById('create-penggunaan').value = item.cara_penggunaan || '';
      document.getElementById('create-manfaat').value = item.manfaat || '';
      const preview = document.getElementById('create-image-preview'); if (preview) preview.innerHTML = item.gambar_url ? `<img src="${item.gambar_url}" alt="preview" />` : '';
  // Mark edit mode and open modal
  window.__herbEditState = { id, status: item.status || '' };
  const titleEl = document.querySelector('#create-herb-modal .modal-header h3'); if (titleEl) titleEl.textContent = 'Edit Herbal';
  window.showCreateModal && window.showCreateModal();
    }
    if (delBtn) {
      const id = delBtn.getAttribute('data-delete'); if (!id) return;
      // SweetAlert confirm if available, fallback to confirm()
      const doDelete = async () => {
        const headers = {}; const at = localStorage.getItem('access_token'); if (at) headers['Authorization'] = `Bearer ${at}`;
        const resp = await fetch(`/api/herbalpedia/${id}`, { method:'DELETE', headers });
        if (!resp.ok) {
          const t = await resp.text();
          if (window.Swal) Swal.fire({ icon:'error', title:'Gagal', text: t || 'Gagal menghapus data', confirmButtonColor:'#4A6C6A' });
          else alert(t || 'Gagal menghapus');
          return;
        }
        if (window.Swal) Swal.fire({ icon:'success', title:'Terhapus', text:'Data herbal berhasil dihapus.', timer:1400, showConfirmButton:false });
        document.dispatchEvent(new CustomEvent('reload-herbalku', { detail: { page: 1 } }));
      };

      if (window.Swal && typeof Swal.fire === 'function') {
        const res = await Swal.fire({
          title: 'Hapus herbal ini?',
          text: 'Tindakan tidak dapat dibatalkan.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Ya, hapus',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#dc2626',
          cancelButtonColor: '#6b7280'
        });
        if (res.isConfirmed) await doDelete();
      } else {
        const ok = window.confirm('Hapus herbal ini? Tindakan tidak dapat dibatalkan.');
        if (ok) await doDelete();
      }
    }
  });

  function hasText(v){ v = (v||'').trim(); return v ? '<span class="badge yes">Ada</span>' : '<span class="badge no">Tidak</span>'; }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }
  function formatDateID(dateStr){ if(!dateStr) return '-'; const d = new Date(dateStr); if(isNaN(d.getTime())) return '-'; return d.toLocaleDateString('id-ID',{ day:'2-digit', month:'short', year:'numeric' }); }
})();

// --- Create Herbal Modal Logic (replicated from catatan.js, adapted here) ---
(function(){
  // Lazy getters to avoid null when script loads before modal HTML
  const getModal = () => document.getElementById('create-herb-modal');
  const getForm = () => document.getElementById('create-herb-form');
  const getImageInput = () => document.getElementById('create-image');
  const getImagePreview = () => document.getElementById('create-image-preview');
  const getTitleEl = () => document.querySelector('#create-herb-modal .modal-header h3');

  // Track edit/create mode
  window.__herbEditState = null; // { id, status }

  function isOpen(){ const m = getModal(); return m && !m.classList.contains('hidden'); }
  function showCreateModal(){
    const m = getModal(); if (!m) return;
    m.classList.remove('hidden'); m.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
    const t = getTitleEl(); if (t) t.textContent = window.__herbEditState ? 'Edit Herbal' : 'Tambah Herbal';
    setTimeout(()=>{ try{ m.querySelector('#create-nama-umum')?.focus(); }catch{} }, 0);
  }
  function resetCreateForm(){
    try {
      getForm()?.reset();
      const preview = getImagePreview(); if (preview) preview.innerHTML = '';
      window.__herbEditState = null;
      const t = getTitleEl(); if (t) t.textContent = 'Tambah Herbal';
    } catch {}
  }
  function hideCreateModal(){ const m = getModal(); if (!m) return; m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); resetCreateForm(); }

  // Expose to outer scope for the Add button handler
  window.showCreateModal = showCreateModal;

  // Close via backdrop/close buttons
  document.addEventListener('click', (e) => {
    const t = e.target; if (!(t instanceof Element)) return; const m = getModal(); if (!m || !isOpen()) return;
    if (t.matches('[data-close]') || t.closest('[data-close]') || t.classList.contains('modal-backdrop')) { hideCreateModal(); }
  });

  // ESC to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) hideCreateModal(); });

  // Image preview (delegate after DOM ready)
  document.addEventListener('change', (e) => {
    const input = e.target; if (!(input instanceof Element)) return;
    if (input.id === 'create-image'){
      const fileInput = getImageInput(); const preview = getImagePreview();
      if (!fileInput || !preview) return;
      const file = fileInput.files && fileInput.files[0];
      preview.innerHTML = '';
      if (file) { const reader = new FileReader(); reader.onload = () => { preview.innerHTML = `<img src="${reader.result}" alt="Preview" />`; }; reader.readAsDataURL(file); }
    }
  });

  function getAccessToken(){ try { return localStorage.getItem('access_token'); } catch { return null; } }

  async function uploadImageIfAny(){
    const input = getImageInput(); const file = input && input.files && input.files[0] ? input.files[0] : null;
    if (!file) return null;
    const fd = new FormData();
    const nama = document.getElementById('create-nama-umum')?.value?.trim() || 'herbal';
    fd.append('file', file);
    fd.append('nama', nama);
    const res = await fetch('/api/herbalpedia/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Gagal mengunggah gambar');
    const data = await res.json(); return data?.url || data?.publicUrl || null;
  }

  document.addEventListener('submit', async (e) => {
    const f = e.target; if (!(f instanceof Element)) return;
    if (f.id !== 'create-herb-form') return;
    e.preventDefault();
    const nama_umum = document.getElementById('create-nama-umum')?.value.trim();
    const nama_ilmiah = document.getElementById('create-nama-ilmiah')?.value.trim() || null;
    const bagian = document.getElementById('create-bagian')?.value.trim() || null;
    const cara_penggunaan = document.getElementById('create-penggunaan')?.value.trim() || null;
    const manfaat = document.getElementById('create-manfaat')?.value.trim() || null;
    const submitBtn = document.getElementById('create-submit');

    if (!nama_umum) { alert('Nama umum wajib diisi'); return; }

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Menyimpan...'; }
      let gambar_url = null; try { gambar_url = await uploadImageIfAny(); } catch (err) { console.warn(err); }
      const base = { nama_umum, nama_ilmiah, bagian, cara_penggunaan, manfaat };
      const headers = { 'Content-Type': 'application/json' };
      const token = getAccessToken(); if (token) headers['Authorization'] = `Bearer ${token}`;

      const editState = window.__herbEditState;
      if (editState && editState.id) {
        const payload = { ...base };
        if (gambar_url) payload.gambar_url = gambar_url;
        if ((editState.status || '').toLowerCase() === 'approved') payload.status = 'pending';
        const resp = await fetch(`/api/herbalpedia/${editState.id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
        const j = await resp.json(); if (!resp.ok) throw new Error(j?.error || 'Gagal menyimpan perubahan');
      } else {
        const payload = { ...base, gambar_url, status: 'pending' };
        const res = await fetch('/api/herbalpedia', { method: 'POST', headers, body: JSON.stringify(payload) });
        if (!res.ok) { const errText = await res.text(); throw new Error(errText || 'Gagal menyimpan herbal'); }
      }

      hideCreateModal();
      try { if (window.Swal) Swal.fire({ icon:'success', title:'Tersimpan', text:'Perubahan berhasil disimpan.', confirmButtonColor:'#4A6C6A' }); } catch {}
      const pager = document.getElementById('my-herb-pagination');
      const active = pager?.querySelector('.page-btn.active');
      const page = active ? parseInt(active.getAttribute('data-page')) : 1;
      document.dispatchEvent(new CustomEvent('reload-herbalku', { detail: { page: page || 1 } }));
    } catch (err) {
      console.error(err); alert(err?.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Simpan'; }
    }
  });

  // Listen for refresh event from save
  document.addEventListener('reload-herbalku', (e) => {
    try {
      const page = e.detail?.page || 1;
      if (window.__herbalkuLoadPage) { window.__herbalkuLoadPage(page); }
      else { const btn = document.querySelector(`#my-herb-pagination .page-btn.active`); if (btn) btn.click(); else window.location.reload(); }
    } catch {}
  });
})();
