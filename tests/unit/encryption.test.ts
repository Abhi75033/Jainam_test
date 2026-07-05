import { encryptField, decryptField, hashForLookup } from '@/utils/encryption';

describe('Field encryption (§8 sensitive fields)', () => {
  it('round-trips Aadhaar/PAN values', () => {
    const aadhaar = '1234-5678-9012';
    const encrypted = encryptField(aadhaar);
    expect(encrypted).not.toContain(aadhaar);
    expect(decryptField(encrypted)).toBe(aadhaar);
  });

  it('produces different ciphertexts per call (random IV) but stable lookup hashes', () => {
    const value = 'ABCDE1234F';
    expect(encryptField(value)).not.toBe(encryptField(value));
    expect(hashForLookup(value)).toBe(hashForLookup(value));
    expect(hashForLookup(value)).not.toBe(hashForLookup('different'));
  });
});
