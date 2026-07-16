// KiloStash 3.0 — Frontend with custom dialog system
let currentFolder = '/';
let currentView = 'grid';
let allItems = [];
let selectedItems = new Set();
let sortMode = 'date-desc';
let searchQuery = '';
let contextItem = null;

// ===== UTILS =====
const $ = id => document.getElementById(id);
const qs = (s, p = document) => p.querySelector(s);
const qsa = (s, p = document) => [...p.querySelectorAll(s)];

function formatSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

function formatDate(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm lalu';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'j lalu';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'h lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fileIcon(type) {
  const i = {
    image: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    video: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    audio: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    pdf: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    document: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    archive: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
    code: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    folder: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    file: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };
  return i[type] || i.file;
}

// ===== CUSTOM DIALOG SYSTEM =====
let dialogCallback = null;
let dialogCancelCallback = null;
let previousFocusEl = null;

function showDialog({ title, message, placeholder, input, value, confirmText, cancelText, danger, onConfirm, onCancel }) {
  return new Promise(resolve => {
    previousFocusEl = document.activeElement;
    const overlay = $('dialogOverlay');
    const card = $('dialogCard');
    const titleEl = $('dialogTitle');
    const msgEl = $('dialogMessage');
    const inputEl = $('dialogInput');
    const cancelBtn = $('dialogCancel');
    const confirmBtn = $('dialogConfirm');

    overlay.classList.remove('hidden', 'hiding');
    titleEl.textContent = title || '';

    if (message) {
      msgEl.textContent = message;
      msgEl.classList.remove('hidden');
    } else {
      msgEl.classList.add('hidden');
    }

    if (input) {
      inputEl.classList.remove('hidden');
      inputEl.placeholder = placeholder || '';
      inputEl.value = value || '';
      inputEl.type = 'text';
    } else {
      inputEl.classList.add('hidden');
    }

    cancelBtn.textContent = cancelText || 'Batal';
    confirmBtn.textContent = confirmText || 'OK';
    confirmBtn.className = 'dialog-btn dialog-btn-confirm' + (danger ? ' danger' : '');

    // Remove old listeners
    const newCancel = cancelBtn.cloneNode(true);
    const newConfirm = confirmBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    function close(result) {
      overlay.classList.add('hiding');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('hiding');
        if (previousFocusEl) previousFocusEl.focus();
        resolve(result);
      }, 150);
    }

    newCancel.addEventListener('click', () => {
      close(null);
      if (onCancel) onCancel();
    });

    newConfirm.addEventListener('click', () => {
      if (input) {
        const val = inputEl.value.trim();
        if (!val) { inputEl.focus(); return; }
        close(val);
        if (onConfirm) onConfirm(val);
      } else {
        close(true);
        if (onConfirm) onConfirm();
      }
    });

    // Focus trap
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
        if (onCancel) onCancel();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        newConfirm.click();
      }
    });

    // Backdrop click
    overlay.querySelector('.dialog-backdrop').addEventListener('click', () => {
      close(null);
      if (onCancel) onCancel();
    }, { once: true });

    // Focus input or confirm button
    setTimeout(() => {
      if (input) inputEl.focus();
      else newConfirm.focus();
    }, 50);
  });
}

function showPrompt(title, placeholder, defaultValue) {
  return showDialog({ title, input: true, placeholder, value: defaultValue });
}

function showConfirm(title, message, danger) {
  return showDialog({ title, message, danger: !!danger, confirmText: danger ? 'Hapus' : 'OK' });
}

function showAlert(title, message) {
  return showDialog({ title, message, cancelText: null });
}

// Override: showAlert hides cancel button
const _origShowAlert = showAlert;
showAlert = function(title, message) {
  return new Promise(resolve => {
    previousFocusEl = document.activeElement;
    const overlay = $('dialogOverlay');
    const card = $('dialogCard');
    const titleEl = $('dialogTitle');
    const msgEl = $('dialogMessage');
    const inputEl = $('dialogInput');
    const cancelBtn = $('dialogCancel');
    const confirmBtn = $('dialogConfirm');

    overlay.classList.remove('hidden', 'hiding');
    titleEl.textContent = title || '';
    msgEl.textContent = message || '';
    msgEl.classList.remove('hidden');
    inputEl.classList.add('hidden');

    cancelBtn.style.display = 'none';
    confirmBtn.textContent = 'OK';
    confirmBtn.className = 'dialog-btn dialog-btn-confirm';

    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

    function close() {
      overlay.classList.add('hiding');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('hiding');
        cancelBtn.style.display = '';
        if (previousFocusEl) previousFocusEl.focus();
        resolve(true);
      }, 150);
    }

    newConfirm.addEventListener('click', close);
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); }
    });
    overlay.querySelector('.dialog-backdrop').addEventListener('click', close, { once: true });
    setTimeout(() => newConfirm.focus(), 50);
  });
};

