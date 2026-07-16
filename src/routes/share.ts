import { Hono } from 'hono';
import type { Env } from '../types';
import { parseKey, getFileType } from '../utils';

// Public share routes — no auth required
const share = new Hono<{ Bindings: Env }>();

// GET /s/:token — Redirect to shared file or show info
share.get('/:token', async (c) => {
  const token = c.req.param('token');
  const raw = await c.env.KV.get('share:' + token);
  if (!raw) return c.html(notFoundHtml(), 404);

  const data = JSON.parse(raw);

  // Check expiry
  if (data.expires && new Date(data.expires) < new Date()) {
    await c.env.KV.delete('share:' + token);
    return c.html(expiredHtml(), 410);
  }

  // Increment view count
  data.count++;
  await c.env.KV.put('share:' + token, JSON.stringify(data));

  const obj = await c.env.BUCKET.get(data.key);
  if (!obj) return c.html(notFoundHtml(), 404);

  const { name } = parseKey(data.key);
  const type = getFileType(name);

  // If download flag set, force download
  if (data.download) {
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    return new Response(obj.body, { headers });
  }

  // Get file size for range support
  const head = await c.env.BUCKET.head(data.key);
  const fileSize = head?.size || 0;
  const contentType = head?.httpMetadata?.contentType || 'application/octet-stream';

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-cache');
  headers.set('Accept-Ranges', 'bytes');

  // Range support for video streaming
  const range = c.req.header('range');
  if (range && fileSize > 0) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : fileSize - 1;
      const length = end - start + 1;

      const rangedObj = await c.env.BUCKET.get(data.key, {
        range: { offset: start, length },
      });
      if (!rangedObj) return c.html(notFoundHtml(), 404);

      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      headers.set('Content-Length', String(length));
      return new Response(rangedObj.body, { status: 206, headers });
    }
  }

  headers.set('Content-Length', String(fileSize));
  return new Response(obj.body, { headers });
});

function notFoundHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Tidak Ditemukan</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{text-align:center;padding:40px}.card svg{color:#ff453a;margin-bottom:16px}.card h1{font-size:22px;margin-bottom:8px}.card p{color:rgba(235,235,245,0.6);font-size:15px}</style></head><body><div class="card"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h1>Link Tidak Ditemukan</h1><p>Link share ini tidak ada atau sudah dihapus.</p></div></body></html>`;
}

function expiredHtml(): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{text-align:center;padding:40px}.card svg{color:#ff9500;margin-bottom:16px}.card h1{font-size:22px;margin-bottom:8px}.card p{color:rgba(235,235,245,0.6);font-size:15px}</style></head><body><div class="card"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h1>Link Expired</h1><p>Link share ini sudah kedaluwarsa.</p></div></body></html>`;
}

export default share;
