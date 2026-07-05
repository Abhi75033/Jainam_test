import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * AES-256-GCM field-level encryption for sensitive columns (Aadhaar, PAN, bank details).
 * §8 Non-Functional Requirements: "encryption at rest for sensitive fields ... use pgcrypto
 * or app-level AES". We use app-level AES-256-GCM so it works identically regardless of
 * the underlying Postgres extensions available.
 */
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = env.FIELD_ENCRYPTION_KEY;
  // Accept base64 or utf8 32-byte keys; hash to a stable 32-byte key either way.
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptField(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptField(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** One-way hash for duplicate-prevention lookups (e.g. Aadhaar uniqueness) without storing plaintext twice. */
export function hashForLookup(value: string): string {
  return crypto.createHmac('sha256', getKey()).update(value).digest('hex');
}