// ===== TOAST =====
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden', 'hide');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.remove('show');
    t.classList.add('hide');
    setTimeout(() => {
      t.classList.add('hidden');
      t.classList.remove('hide');
    }, 250);
  }, 2500);
}

// ===== AUTH =====
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check');
    if (res.ok) {
      const data = await res.json();
      if (data.authed) {
        window._maxFileSize = data.maxFileSize || 0;
        $('siteName').textContent = data.siteName || 'KiloStash';
        showApp();
        return;
      }
    }
  } catch {}
  showLogin();
}

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('app').classList.add('hidden');
  $('passwordInput').focus();
}

function showApp() {
  $('loginScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  loadFiles();
  loadStats();
}

async function login() {
  const pw = $('passwordInput').value;
  if (!pw) return;
  $('loginBtn').disabled = true;
  $('loginError').textContent = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Password salah');
    }
    showApp();
  } catch (e) {
    $('loginError').textContent = e.message;
    $('passwordInput').value = '';
    $('passwordInput').focus();
  }
  $('loginBtn').disabled = false;
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
    showLogin();
    $('passwordInput').value = '';
  });
}

$('loginBtn').addEventListener('click', login);
$('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('logoutBtn').addEventListener('click', logout);

// ===== FILES =====
async function loadFiles() {
  const loadingEl = $('loadingState');
  const emptyEl = $('emptyState');
  const errorEl = $('errorState');
  const grid = $('fileGrid');
  const list = $('fileList');

  // Show loading on first load
  if (allItems.length === 0) {
    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    grid.classList.add('hidden');
    list.classList.add('hidden');
  }

  try {
    const res = await fetch(`/api/files?folder=${encodeURIComponent(currentFolder)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    allItems = [...(data.folders || []), ...(data.files || [])];
    errorEl.classList.add('hidden');
    loadingEl.classList.add('hidden');
    renderItems();
  } catch (e) {
    console.error(e);
    loadingEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    grid.classList.add('hidden');
    list.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/files/stats');
    if (!res.ok) return;
    const data = await res.json();
    const totalGB = 10;
    const usedGB = data.totalSize / (1024 * 1024 * 1024);
    const pct = (usedGB / totalGB) * 100;
    $('storageBarFill').style.width = Math.min(pct, 100) + '%';
    $('storageText').textContent = `${formatSize(data.totalSize)} / ${totalGB} GB`;

    // Color change based on usage
    const fill = $('storageBarFill');
    if (pct > 90) fill.style.background = 'linear-gradient(90deg, var(--danger), var(--danger-hover))';
    else if (pct > 75) fill.style.background = 'linear-gradient(90deg, var(--warning), #ffb340)';
    else fill.style.background = '';
  } catch {}
}

function renderItems() {
  let items = allItems;

  // Search filter
  if (searchQuery) {
    items = items.filter(i => i.name.toLowerCase().includes(searchQuery));
  }

  // Sort
  const folders = items.filter(i => i.type === 'folder');
  const files = items.filter(i => i.type !== 'folder');
  const sortFn = (a, b) => {
    switch (sortMode) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'date-asc': return new Date(a.uploaded) - new Date(b.uploaded);
      case 'date-desc': return new Date(b.uploaded) - new Date(a.uploaded);
      case 'size-asc': return (a.size || 0) - (b.size || 0);
      case 'size-desc': return (b.size || 0) - (a.size || 0);
    }
  };
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort(sortFn);
  items = [...folders, ...files];

  const grid = $('fileGrid');
  const list = $('fileList');
  const empty = $('emptyState');
  $('fileCount').textContent = items.length + ' item';

  if (items.length === 0) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    list.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = '';
  list.innerHTML = '';

  items.forEach((item, idx) => {
    if (currentView === 'grid') {
      const card = makeGridCard(item);
      card.style.animationDelay = Math.min(idx * 0.03, 0.3) + 's';
      grid.appendChild(card);
    } else {
      const row = makeListRow(item);
      row.style.animationDelay = Math.min(idx * 0.02, 0.3) + 's';
      list.appendChild(row);
    }
  });

  (currentView === 'grid' ? grid : list).classList.remove('hidden');
  (currentView === 'grid' ? list : grid).classList.add('hidden');
}

function makeGridCard(item) {
  const card = document.createElement('div');
  const isFolder = item.type === 'folder';
  card.className = 'file-card' + (isFolder ? ' folder' : '') + (selectedItems.has(item.key) ? ' selected' : '');
  card.dataset.key = item.key;

  let thumb = '';
  if (isFolder) {
    thumb = `<div class="file-thumb-icon">${fileIcon('folder')}</div>`;
  } else if (item.type === 'image') {
    thumb = `<img src="/api/files/preview/${encodeURIComponent(item.key)}" loading="lazy" alt="${escapeHtml(item.name)}">`;
  } else if (item.type === 'video') {
    thumb = `<video src="/api/files/preview/${encodeURIComponent(item.key)}" preload="metadata" muted></video>`;
  } else {
    thumb = `<div class="file-thumb-icon">${fileIcon(item.type)}</div>`;
  }

  const meta = isFolder ? 'Folder' : `${formatSize(item.size)} · ${formatDate(item.uploaded)}`;

  card.innerHTML = `
    <div class="file-thumb">${thumb}</div>
    <input type="checkbox" class="file-select-checkbox" ${selectedItems.has(item.key) ? 'checked' : ''}>
    ${!isFolder ? `<div class="file-actions">
      <button class="file-action-btn" data-act="download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
      <button class="file-action-btn danger" data-act="delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </div>` : ''}
    <div class="file-card-info">
      <div class="file-card-name">${escapeHtml(item.name)}</div>
      <div class="file-card-meta">${meta}</div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.closest('.file-action-btn') || e.target.closest('.file-select-checkbox')) return;
    if (isFolder) {
      currentFolder = item.folder === '/' ? '/' + item.name : item.folder + '/' + item.name;
      updateBreadcrumb();
      loadFiles();
    } else {
      previewFile(item);
    }
  });

  // Checkbox
  const cb = card.querySelector('.file-select-checkbox');
  if (cb) cb.addEventListener('change', e => {
    if (e.target.checked) selectedItems.add(item.key);
    else selectedItems.delete(item.key);
    updateBulkBar();
    renderItems();
  });

  // Action buttons
  card.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'download') downloadFile(item);
      if (act === 'delete') deleteFiles([item.key]);
    });
  });

  // Long press for context menu (mobile)
  let pressTimer;
  card.addEventListener('touchstart', e => {
    pressTimer = setTimeout(() => showContextMenu(e, item), 500);
  }, { passive: true });
  card.addEventListener('touchend', () => clearTimeout(pressTimer));
  card.addEventListener('touchmove', () => clearTimeout(pressTimer));

  // Right click
  card.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e, item);
  });

  return card;
}

