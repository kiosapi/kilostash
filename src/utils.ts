import type { Env, Settings } from './types';

// Hash password using SHA-256 + salt
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode('kilostash_salt_' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function checkAuth(request: Request, env: Env): boolean {
  const cookieToken = getCookie(request, 'kilostash_token');
  if (cookieToken && cookieToken === env.AUTH_PASSWORD) return true;

  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7) === env.AUTH_PASSWORD;
  }

  return false;
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function getExt(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileType(name: string): string {
  const ext = getExt(name);
  const map: Record<string, string[]> = {
    image: ['jpg','jpeg','png','gif','webp','bmp','svg','heic','avif','ico','tiff'],
    video: ['mp4','webm','mov','avi','mkv','m4v','flv','wmv','ts','3gp'],
    audio: ['mp3','wav','flac','aac','ogg','m4a','opus','wma'],
    pdf: ['pdf'],
    document: ['doc','docx','txt','md','rtf','odt','pages'],
    spreadsheet: ['xls','xlsx','csv','ods','numbers'],
    presentation: ['ppt','pptx','key','odp'],
    archive: ['zip','rar','7z','tar','gz','bz2','xz'],
    code: ['js','ts','py','go','rs','java','c','cpp','h','hpp','html','css','scss','less','json','xml','yaml','yml','sh','bash','bat','ps1','sql','php','rb','vue','jsx','tsx','swift','kt','dart','lua','r','scala','pl'],
    font: ['ttf','otf','woff','woff2','eot'],
  };
  for (const [type, exts] of Object.entries(map)) {
    if (exts.includes(ext)) return type;
  }
  return 'file';
}

export function parseKey(key: string): { folder: string; name: string } {
  const idx = key.lastIndexOf('/');
  if (idx === -1) return { folder: '/', name: key };
  return { folder: '/' + key.slice(0, idx), name: key.slice(idx + 1) };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

// KV helpers
export async function getSettings(kv: KVNamespace): Promise<Settings | null> {
  const raw = await kv.get('settings');
  return raw ? JSON.parse(raw) : null;
}

export async function saveSettings(kv: KVNamespace, settings: Settings): Promise<void> {
  await kv.put('settings', JSON.stringify(settings));
}

// Get effective password: KV settings override env AUTH_PASSWORD
export async function getEffectivePassword(env: Env): Promise<string> {
  const settings = await getSettings(env.KV);
  if (settings?.passwordHash) return settings.passwordHash;
  return env.AUTH_PASSWORD;
}

export async function verifyPassword(password: string, env: Env): Promise<boolean> {
  const settings = await getSettings(env.KV);
  if (settings?.passwordHash) {
    const hash = await hashPassword(password);
    return hash === settings.passwordHash;
  }
  return password === env.AUTH_PASSWORD;
}
