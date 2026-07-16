// /api/file/* — Upload, list, download, delete, preview
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  return token === env.AUTH_PASSWORD;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!checkAuth(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const path = params.file || [];

  // /api/file/list
  if (path[0] === 'list') {
    const listed = await env.BUCKET.list();
    const files = listed.objects.map(obj => ({
      name: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    }));
    return Response.json({ files });
  }

  // /api/file/preview/{name}
  if (path[0] === 'preview') {
    const name = decodeURIComponent(path.slice(1).join('/'));
    const obj = await env.BUCKET.get(name);
    if (!obj) return jsonResponse({ error: 'Not found' }, 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');

    return new Response(obj.body, { headers });
  }

  // /api/file/download/{name}
  if (path[0] === 'download') {
    const name = decodeURIComponent(path.slice(1).join('/'));
    const obj = await env.BUCKET.get(name);
    if (!obj) return jsonResponse({ error: 'Not found' }, 404);

    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);

    return new Response(obj.body, { headers });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // /api/file/upload
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) return jsonResponse({ error: 'No file' }, 400);
  if (file.size > MAX_FILE_SIZE) return jsonResponse({ error: 'File too large (max 100MB)' }, 413);

  // Generate unique key if name collision
  let key = file.name;
  const existing = await env.BUCKET.head(key);
  if (existing) {
    const ext = key.lastIndexOf('.') >= 0 ? key.slice(key.lastIndexOf('.')) : '';
    const base = ext ? key.slice(0, key.lastIndexOf('.')) : key;
    key = `${base}-${Date.now()}${ext}`;
  }

  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  return Response.json({ success: true, name: key });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  if (!checkAuth(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const path = params.file || [];
  if (path[0] !== 'delete') return jsonResponse({ error: 'Not found' }, 404);

  const name = decodeURIComponent(path.slice(1).join('/'));
  await env.BUCKET.delete(name);

  return Response.json({ success: true });
}