function makeListRow(item) {
  const row = document.createElement('div');
  const isFolder = item.type === 'folder';
  row.className = 'file-row' + (isFolder ? ' folder' : '') + (selectedItems.has(item.key) ? ' selected' : '');
  row.dataset.key = item.key;

  const meta = isFolder ? 'Folder' : `${formatSize(item.size)} · ${formatDate(item.uploaded)}`;

  row.innerHTML = `
    <div class="file-row-icon" style="${isFolder ? 'color:var(--accent)' : ''}">${fileIcon(isFolder ? 'folder' : item.type)}</div>
    <div class="file-row-info">
      <div class="file-row-name">${escapeHtml(item.name)}</div>
      <div class="file-row-meta">${meta}</div>
    </div>
    <div class="file-row-actions">
      <button class="btn-icon" data-act="download" title="Download"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
      <button class="btn-icon" data-act="share" title="Share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
      <button class="btn-icon" data-act="rename" title="Rename"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button class="btn-icon" data-act="delete" title="Hapus" style="color:var(--danger)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </div>
  `;

  row.addEventListener('click', e => {
    if (e.target.closest('[data-act]') || e.target.closest('.file-select-checkbox')) return;
    if (isFolder) {
      currentFolder = item.folder === '/' ? '/' + item.name : item.folder + '/' + item.name;
      updateBreadcrumb();
      loadFiles();
    } else {
      previewFile(item);
    }
  });

  row.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'download') downloadFile(item);
      if (act === 'delete') deleteFiles([item.key]);
      if (act === 'rename') renameFile(item);
      if (act === 'share') openShareModal(item);
    });
  });

  let pressTimer;
  row.addEventListener('touchstart', e => {
    pressTimer = setTimeout(() => showContextMenu(e, item), 500);
  }, { passive: true });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));
  row.addEventListener('touchmove', () => clearTimeout(pressTimer));

  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e, item);
  });

  return row;
}

