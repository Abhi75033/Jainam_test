import { createSignedToken, verifySignedToken } from '@/engines/qr/qr.service';

describe('QR Engine (§4.5)', () => {
  it('round-trips a signed ticket payload', () => {
    const token = createSignedToken({ purpose: 'EVENT_TICKET', id: 'JFTK108', eventId: 'evt_1', bookingId: 'bk_1' });
    const payload = verifySignedToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.purpose).toBe('EVENT_TICKET');
    expect(payload!.id).toBe('JFTK108');
    expect((payload as any).eventId).toBe('evt_1');
  });

  it('rejects a tampered token', () => {
    const token = createSignedToken({ purpose: 'EVENT_TICKET', id: 'JFTK108' });
    const [encoded, signature] = token.split('.');
    const tamperedBody = Buffer.from(JSON.stringify({ purpose: 'EVENT_TICKET', id: 'JFTK999', ts: Date.now() })).toString('base64url');
    expect(verifySignedToken(`${tamperedBody}.${signature}`)).toBeNull();
    expect(verifySignedToken(`${encoded}.deadbeef${'0'.repeat(56)}`)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySignedToken('garbage')).toBeNull();
    expect(verifySignedToken('a.b')).toBeNull();
  });

  it('carries no personal info in the payload', () => {
    const token = createSignedToken({ purpose: 'EVENT_TICKET', id: 'JFTK108', eventId: 'e', bookingId: 'b' });
    const decoded = Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8');
    expect(decoded).not.toMatch(/name|mobile|email|address/i);
  });
});
