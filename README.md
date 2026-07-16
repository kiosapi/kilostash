# KiloStash

Personal cloud storage — Cloudflare R2 + Workers (Hono + TypeScript), free forever.

## Features
- Drag & drop upload (multi-file, max 200MB)
- Folders with navigation
- Photo/video/audio/PDF preview
- Download & delete
- Rename files
- Share links (with expiry, download mode)
- Bulk select & delete
- Search & sort
- Grid/list view toggle
- Storage stats (10GB free)
- Password change from dashboard (no code edit)
- Apple-style dark UI, fully responsive
- Cookie-based auth (preview works in &lt;img&gt;/&lt;video&gt;)

## Tech Stack
- **API:** Hono + TypeScript on Cloudflare Workers
- **Storage:** Cloudflare R2 (10GB free, no egress fees)
- **Settings:** Cloudflare KV (password hash, site name, share links)
- **Frontend:** Vanilla HTML/CSS/JS, Apple-style design

## Setup

1. Clone repo
2. `npm install`
3. Create R2 bucket: `npx wrangler r2 bucket create kilostash`
4. Create KV namespace: `npx wrangler kv namespace create KV` — update `id` in wrangler.toml
5. Set password: `echo "YOUR_PASSWORD" | npx wrangler secret put AUTH_PASSWORD`
6. Deploy: `npm run deploy`
7. Access at `https://kilostash.<your-subdomain>.workers.dev`

## Local Dev
```bash
npm install
npx wrangler dev
```

## Change Password
Login → Settings (gear icon) → Change Password. Stored hashed in KV.

## Deploy
```bash
npm run deploy
```