// ===== BREADCRUMB =====
function updateBreadcrumb() {
  const bc = $('breadcrumb');
  const inner = bc.querySelector('.breadcrumb-inner');
  inner.innerHTML = '';

  const parts = currentFolder === '/' ? [] : currentFolder.split('/').filter(Boolean);
  let path = '/';

  const home = document.createElement('span');
  home.className = 'crumb' + (currentFolder === '/' ? ' active' : '');
  home.textContent = 'Beranda';
  home.dataset.folder = '/';
  home.addEventListener('click', () => { currentFolder = '/'; updateBreadcrumb(); loadFiles(); });
  inner.appendChild(home);

  parts.forEach((part, i) => {
    path += (i === 0 ? '' : '/') + part;
    const sep = document.createElement('span');
    sep.className = 'crumb-sep';
    sep.textContent = '/';
    inner.appendChild(sep);

    const crumb = document.createElement('span');
    crumb.className = 'crumb' + (i === parts.length - 1 ? ' active' : '');
    crumb.textContent = part;
    crumb.dataset.folder = path;
    crumb.addEventListener('click', () => { currentFolder = path; updateBreadcrumb(); loadFiles(); });
    inner.appendChild(crumb);
  });

  $('backBtn').classList.toggle('hidden', currentFolder === '/');

  // Scroll breadcrumb to end on mobile
  requestAnimationFrame(() => {
    inner.scrollLeft = inner.scrollWidth;
  });
}

$('backBtn').addEventListener('click', () => {
  if (currentFolder === '/') return;
  const parts = currentFolder.split('/').filter(Boolean);
  parts.pop();
  currentFolder = parts.length === 0 ? '/' : '/' + parts.join('/');
  updateBreadcrumb();
  loadFiles();
});

// ===== UPLOAD =====
const dropZone = $('dropZone');
const fileInput = $('fileInput');

dropZone.addEventListener('click', e => {
  if (e.target.id === 'newFolderBtn' || e.target.closest('#newFolderBtn')) return;
  if (e.target.id === 'uploadUrlBtn' || e.target.closest('#uploadUrlBtn')) return;
  fileInput.click();
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });

async function handleFiles(files) {
  if (!files.length) return;
  const progress = $('uploadProgress');
  progress.classList.remove('hidden');
  progress.innerHTML = '';

  const formData = new FormData();
  formData.append('folder', currentFolder);
  for (const f of files) formData.append('file', f);

  const items = [...files].map(f => {
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `
      <span class="upload-item-name">${escapeHtml(f.name)}</span>
      <div class="upload-item-bar"><div class="upload-item-fill" style="width:0%"></div></div>
      <span class="upload-item-status">0%</span>
    `;
    progress.appendChild(div);
    return div;
  });

  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const pct = Math.round(e.loaded / e.total * 100);
      items.forEach(item => {
        item.querySelector('.upload-item-fill').style.width = pct + '%';
        item.querySelector('.upload-item-status').textContent = pct + '%';
      });
    }
  });

  await new Promise(resolve => {
    xhr.addEventListener('load', () => {
      items.forEach(item => {
        item.querySelector('.upload-item-fill').style.width = '100%';
        item.querySelector('.upload-item-status').textContent = '✓';
        item.querySelector('.upload-item-status').style.color = 'var(--success)';
      });
      resolve();
    });
    xhr.addEventListener('error', () => {
      items.forEach(item => {
        item.querySelector('.upload-item-status').textContent = '✕';
        item.querySelector('.upload-item-status').style.color = 'var(--danger)';
      });
      resolve();
    });
    xhr.open('POST', '/api/files/upload');
    xhr.send(formData);
  });

  await loadFiles();
  await loadStats();
  setTimeout(() => { progress.classList.add('hidden'); progress.innerHTML = ''; }, 1500);
}

