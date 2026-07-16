// KiloStash 2.0 — Frontend
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

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
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

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== AUTH =====
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check');
    if (res.ok) {
      const data = await res.json();
      if (data.authed) {
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
  try {
    const res = await fetch(`/api/files?folder=${encodeURIComponent(currentFolder)}`);
    if (!res.ok) return;
    const data = await res.json();
    allItems = [...(data.folders || []), ...(data.files || [])];
    renderItems();
  } catch (e) { console.error(e); }
}

async function loadStats() {
  try {
    const res = await fetch('/api/files/stats');
    if (!res.ok) return;
    const data = await res.json();
    const pct = (data.totalSize / (10 * 1024 * 1024 * 1024)) * 100;
    $('storageBarFill').style.width = Math.min(pct, 100) + '%';
    $('storageText').textContent = `${formatSize(data.totalSize)} / 10 GB`;
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

  items.forEach(item => {
    if (currentView === 'grid') {
      grid.appendChild(makeGridCard(item));
    } else {
      list.appendChild(makeListRow(item));
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
      <button class="file-action-btn" data-act="download"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
      <button class="file-action-btn danger" data-act="delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
  });
  card.addEventListener('touchend', () => clearTimeout(pressTimer));

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
  });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));

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
  fileInput.click();
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });

async function handleFiles(files) {
  if (!files.length) return;
  const progress = $('uploadProgress');
  progress.classList.remove('hidden');
  progress.innerHTML = '';

  // Upload all files in one request
  const formData = new FormData();
  formData.append('folder', currentFolder);
  for (const f of files) formData.append('file', f);

  // Create progress items
  const items = [...files].map(f => {
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `<span class="upload-item-name">${escapeHtml(f.name)}</span><div class="upload-item-bar"><div class="upload-item-fill" style="width:0%"></div></div><span class="upload-item-status">0%</span>`;
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
$('newFolderBtn').addEventListener('click', e => {
  e.stopPropagation();
  const name = prompt('Nama folder:');
  if (!name) return;
  fetch('/api/files/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentFolder === '/' ? name : currentFolder + '/' + name }),
  }).then(() => { loadFiles(); toast('Folder dibuat'); });
});

// ===== PREVIEW =====
function previewFile(item) {
  const modal = $('previewModal');
  $('previewName').textContent = item.name;
  $('previewDownload').onclick = () => downloadFile(item);
  $('previewShare').onclick = () => { closeAllModals(); openShareModal(item); };
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
  const res = await fetch(`/api/files/download/${encodeURIComponent(item.key)}`);
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = item.name;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== DELETE =====
async function deleteFiles(keys) {
  if (!confirm(`Hapus ${keys.length} file?`)) return;
  await fetch('/api/files/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  keys.forEach(k => selectedItems.delete(k));
  await loadFiles();
  await loadStats();
  toast('File dihapus');
}

// ===== RENAME =====
async function renameFile(item) {
  const newName = prompt('Nama baru:', item.name);
  if (!newName || newName === item.name) return;
  const res = await fetch('/api/files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldKey: item.key, newName }),
  });
  const data = await res.json();
  if (data.error) { toast(data.error); return; }
  await loadFiles();
  toast('File diubah');
}

// ===== SHARE =====
let shareItem = null;

function openShareModal(item) {
  shareItem = item;
  $('shareResult').classList.add('hidden');
  $('shareModal').classList.remove('hidden');
}

$('createShareBtn').addEventListener('click', async () => {
  if (!shareItem) return;
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
      $('shareUrl').select();
      navigator.clipboard.writeText(fullUrl).then(() => toast('Link disalin'));
    };
  }
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
  if (next !== conf) { $('pwMsg').textContent = 'Konfirmasi password tidak cocok'; return; }
  if (next.length < 4) { $('pwMsg').textContent = 'Password min 4 karakter'; return; }

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
});

async function loadShareLinks() {
  const res = await fetch('/api/files/share/list');
  const data = await res.json();
  const list = $('shareLinksList');
  list.innerHTML = '';
  if (!data.shares || data.shares.length === 0) {
    list.innerHTML = '<p style="color:var(--text-3);font-size:13px">Belum ada share link</p>';
    return;
  }
  for (const s of data.shares) {
    const div = document.createElement('div');
    div.className = 'share-link-item';
    const name = s.key.split('/').pop();
    div.innerHTML = `<span class="share-link-item-name">${escapeHtml(name)}</span><span style="color:var(--text-3)">${s.count}x</span><button class="share-link-item-btn" data-token="${s.token}">Hapus</button>`;
    div.querySelector('button').addEventListener('click', async () => {
      await fetch(`/api/files/share/${s.token}`, { method: 'DELETE' });
      loadShareLinks();
      toast('Share link dihapus');
    });
    list.appendChild(div);
  }
}

// ===== SEARCH =====
$('searchBtn').addEventListener('click', () => {
  $('searchBar').classList.toggle('hidden');
  if (!$('searchBar').classList.contains('hidden')) $('searchInput').focus();
});

$('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase();
  renderItems();
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
  // Download each selected file
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

  menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 220) + 'px';
}

$('contextMenu').querySelectorAll('.ctx-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!contextItem) return;
    const act = btn.dataset.action;
    if (act === 'preview' && contextItem.type !== 'folder') previewFile(contextItem);
    if (act === 'download') downloadFile(contextItem);
    if (act === 'rename') renameFile(contextItem);
    if (act === 'share') openShareModal(contextItem);
    if (act === 'delete') deleteFiles([contextItem.key]);
    $('contextMenu').classList.add('hidden');
    contextItem = null;
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('#contextMenu')) $('contextMenu').classList.add('hidden');
});

// ===== MODAL CLOSE =====
document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeAllModals);
});

function closeAllModals() {
  qsa('.modal').forEach(m => m.classList.add('hidden'));
  $('previewBody').innerHTML = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ===== INIT =====
checkAuth();
