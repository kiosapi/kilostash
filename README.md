# KiloStash

Personal cloud storage — Cloudflare R2 + Pages, free forever.

## Setup

1. Create R2 bucket in Cloudflare dashboard: `kilostash`
2. Deploy: `npx wrangler pages deploy . --project-name=kilostash`
3. Set secret: `npx wrangler pages secret put AUTH_PASSWORD --project-name=kilostash`
4. Bind R2 bucket in Pages settings

## Local Dev

```bash
npx wrangler pages dev .
```

## Features
- Drag & drop upload
- Photo/video preview
- Download & delete
- Password protected
- Apple-style UI, fully responsive
- 10GB free storage, no egress fees