// ===== NEW FOLDER =====
$('newFolderBtn').addEventListener('click', async e => {
  e.stopPropagation();
  const name = await showPrompt('Folder Baru', 'Nama folder');
  if (!name) return;
  try {
    const res = await fetch('/api/files/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentFolder === '/' ? name : currentFolder + '/' + name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Gagal membuat folder');
    }
    await loadFiles();
    toast('Folder dibuat');
  } catch (e) {
    toast('Error: ' + e.message);
  }
});

// ===== PREVIEW =====
function previewFile(item) {
  const modal = $('previewModal');
  $('previewName').textContent = item.name;
  $('previewDownload').onclick = () => downloadFile(item);
  $('previewShare').onclick = () => { closeAllModals(); setTimeout(() => openShareModal(item), 200); };
  const body = $('previewBody');
  body.innerHTML = '<div class="loading-center"><div class="loading-spinner"></div></div>';
  modal.classList.remove('hidden');

  const url = `/api/files/preview/${encodeURIComponent(item.key)}`;

  if (item.type === 'image') {
    body.innerHTML = `<img src="${url}" alt="${escapeHtml(item.name)}">`;
  } else if (item.type === 'video') {
    body.innerHTML = `<video src="${url}" controls playsinline></video>`;
  } else if (item.type === 'audio') {
    body.innerHTML = `<audio src="${url}" controls></audio>`;
  } else if (item.type === 'pdf') {
    body.innerHTML = `<iframe src="${url}"></iframe>`;
  } else {
    body.innerHTML = `<div class="preview-fallback">${fileIcon(item.type)}<p>Preview tidak tersedia. Download untuk membuka.</p></div>`;
  }
}

// ===== DOWNLOAD =====
async function downloadFile(item) {
  try {
    const res = await fetch(`/api/files/download/${encodeURIComponent(item.key)}`);
    if (!res.ok) throw new Error('Download gagal');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(url);
    toast('Download dimulai');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

// ===== DELETE =====
async function deleteFiles(keys) {
  const confirmed = await showConfirm(
    `Hapus ${keys.length} file?`,
    'File akan dipindahkan ke sampah.',
    true
  );
  if (!confirmed) return;

  try {
    await fetch('/api/files/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    keys.forEach(k => selectedItems.delete(k));
    await loadFiles();
    await loadStats();
    toast('File dihapus');
  } catch (e) {
    toast('Error: Gagal menghapus file');
  }
}

// ===== RENAME =====
async function renameFile(item) {
  const newName = await showPrompt('Rename', 'Nama baru', item.name);
  if (!newName || newName === item.name) return;
  try {
    const res = await fetch('/api/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldKey: item.key, newName }),
    });
    const data = await res.json();
    if (data.error) { toast(data.error); return; }
    await loadFiles();
    toast('File diubah');
  } catch (e) {
    toast('Error: Gagal mengubah nama');
  }
}

// ===== SHARE =====
let shareItem = null;

function openShareModal(item) {
  shareItem = item;
  $('shareResult').classList.add('hidden');
  $('shareModal').classList.remove('hidden');
  $('createShareBtn').disabled = false;
}

$('createShareBtn').addEventListener('click', async () => {
  if (!shareItem) return;
  const btn = $('createShareBtn');
  btn.disabled = true;
  btn.textContent = 'Membuat...';

  try {
    const type = qs('input[name="shareType"]:checked').value;
    const expires = $('shareExpires').value;
    const res = await fetch('/api/files/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: shareItem.key,
        expiresHours: parseInt(expires),
        download: type === 'download',
      }),
    });
    const data = await res.json();
    if (data.url) {
      const fullUrl = location.origin + data.url;
      $('shareUrl').value = fullUrl;
      $('shareResult').classList.remove('hidden');
      $('copyShareBtn').onclick = () => {
        navigator.clipboard.writeText(fullUrl).then(() => {
          toast('Link disalin');
          $('copyShareBtn').style.color = 'var(--success)';
          setTimeout(() => $('copyShareBtn').style.color = '', 1500);
        });
      };
    }
  } catch (e) {
    toast('Error: Gagal membuat share link');
  }
  btn.disabled = false;
  btn.textContent = 'Buat Link';
});

