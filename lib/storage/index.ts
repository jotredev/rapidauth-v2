import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getS3StorageConfig, getStorageDriver, type StorageDriver } from './config';
export { getImageTypeFromBytes } from './image-type';
export { getS3StorageConfig, getS3StorageConfigError, getStorageConfigError, getStorageDriver } from './config';
export type { S3StorageConfig, StorageDriver } from './config';

export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  keyFromUrl(url: string): string | null;
  get(key: string): Promise<Buffer | null>;
}

function normalizeKey(key: string): string {
  const decoded = decodeRepeatedly(key);
  if (!decoded || decoded.includes('\0') || decoded.includes('\\') || isAbsolute(decoded)) {
    throw new Error('Invalid storage key.');
  }
  const segments = decoded.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..' || part.includes(':'))) {
    throw new Error('Invalid storage key.');
  }
  return segments.join('/');
}

function decodeRepeatedly(value: string): string {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    let next: string;
    try { next = decodeURIComponent(decoded); } catch { throw new Error('Invalid encoded storage key.'); }
    if (next === decoded) return decoded;
    decoded = next;
  }
  if (/%(?:2e|2f|5c|25)/i.test(decoded)) throw new Error('Invalid encoded storage key.');
  return decoded;
}

export function resolveLocalStoragePath(root: string, key: string): string {
  const safeKey = normalizeKey(key);
  const absoluteRoot = resolve(root);
  const filePath = resolve(absoluteRoot, ...safeKey.split('/'));
  const fromRoot = relative(absoluteRoot, filePath);
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) {
    throw new Error('Storage key is outside the local storage directory.');
  }
  return filePath;
}

export function createLocalStorage(root = resolve(process.cwd(), 'storage', 'uploads')): FileStorage {
  const getPath = (key: string) => resolveLocalStoragePath(root, key);
  return {
    async put(key, bytes) {
      const filePath = getPath(key);
      await mkdir(resolve(filePath, '..'), { recursive: true });
      await writeFile(filePath, bytes);
      return `/uploads/${normalizeKey(key)}`;
    },
    async delete(key) {
      try { await unlink(getPath(key)); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
    keyFromUrl(url) {
      let pathname: string;
      try { pathname = new URL(url, 'http://rapidauth.local').pathname; } catch { return null; }
      if (!pathname.startsWith('/uploads/')) return null;
      const key = pathname.slice('/uploads/'.length);
      try { return normalizeKey(key); } catch { return null; }
    },
    async get(key) {
      try { return await readFile(getPath(key)); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}

export function createS3Storage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  const config = getS3StorageConfig(env);
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    async put(key, bytes, contentType) {
      const safeKey = normalizeKey(key);
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: safeKey, Body: bytes, ContentType: contentType }));
      return `${config.publicUrl}/${safeKey}`;
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: normalizeKey(key) }));
    },
    keyFromUrl(url) {
      let pathname: string;
      try {
        const parsed = new URL(url);
        const publicUrl = new URL(config.publicUrl);
        if (parsed.origin !== publicUrl.origin) return null;
        const prefix = publicUrl.pathname.replace(/\/+$/, '');
        if (prefix && !parsed.pathname.startsWith(`${prefix}/`)) return null;
        pathname = prefix ? parsed.pathname.slice(prefix.length + 1) : parsed.pathname.replace(/^\//, '');
      } catch { return null; }
      try { return normalizeKey(pathname); } catch { return null; }
    },
    async get(key) {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: normalizeKey(key) }));
        return response.Body ? Buffer.from(await response.Body.transformToByteArray()) : null;
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey' || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
  };
}

export function createStorage(driver: StorageDriver = getStorageDriver(), localRoot?: string, env = process.env): FileStorage {
  return driver === 'local' ? createLocalStorage(localRoot) : createS3Storage(env);
}

let defaultStorage: FileStorage | undefined;

// Created on first use so tools such as setup:prod can start while the storage configuration is incomplete.
export function getStorage(): FileStorage {
  defaultStorage ??= createStorage();
  return defaultStorage;
}

export const getObjectFileName = (key: string) => basename(normalizeKey(key));
