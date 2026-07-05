import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';

export interface StoredFile {
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageDriver {
  save(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

/** Local-disk driver used in dev/self-hosted deployments. */
class LocalStorageDriver implements StorageDriver {
  async save(buffer: Buffer, originalName: string, mimeType: string, folder = 'misc'): Promise<StoredFile> {
    const ext = path.extname(originalName) || '';
    const key = `${folder}/${randomUUID()}${ext}`;
    const fullPath = path.join(env.STORAGE_LOCAL_ROOT, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { key, url: this.getUrl(key), mimeType, sizeBytes: buffer.length };
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(env.STORAGE_LOCAL_ROOT, key);
    await fs.rm(fullPath, { force: true });
  }

  getUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_BASE_URL}/${key}`;
  }
}

/**
 * S3-compatible driver stub — same interface as LocalStorageDriver so switching
 * STORAGE_DRIVER=s3 in env requires no call-site changes. Wire an actual SDK
 * (aws-sdk / @aws-sdk/client-s3) here when a bucket is provisioned.
 */
class S3StorageDriver implements StorageDriver {
  async save(): Promise<StoredFile> {
    throw new Error('S3 storage driver not yet configured. Set STORAGE_DRIVER=local or implement S3StorageDriver.');
  }
  async delete(): Promise<void> {
    throw new Error('S3 storage driver not yet configured.');
  }
  getUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_BASE_URL}/${key}`;
  }
}

export const storage: StorageDriver = env.STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver();