// ===== SETTINGS =====
$('settingsBtn').addEventListener('click', () => {
  $('settingsModal').classList.remove('hidden');
  loadShareLinks();
});

$('changePwBtn').addEventListener('click', async () => {
  const cur = $('currentPw').value;
  const next = $('newPw').value;
  const conf = $('confirmPw').value;
  if (next !== conf) { $('pwMsg').textContent = 'Konfirmasi password tidak cocok'; $('pwMsg').style.color = 'var(--danger)'; return; }
  if (next.length < 4) { $('pwMsg').textContent = 'Password min 4 karakter'; $('pwMsg').style.color = 'var(--danger)'; return; }

  const btn = $('changePwBtn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const data = await res.json();
    if (data.error) {
      $('pwMsg').textContent = data.error;
      $('pwMsg').style.color = 'var(--danger)';
    } else {
      $('pwMsg').textContent = 'Password berhasil diganti';
      $('pwMsg').style.color = 'var(--success)';
      $('currentPw').value = '';
      $('newPw').value = '';
      $('confirmPw').value = '';
      setTimeout(() => { $('pwMsg').textContent = ''; }, 3000);
    }
  } catch (e) {
    $('pwMsg').textContent = 'Error: ' + e.message;
    $('pwMsg').style.color = 'var(--danger)';
  }
  btn.disabled = false;
});

async function loadShareLinks() {
  const list = $('shareLinksList');
  list.innerHTML = '<div class="loading-center"><div class="loading-spinner"></div></div>';

  try {
    const res = await fetch('/api/files/share/list');
    const data = await res.json();
    list.innerHTML = '';

    if (!data.shares || data.shares.length === 0) {
      list.innerHTML = '<p style="color:var(--text-3);font-size:13px;text-align:center;padding:12px">Belum ada share link</p>';
      return;
    }
    for (const s of data.shares) {
      const div = document.createElement('div');
      div.className = 'share-link-item';
      const name = s.key.split('/').pop();
      div.innerHTML = `
        <span class="share-link-item-name">${escapeHtml(name)}</span>
        <span class="share-link-item-count">${s.count}x</span>
        <button class="share-link-item-btn" data-token="${s.token}">Hapus</button>
      `;
      div.querySelector('button').addEventListener('click', async () => {
        await fetch(`/api/files/share/${s.token}`, { method: 'DELETE' });
        loadShareLinks();
        toast('Share link dihapus');
      });
      list.appendChild(div);
    }
  } catch (e) {
    list.innerHTML = '<p style="color:var(--danger);font-size:13px;text-align:center;padding:12px">Gagal memuat share links</p>';
  }
}

// ===== SEARCH =====
$('searchBtn').addEventListener('click', () => {
  $('searchBar').classList.toggle('hidden');
  if (!$('searchBar').classList.contains('hidden')) $('searchInput').focus();
});

const debouncedSearch = debounce(value => {
  searchQuery = value.toLowerCase();
  renderItems();
}, 200);

$('searchInput').addEventListener('input', e => {
  debouncedSearch(e.target.value);
});

$('searchClose').addEventListener('click', () => {
  $('searchBar').classList.add('hidden');
  $('searchInput').value = '';
  searchQuery = '';
  renderItems();
});

// ===== SORT =====
$('sortSelect').addEventListener('change', e => { sortMode = e.target.value; renderItems(); });

// ===== VIEW TOGGLE =====
$('gridViewBtn').addEventListener('click', () => {
  currentView = 'grid';
  $('gridViewBtn').classList.add('active');
  $('listViewBtn').classList.remove('active');
  renderItems();
});

$('listViewBtn').addEventListener('click', () => {
  currentView = 'list';
  $('listViewBtn').classList.add('active');
  $('gridViewBtn').classList.remove('active');
  renderItems();
});

