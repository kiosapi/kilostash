// KiloStash — Frontend logic
const API = '/api/file';
let authToken = localStorage.getItem('kilostash_token') || '';
let currentView = 'grid';

// ===== AUTH =====
const loginScreen = document.getElementById('loginScreen');
const app = document.getElementById('app');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

async function login() {
  const pw = passwordInput.value;
  if (!pw) return;
  loginBtn.disabled = true;
  loginError.textContent = '';
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) throw new Error('Wrong password');
    const data = await res.json();
    authToken = data.token;
    localStorage.setItem('kilostash_token', authToken);
    showApp();
  } catch (e) {
    loginError.textContent = 'Password salah';
    passwordInput.value = '';
  }
  loginBtn.disabled = false;
}

function logout() {
  authToken = '';
  localStorage.removeItem('kilostash_token');
  app.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  passwordInput.value = '';
  passwordInput.focus();
}

function showApp() {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  loadFiles();
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
logoutBtn.addEventListener('click', logout);

// Auto-login if token exists
if (authToken) {
  fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: authToken }),
  }).then(res => {
    if (res.ok) showApp();
    else { authToken = ''; localStorage.removeItem('kilostash_token'); }
  }).catch(() => {});
}

// ===== FILE TYPES =====
function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','bmp','svg','heic'].includes(ext)) return 'image';
  if (['mp4','webm','mov','avi','mkv','m4v'].includes(ext)) return 'video';
  if (['mp3','wav','flac','aac','ogg','m4a'].includes(ext)) return 'audio';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc','docx','txt','md','rtf'].includes(ext)) return 'document';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return 'archive';
  if (['js','ts','py','go','rs','java','c','cpp','html','css','json','xml','yaml','yml','sh','bat','sql','php','rb','vue','jsx','tsx'].includes(ext)) return 'code';
  return 'file';
}

function fileIcon(type) {
  const icons = {
    image: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    video: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    audio: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    pdf: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    document: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    archive: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
    code: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    file: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };
  return icons[type] || icons.file;
}

// ===== FORMAT =====
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' menit lalu';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSizeShort(bytes) {
  if (bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ===== API HELPERS =====
async function apiCall(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...options.headers, 'Authorization': 'Bearer ' + authToken },
  });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  return res;
}

// ===== FILE LIST =====
let allFiles = [];

async function loadFiles() {
  try {
    const res = await apiCall('/list');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    allFiles = data.files || [];
    renderFiles();
    updateStorage();
  } catch (e) {
    console.error(e);
  }
}

function updateStorage() {
  const total = allFiles.reduce((s, f) => s + (f.size || 0), 0);
  const info = document.getElementById('storageInfo');
  info.textContent = formatSizeShort(total) + ' / 10 GB';
}

