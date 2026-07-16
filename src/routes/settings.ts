import { Hono } from 'hono';
import type { Env } from '../types';
import { checkAuth, unauthorized, getSettings, saveSettings } from '../utils';

const settings = new Hono<{ Bindings: Env }>();

// Middleware: require auth
settings.use('*', async (c, next) => {
  if (!checkAuth(c.req.raw, c.env)) return unauthorized();
  await next();
});

// GET /api/settings
settings.get('/', async (c) => {
  const s = await getSettings(c.env.KV);
  return c.json({
    siteName: s?.siteName || 'KiloStash',
    maxFileSize: s?.maxFileSize || 104857600,
  });
});

// POST /api/settings — Update settings
settings.post('/', async (c) => {
  const body = await c.req.json();
  const current = await getSettings(c.env.KV) || { passwordHash: '', siteName: 'KiloStash', maxFileSize: 104857600 };

  if (body.siteName) current.siteName = body.siteName;
  if (body.maxFileSize) current.maxFileSize = body.maxFileSize;

  await saveSettings(c.env.KV, current);
  return c.json({ success: true });
});

export default settings;