// ===== BULK ACTIONS =====
function updateBulkBar() {
  const count = selectedItems.size;
  $('bulkBar').classList.toggle('hidden', count === 0);
  $('bulkCount').textContent = count + ' dipilih';
}

$('bulkCancel').addEventListener('click', () => {
  selectedItems.clear();
  updateBulkBar();
  renderItems();
});

$('bulkDelete').addEventListener('click', () => {
  if (selectedItems.size === 0) return;
  deleteFiles([...selectedItems]);
});

$('bulkDownload').addEventListener('click', () => {
  for (const key of selectedItems) {
    const item = allItems.find(i => i.key === key);
    if (item) downloadFile(item);
  }
});

// ===== CONTEXT MENU =====
function showContextMenu(e, item) {
  e.preventDefault();
  contextItem = item;
  const menu = $('contextMenu');
  menu.classList.remove('hidden');

  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;

  const menuW = 200;
  const menuH = 280;
  const pad = 8;

  let left = x;
  let top = y;

  if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
  if (top + menuH > window.innerHeight - pad) top = window.innerHeight - menuH - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  // Hide preview for folders
  const previewBtn = menu.querySelector('[data-action="preview"]');
  if (previewBtn) {
    previewBtn.style.display = item.type === 'folder' ? 'none' : '';
  }
}

$('contextMenu').querySelectorAll('.ctx-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!contextItem) return;
    const act = btn.dataset.action;
    if (act === 'preview' && contextItem.type !== 'folder') previewFile(contextItem);
    if (act === 'download') downloadFile(contextItem);
    if (act === 'rename') renameFile(contextItem);
    if (act === 'share') openShareModal(contextItem);
    if (act === 'favorite') toggleFavorite(contextItem);
    if (act === 'delete') deleteFiles([contextItem.key]);
    $('contextMenu').classList.add('hidden');
    contextItem = null;
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('#contextMenu')) $('contextMenu').classList.add('hidden');
});

// Close context menu on scroll
document.addEventListener('scroll', () => {
  $('contextMenu').classList.add('hidden');
}, { passive: true });

// ===== MODAL CLOSE =====
document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeAllModals);
});

function closeAllModals() {
  qsa('.modal').forEach(m => {
    m.style.opacity = '0';
    setTimeout(() => {
      m.classList.add('hidden');
      m.style.opacity = '';
    }, 150);
  });
  $('previewBody').innerHTML = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Don't close if dialog is open
    if (!$('dialogOverlay').classList.contains('hidden')) return;
    closeAllModals();
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === '/') { e.preventDefault(); $('searchBtn').click(); }
  if (e.key === 'Delete' && selectedItems.size > 0) { $('bulkDelete').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAllVisible(); }
});

function selectAllVisible() {
  allItems.forEach(i => { if (i.type !== 'folder') selectedItems.add(i.key); });
  updateBulkBar();
  renderItems();
}

// ===== TRASH =====
let trashView = false;

$('trashBtn').addEventListener('click', () => {
  trashView = !trashView;
  if (trashView) {
    $('dropZone').classList.add('hidden');
    $('toolbar').classList.add('hidden');
    $('fileGrid').classList.add('hidden');
    $('fileList').classList.add('hidden');
    $('emptyState').classList.add('hidden');
    $('errorState').classList.add('hidden');
    $('breadcrumb').classList.add('hidden');
    $('trashView').classList.remove('hidden');
    loadTrash();
  } else {
    exitTrashView();
  }
});

function exitTrashView() {
  $('dropZone').classList.remove('hidden');
  $('toolbar').classList.remove('hidden');
  $('breadcrumb').classList.remove('hidden');
  $('trashView').classList.add('hidden');
  trashView = false;
  loadFiles();
}

