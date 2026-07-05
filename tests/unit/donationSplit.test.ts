import { assertSplitsMatchTotal } from '@/modules/donations/donations.service';
import { ApiError } from '@/utils/ApiError';

describe('Donation category split validation (§5.8)', () => {
  it('accepts splits that sum exactly to the total', () => {
    expect(() => assertSplitsMatchTotal(1000, [{ amount: 600 }, { amount: 400 }])).not.toThrow();
  });

  it('handles paisa-level floating point correctly', () => {
    expect(() => assertSplitsMatchTotal(100.3, [{ amount: 100.1 }, { amount: 0.2 }])).not.toThrow();
  });

  it('rejects splits that do not sum to the total', () => {
    expect(() => assertSplitsMatchTotal(1000, [{ amount: 600 }, { amount: 300 }])).toThrow(ApiError);
    expect(() => assertSplitsMatchTotal(1000, [{ amount: 600 }, { amount: 500 }])).toThrow(ApiError);
  });
});
