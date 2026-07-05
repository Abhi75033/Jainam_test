import { calculateAge, isSeniorCitizen, isMinor } from '@/utils/dateUtils';

describe('Date utils (§5.2 auto-age + senior citizen badge)', () => {
  const at = new Date('2026-07-05');

  it('computes age correctly across birthday boundaries', () => {
    expect(calculateAge(new Date('1990-07-05'), at)).toBe(36);
    expect(calculateAge(new Date('1990-07-06'), at)).toBe(35); // birthday tomorrow
    expect(calculateAge(new Date('1990-07-04'), at)).toBe(36); // birthday yesterday
  });

  it('grants Senior Citizen badge at age >= 59', () => {
    expect(isSeniorCitizen(new Date('1967-07-05'), at)).toBe(true); // exactly 59
    expect(isSeniorCitizen(new Date('1967-07-06'), at)).toBe(false); // 58, turns 59 tomorrow
  });

  it('detects minors for guardian consent (§5.2)', () => {
    expect(isMinor(new Date('2010-01-01'), at)).toBe(true);
    expect(isMinor(new Date('2000-01-01'), at)).toBe(false);
  });
});