function renderFiles() {
  const grid = document.getElementById('fileGrid');
  const list = document.getElementById('fileList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('fileCount');

  count.textContent = allFiles.length + ' File';

  if (allFiles.length === 0) {
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    list.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = '';
  list.innerHTML = '';

  allFiles.forEach(file => {
    const type = getFileType(file.name);

    if (currentView === 'grid') {
      const card = document.createElement('div');
      card.className = 'file-card';
      card.onclick = () => previewFile(file);

      let thumb = '';
      if (type === 'image') {
        thumb = `<img src="/api/file/preview/${encodeURIComponent(file.name)}" loading="lazy" alt="${file.name}">`;
      } else if (type === 'video') {
        thumb = `<video src="/api/file/preview/${encodeURIComponent(file.name)}" preload="metadata" muted></video>`;
      } else {
        thumb = `<div class="file-thumb-icon">${fileIcon(type)}</div>`;
      }

      card.innerHTML = `
        <div class="file-thumb">${thumb}</div>
        <div class="file-actions">
          <button class="file-action-btn" onclick="event.stopPropagation();downloadFile('${file.name}')" title="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="file-action-btn danger" onclick="event.stopPropagation();deleteFile('${file.name}')" title="Hapus">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <div class="file-card-info">
          <div class="file-card-name">${file.name}</div>
          <div class="file-card-meta">${formatSize(file.size)} · ${formatDate(file.uploaded)}</div>
        </div>
      `;
      grid.appendChild(card);
    } else {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.onclick = () => previewFile(file);
      row.innerHTML = `
        <div class="file-row-icon">${fileIcon(type)}</div>
        <div class="file-row-info">
          <div class="file-row-name">${file.name}</div>
          <div class="file-row-meta">${formatSize(file.size)} · ${formatDate(file.uploaded)}</div>
        </div>
        <div class="file-row-actions" style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="event.stopPropagation();downloadFile('${file.name}')" title="Download">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="btn-icon" onclick="event.stopPropagation();deleteFile('${file.name}')" title="Hapus" style="color:var(--danger)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      list.appendChild(row);
    }
  });

  if (currentView === 'grid') {
    grid.classList.remove('hidden');
    list.classList.add('hidden');
  } else {
    grid.classList.add('hidden');
    list.classList.remove('hidden');
  }
}

// ===== VIEW TOGGLE =====
document.getElementById('gridViewBtn').addEventListener('click', () => {
  currentView = 'grid';
  document.getElementById('gridViewBtn').classList.add('active');
  document.getElementById('listViewBtn').classList.remove('active');
  renderFiles();
});

document.getElementById('listViewBtn').addEventListener('click', () => {
  currentView = 'list';
  document.getElementById('listViewBtn').classList.add('active');
  document.getElementById('gridViewBtn').classList.remove('active');
  renderFiles();
});

// ===== UPLOAD =====
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', e => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

async function handleFiles(files) {
  const progress = document.getElementById('uploadProgress');
  progress.classList.remove('hidden');
  progress.innerHTML = '';

  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.innerHTML = `
      <span class="upload-item-name">${file.name}</span>
      <div class="upload-item-bar"><div class="upload-item-fill" style="width:0%"></div></div>
      <span class="upload-item-status">0%</span>
    `;
    progress.appendChild(item);

    const fill = item.querySelector('.upload-item-fill');
    const status = item.querySelector('.upload-item-status');

    try {
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            fill.style.width = pct + '%';
            status.textContent = pct + '%';
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            fill.style.width = '100%';
            status.textContent = '✓';
            status.style.color = 'var(--success)';
            resolve();
          } else {
            reject(new Error('Upload failed: ' + xhr.status));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', API + '/upload');
        xhr.setRequestHeader('Authorization', 'Bearer ' + authToken);
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
      });
    } catch (e) {
      status.textContent = '✕';
      status.style.color = 'var(--danger)';
      console.error(e);
    }
  }

  await loadFiles();
  setTimeout(() => {
    progress.classList.add('hidden');
    progress.innerHTML = '';
  }, 1500);
}

// ===== PREVIEW =====
function previewFile(file) {
  const modal = document.getElementById('previewModal');
  const name = document.getElementById('previewName');
  const body = document.getElementById('previewBody');
  const type = getFileType(file.name);

  name.textContent = file.name;
  body.innerHTML = '<div class="loading-center"><div class="loading-spinner"></div></div>';
  modal.classList.remove('hidden');

  const url = `/api/file/preview/${encodeURIComponent(file.name)}`;

  if (type === 'image') {
    body.innerHTML = `<img src="${url}" alt="${file.name}" onclick="window.open('${url}','_blank')">`;
  } else if (type === 'video') {
    body.innerHTML = `<video src="${url}" controls playsinline></video>`;
  } else if (type === 'audio') {
    body.innerHTML = `<audio src="${url}" controls></audio>`;
  } else if (type === 'pdf') {
    body.innerHTML = `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:var(--radius)"></iframe>`;
  } else {
    body.innerHTML = `<div class="preview-file-icon">${fileIcon(type)}<p>Preview tidak tersedia. Download untuk membuka.</p></div>`;
  }
}

function closePreview() {
  document.getElementById('previewModal').classList.add('hidden');
  document.getElementById('previewBody').innerHTML = '';
}

// ===== DOWNLOAD =====
async function downloadFile(name) {
  const res = await apiCall('/download/' + encodeURIComponent(name));
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== DELETE =====
async function deleteFile(name) {
  if (!confirm('Hapus "' + name + '"?')) return;
  try {
    const res = await apiCall('/delete/' + encodeURIComponent(name), { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed');
    loadFiles();
  } catch (e) {
    alert('Gagal hapus file');
  }
}

// Expose for inline onclick
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;
window.closePreview = closePreview;