async function loadTrash() {
  const list = $('trashList');
  const empty = $('trashEmptyState');

  try {
    const res = await fetch('/api/files/trash');
    if (!res.ok) throw new Error('Failed to load trash');
    const data = await res.json();
    const items = data.items || [];
    $('trashCount').textContent = items.length + ' item di sampah';
    list.innerHTML = '';

    if (items.length === 0) {
      empty.classList.remove('hidden');
      list.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.classList.remove('hidden');

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'file-row';
      const meta = `${formatSize(item.size)} · ${formatDate(item.deletedAt)}`;
      row.innerHTML = `
        <div class="file-row-icon">${fileIcon(item.type)}</div>
        <div class="file-row-info">
          <div class="file-row-name">${escapeHtml(item.name)}</div>
          <div class="file-row-meta">${meta}</div>
        </div>
        <div class="file-row-actions" style="opacity:1">
          <button class="btn-icon" data-act="restore" title="Kembalikan"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
          <button class="btn-icon" data-act="delete" title="Hapus permanen" style="color:var(--danger)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
        </div>
      `;
      row.querySelector('[data-act="restore"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await fetch('/api/files/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: item.key }),
          });
          toast('File dikembalikan');
          loadTrash();
          loadStats();
        } catch (err) {
          toast('Error: Gagal mengembalikan file');
        }
      });
      row.querySelector('[data-act="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm(
          'Hapus permanen?',
          `"${item.name}" akan dihapus selamanya. Tindakan ini tidak bisa dibatalkan.`,
          true
        );
        if (!confirmed) return;
        try {
          await fetch(`/api/files/trash/${encodeURIComponent(item.key)}`, { method: 'DELETE' });
          toast('File dihapus permanen');
          loadTrash();
          loadStats();
        } catch (err) {
          toast('Error: Gagal menghapus');
        }
      });
      list.appendChild(row);
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p style="color:var(--danger);text-align:center;padding:24px">Gagal memuat sampah</p>';
  }
}

$('emptyTrashBtn').addEventListener('click', async () => {
  const confirmed = await showConfirm(
    'Kosongkan Sampah?',
    'Semua file di sampah akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
    true
  );
  if (!confirmed) return;
  try {
    await fetch('/api/files/trash/empty', { method: 'DELETE' });
    toast('Sampah dikosongkan');
    loadTrash();
    loadStats();
  } catch (e) {
    toast('Error: Gagal mengosongkan sampah');
  }
});

// ===== FAVORITES =====
$('favBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/files/favorites');
    const data = await res.json();
    const items = data.items || [];

    if (items.length === 0) {
      toast('Belum ada favorit');
      return;
    }

    allItems = items.map(i => ({ ...i, uploaded: i.addedAt, folder: '/' }));
    searchQuery = '';
    renderItems();
    toast(`${items.length} favorit ditampilkan`);
  } catch (e) {
    toast('Error: Gagal memuat favorit');
  }
});

async function toggleFavorite(item) {
  try {
    const res = await fetch('/api/files/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: item.key }),
    });
    const data = await res.json();
    toast(data.favorite ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit');
  } catch (e) {
    toast('Error: Gagal mengubah favorit');
  }
}

// ===== UPLOAD BY URL =====
$('uploadUrlBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('uploadUrlModal').classList.remove('hidden');
  $('uploadUrlInput').focus();
});

$('uploadUrlSubmit').addEventListener('click', async () => {
  const url = $('uploadUrlInput').value.trim();
  if (!url) { $('uploadUrlInput').focus(); return; }
  $('uploadUrlMsg').textContent = 'Mengunduh...';
  $('uploadUrlMsg').style.color = 'var(--text-2)';
  $('uploadUrlSubmit').disabled = true;

  try {
    const res = await fetch('/api/files/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, folder: currentFolder }),
    });
    const data = await res.json();
    if (data.error) {
      $('uploadUrlMsg').textContent = data.error;
      $('uploadUrlMsg').style.color = 'var(--danger)';
    } else {
      $('uploadUrlMsg').textContent = `Berhasil: ${data.name} (${formatSize(data.size)})`;
      $('uploadUrlMsg').style.color = 'var(--success)';
      $('uploadUrlInput').value = '';
      await loadFiles();
      await loadStats();
      setTimeout(() => { closeAllModals(); $('uploadUrlMsg').textContent = ''; }, 1500);
    }
  } catch (e) {
    $('uploadUrlMsg').textContent = 'Gagal: ' + e.message;
    $('uploadUrlMsg').style.color = 'var(--danger)';
  }
  $('uploadUrlSubmit').disabled = false;
});

// ===== INIT =====
checkAuth();
