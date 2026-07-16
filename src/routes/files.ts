import { Hono } from 'hono';
import type { Env, FileMeta } from '../types';
import { checkAuth, unauthorized, getFileType, parseKey, generateToken } from '../utils';

const files = new Hono<{ Bindings: Env }>();

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Middleware: require auth for all file routes
files.use('*', async (c, next) => {
  if (!checkAuth(c.req.raw, c.env)) return unauthorized();
  await next();
});

// GET /api/files?folder=/path — List files in folder
files.get('/', async (c) => {
  const folder = c.req.query('folder') || '/';
  const prefix = folder === '/' ? '' : folder.replace(/^\/+|\/+$/g, '') + '/';
  const listed = await c.env.BUCKET.list({ prefix });
  const result: FileMeta[] = [];
  const folders = new Set<string>();

  for (const obj of listed.objects) {
    // Skip trash system files
    if (obj.key.startsWith('__trash__/') || obj.key.endsWith('/.keep')) continue;

    const relativeKey = prefix ? obj.key.slice(prefix.length) : obj.key;
    // If there's a subfolder, add it to folders set
    const slashIdx = relativeKey.indexOf('/');
    if (slashIdx !== -1) {
      const folderName = relativeKey.slice(0, slashIdx);
      folders.add(folderName);
      continue; // Skip files in subfolders — they'll show when navigating
    }
    const { folder: _f, name } = parseKey(obj.key);
    result.push({
      name,
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      type: getFileType(name),
      folder: folder,
    });
  }

  // Include subfolders in response
  const folderList = [...folders].map(f => ({
    name: f,
    key: prefix + f,
    type: 'folder',
    folder: folder,
  }));

  return c.json({ files: result, folders: folderList });
});

// GET /api/files/stats — Storage stats
files.get('/stats', async (c) => {
  const listed = await c.env.BUCKET.list();
  let totalSize = 0;
  let totalFiles = 0;
  const byType: Record<string, { count: number; size: number }> = {};

  for (const obj of listed.objects) {
    if (obj.key.startsWith('__trash__/') || obj.key.endsWith('/.keep')) continue;
    totalSize += obj.size;
    totalFiles++;
    const { name } = parseKey(obj.key);
    const type = getFileType(name);
    if (!byType[type]) byType[type] = { count: 0, size: 0 };
    byType[type].count++;
    byType[type].size += obj.size;
  }

  return c.json({
    totalSize,
    totalFiles,
    byType,
    freeSpace: 10 * 1024 * 1024 * 1024 - totalSize, // 10GB limit
  });
});

// GET /api/files/preview/* — Stream file with Range support for video
files.get('/preview/*', async (c) => {
  const key = c.req.path.replace('/api/files/preview/', '');
  const decodedKey = decodeURIComponent(key);

  // Get metadata first
  const head = await c.env.BUCKET.head(decodedKey);
  if (!head) return c.json({ error: 'Not found' }, 404);

  const fileSize = head.size;
  const contentType = head.httpMetadata?.contentType || 'application/octet-stream';

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');

  // Parse Range header
  const range = c.req.header('range');

  if (range) {
    // Parse "bytes=start-end"
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : fileSize - 1;
      const length = end - start + 1;

      // R2 get with range
      const obj = await c.env.BUCKET.get(decodedKey, {
        range: { offset: start, length: length },
      });
      if (!obj) return c.json({ error: 'Not found' }, 404);

      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      headers.set('Content-Length', String(length));
      headers.set('Content-Type', contentType);

      return new Response(obj.body, { status: 206, headers });
    }
  }

  // No range — return full file
  const obj = await c.env.BUCKET.get(decodedKey);
  if (!obj) return c.json({ error: 'Not found' }, 404);

  headers.set('Content-Length', String(fileSize));
  return new Response(obj.body, { headers });
});

// GET /api/files/download/:key+ — Force download
files.get('/download/*', async (c) => {
  const key = c.req.path.replace('/api/files/download/', '');
  const decodedKey = decodeURIComponent(key);
  const obj = await c.env.BUCKET.get(decodedKey);
  if (!obj) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(parseKey(decodedKey).name)}"`);

  return new Response(obj.body, { headers });
});

