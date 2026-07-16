import { Hono } from 'hono';
import type { Env } from '../types';
import { checkAuth, unauthorized, verifyPassword, getSettings, saveSettings, hashPassword } from '../utils';

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth/login — Login, set cookie
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const password = body.password;
  if (!password) return c.json({ error: 'Password required' }, 400);

  const valid = await verifyPassword(password, c.env);
  if (!valid) return c.json({ error: 'Password salah' }, 401);

  return c.json({ success: true }, {
    headers: {
      'Set-Cookie': `kilostash_token=${encodeURIComponent(password)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    },
  });
});

// POST /api/auth/logout — Clear cookie
auth.post('/logout', (c) => {
  return c.json({ success: true }, {
    headers: {
      'Set-Cookie': 'kilostash_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
});

// GET /api/auth/check — Check if logged in
auth.get('/check', async (c) => {
  if (!checkAuth(c.req.raw, c.env)) return c.json({ authed: false });
  const settings = await getSettings(c.env.KV);
  return c.json({
    authed: true,
    siteName: settings?.siteName || 'KiloStash',
    maxFileSize: settings?.maxFileSize || 104857600,
  });
});

// POST /api/auth/change-password — Change password
auth.post('/change-password', async (c) => {
  if (!checkAuth(c.req.raw, c.env)) return unauthorized();

  const body = await c.req.json();
  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) return c.json({ error: 'Both passwords required' }, 400);
  if (newPassword.length < 4) return c.json({ error: 'Password min 4 karakter' }, 400);

  const valid = await verifyPassword(currentPassword, c.env);
  if (!valid) return c.json({ error: 'Password lama salah' }, 401);

  const hash = await hashPassword(newPassword);
  const settings = await getSettings(c.env.KV) || { passwordHash: '', siteName: 'KiloStash', maxFileSize: 104857600 };
  settings.passwordHash = hash;
  await saveSettings(c.env.KV, settings);

  return c.json({ success: true }, {
    headers: {
      'Set-Cookie': `kilostash_token=${encodeURIComponent(newPassword)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    },
  });
});

export default auth;
