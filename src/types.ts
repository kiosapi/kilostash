// Types for KiloStash
export interface Env {
  BUCKET: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  AUTH_PASSWORD: string;
}

export interface FileMeta {
  name: string;
  key: string;
  size: number;
  uploaded: string;
  type: string;
  folder: string;
}

export interface ShareLink {
  token: string;
  key: string;
  createdAt: string;
  expires: string | null;
  download: boolean;
  count: number;
}

export interface Settings {
  passwordHash: string;
  siteName: string;
  maxFileSize: number;
}
