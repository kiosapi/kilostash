import { Hono } from 'hono';
import type { Env } from './types';
import auth from './routes/auth';
import files from './routes/files';
import settings from './routes/settings';
import share from './routes/share';

const app = new Hono<{ Bindings: Env }>();

// Public share routes (no auth)
app.route('/s', share);

// API routes
app.route('/api/auth', auth);
app.route('/api/files', files);
app.route('/api/settings', settings);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

// SPA fallback: serve index.html for non-API, non-asset routes
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