// POST /api/files/upload — Upload file(s)
files.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const folder = (formData.get('folder') as string) || '/';
  const uploadedFiles = formData.getAll('file');

  if (uploadedFiles.length === 0) return c.json({ error: 'No files' }, 400);

  const results = [];
  for (const f of uploadedFiles) {
    const file = f as File;
    if (file.size > MAX_FILE_SIZE) {
      results.push({ name: file.name, error: 'File too large (max 200MB)' });
      continue;
    }

    const prefix = folder === '/' ? '' : folder.replace(/^\/+|\/+$/g, '') + '/';
    const key = prefix + file.name;

    // Handle name collision
    let finalKey = key;
    const existing = await c.env.BUCKET.head(finalKey);
    if (existing) {
      const ext = file.name.lastIndexOf('.') >= 0 ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const base = ext ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name;
      finalKey = prefix + `${base}-${Date.now()}${ext}`;
    }

    await c.env.BUCKET.put(finalKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    results.push({ name: file.name, key: finalKey, success: true });
  }

  return c.json({ files: results });
});

// DELETE /api/files/delete — Soft delete (move to trash)
files.delete('/delete', async (c) => {
  const body = await c.req.json();
  const keys: string[] = body.keys;
  if (!keys || !Array.isArray(keys)) return c.json({ error: 'keys array required' }, 400);

  const results = [];
  for (const key of keys) {
    try {
      // Get object metadata before moving to trash
      const head = await c.env.BUCKET.head(key);
      if (!head) { results.push({ key, success: false }); continue; }

      // Store trash metadata in KV
      const trashData = {
        key,
        name: parseKey(key).name,
        size: head.size,
        type: getFileType(parseKey(key).name),
        deletedAt: new Date().toISOString(),
        uploaded: head.uploaded.toISOString(),
      };
      await c.env.KV.put('trash:' + key, JSON.stringify(trashData));

      // Move object to trash prefix in R2
      const trashKey = '__trash__/' + key;
      const obj = await c.env.BUCKET.get(key);
      if (obj) {
        await c.env.BUCKET.put(trashKey, obj.body, {
          httpMetadata: head.httpMetadata,
        });
        await c.env.BUCKET.delete(key);
      }

      // Remove from favorites if exists
      await c.env.KV.delete('fav:' + key);

      results.push({ key, success: true });
    } catch {
      results.push({ key, success: false });
    }
  }

  return c.json({ results });
});

// GET /api/files/trash — List trash items
files.get('/trash', async (c) => {
  const list = await c.env.KV.list({ prefix: 'trash:' });
  const items = [];
  for (const item of list.keys) {
    const raw = await c.env.KV.get(item.name);
    if (raw) items.push(JSON.parse(raw));
  }
  items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  return c.json({ items });
});

// POST /api/files/restore — Restore from trash
files.post('/restore', async (c) => {
  const body = await c.req.json();
  const { key } = body;
  if (!key) return c.json({ error: 'key required' }, 400);

  const trashKey = '__trash__/' + key;
  const head = await c.env.BUCKET.head(trashKey);
  if (!head) return c.json({ error: 'Not in trash' }, 404);

  const obj = await c.env.BUCKET.get(trashKey);
  if (!obj) return c.json({ error: 'Object not found' }, 404);

  // Restore to original key
  await c.env.BUCKET.put(key, obj.body, {
    httpMetadata: head.httpMetadata,
  });
  await c.env.BUCKET.delete(trashKey);
  await c.env.KV.delete('trash:' + key);

  return c.json({ success: true, key });
});

// DELETE /api/files/trash/empty — Empty trash permanently
files.delete('/trash/empty', async (c) => {
  const list = await c.env.KV.list({ prefix: 'trash:' });
  let deleted = 0;
  for (const item of list.keys) {
    const key = item.name.replace('trash:', '');
    const trashKey = '__trash__/' + key;
    await c.env.BUCKET.delete(trashKey);
    await c.env.KV.delete(item.name);
    deleted++;
  }
  return c.json({ success: true, deleted });
});

// DELETE /api/files/trash/:key — Permanently delete single trash item
files.delete('/trash/*', async (c) => {
  const key = c.req.path.replace('/api/files/trash/', '');
  const decodedKey = decodeURIComponent(key);
  const trashKey = '__trash__/' + decodedKey;

  await c.env.BUCKET.delete(trashKey);
  await c.env.KV.delete('trash:' + decodedKey);

  return c.json({ success: true });
});

// POST /api/files/favorite — Toggle favorite
files.post('/favorite', async (c) => {
  const body = await c.req.json();
  const { key } = body;
  if (!key) return c.json({ error: 'key required' }, 400);

  const favKey = 'fav:' + key;
  const existing = await c.env.KV.get(favKey);

  if (existing) {
    await c.env.KV.delete(favKey);
    return c.json({ favorite: false });
  } else {
    const head = await c.env.BUCKET.head(key);
    await c.env.KV.put(favKey, JSON.stringify({
      key,
      name: parseKey(key).name,
      size: head?.size || 0,
      type: getFileType(parseKey(key).name),
      addedAt: new Date().toISOString(),
    }));
    return c.json({ favorite: true });
  }
});

