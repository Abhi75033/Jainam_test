import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '@/config/env';

export type QrPurpose = 'EVENT_TICKET' | 'STAFF_IDENTITY' | 'VISITOR_CHECKIN' | 'MEMBER_ID' | 'BOOKING' | 'TOUR_CERTIFICATE';

export interface QrPayload {
  purpose: QrPurpose;
  id: string; // ticketId / staffId / entryId / memberId / bookingId / certificateId
  [key: string]: unknown;
}

/**
 * QR Engine (§4.5). Payloads are HMAC-signed so the server can validate
 * authenticity without a DB round-trip, and carry no personal info — only
 * IDs the validation endpoint uses to look up the real record.
 */
function sign(payload: string): string {
  return crypto.createHmac('sha256', env.QR_SIGNING_SECRET).update(payload).digest('hex');
}

export function createSignedToken(payload: QrPayload): string {
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  const encoded = Buffer.from(body).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySignedToken<T extends QrPayload = QrPayload>(token: string): T | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function renderQrPngDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
}

export async function renderQrBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
}