// GET /api/files/favorites — List favorites
files.get('/favorites', async (c) => {
  const list = await c.env.KV.list({ prefix: 'fav:' });
  const items = [];
  for (const item of list.keys) {
    const raw = await c.env.KV.get(item.name);
    if (raw) items.push(JSON.parse(raw));
  }
  return c.json({ items });
});

// POST /api/files/upload-url — Upload from URL
files.post('/upload-url', async (c) => {
  const body = await c.req.json();
  const { url, folder } = body;
  if (!url) return c.json({ error: 'url required' }, 400);

  try {
    const response = await fetch(url);
    if (!response.ok) return c.json({ error: 'Failed to fetch URL' }, 400);

    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;
    if (size > MAX_FILE_SIZE) return c.json({ error: 'File too large (max 200MB)' }, 400);

    // Extract filename from URL
    let filename = url.split('/').pop()?.split('?')[0] || 'download';
    if (!filename.includes('.')) {
      const ct = response.headers.get('content-type') || '';
      const ext = ct.includes('image/jpeg') ? '.jpg'
        : ct.includes('image/png') ? '.png'
        : ct.includes('video/mp4') ? '.mp4'
        : ct.includes('audio/mpeg') ? '.mp3'
        : ct.includes('application/pdf') ? '.pdf'
        : '';
      filename += ext;
    }

    const prefix = folder === '/' || !folder ? '' : folder.replace(/^\/+|\/+$/g, '') + '/';
    let finalKey = prefix + filename;
    const existing = await c.env.BUCKET.head(finalKey);
    if (existing) {
      const ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')) : '';
      const base = ext ? filename.slice(0, filename.lastIndexOf('.')) : filename;
      finalKey = prefix + `${base}-${Date.now()}${ext}`;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    await c.env.BUCKET.put(finalKey, buffer, {
      httpMetadata: { contentType },
    });

    return c.json({ success: true, key: finalKey, name: filename, size });
  } catch (e) {
    return c.json({ error: 'Failed to download: ' + (e as Error).message }, 500);
  }
});

// POST /api/files/rename — Rename file
files.post('/rename', async (c) => {
  const body = await c.req.json();
  const { oldKey, newName } = body;
  if (!oldKey || !newName) return c.json({ error: 'oldKey and newName required' }, 400);

  const obj = await c.env.BUCKET.get(oldKey);
  if (!obj) return c.json({ error: 'File not found' }, 404);

  const { folder } = parseKey(oldKey);
  const newKey = folder === '/' ? newName : folder.replace(/^\/+|\/+$/g, '') + '/' + newName;

  // Check collision
  const existing = await c.env.BUCKET.head(newKey);
  if (existing) return c.json({ error: 'File dengan nama tersebut sudah ada' }, 409);

  // Copy to new key
  await c.env.BUCKET.put(newKey, obj.body, {
    httpMetadata: obj.httpMetadata,
  });
  // Delete old
  await c.env.BUCKET.delete(oldKey);

  return c.json({ success: true, newKey });
});

// POST /api/files/folder — Create folder (placeholder file)
files.post('/folder', async (c) => {
  const body = await c.req.json();
  const { path } = body;
  if (!path) return c.json({ error: 'path required' }, 400);

  // Create a .keep file to "create" the folder
  const key = path.replace(/^\/+|\/+$/g, '') + '/.keep';
  await c.env.BUCKET.put(key, new TextEncoder().encode(''));

  return c.json({ success: true });
});

// POST /api/files/share — Create share link
files.post('/share', async (c) => {
  const body = await c.req.json();
  const { key, expiresHours, download } = body;
  if (!key) return c.json({ error: 'key required' }, 400);

  const token = generateToken();
  const shareData = {
    token,
    key,
    createdAt: new Date().toISOString(),
    expires: expiresHours ? new Date(Date.now() + expiresHours * 3600000).toISOString() : null,
    download: download || false,
    count: 0,
  };

  await c.env.KV.put('share:' + token, JSON.stringify(shareData));

  return c.json({ url: `/s/${token}`, token });
});

// GET /api/files/share/list — List share links
files.get('/share/list', async (c) => {
  const list = await c.env.KV.list({ prefix: 'share:' });
  const shares = [];
  for (const item of list.keys) {
    const raw = await c.env.KV.get(item.name);
    if (raw) shares.push(JSON.parse(raw));
  }
  return c.json({ shares });
});

// DELETE /api/files/share/:token — Delete share link
files.delete('/share/:token', async (c) => {
  const token = c.req.param('token');
  await c.env.KV.delete('share:' + token);
  return c.json({ success: true });
});

export default files;
