import { currencyForCountry, suggestCurrencyOnCountryChange } from '@/engines/currency/currency.service';

describe('Currency Engine (§4.6)', () => {
  it('maps countries to default currencies', () => {
    expect(currencyForCountry('India')).toBe('INR');
    expect(currencyForCountry('United Kingdom')).toBe('GBP');
    expect(currencyForCountry('United States')).toBe('USD');
    expect(currencyForCountry('United Arab Emirates')).toBe('AED');
  });

  it('falls back to INR for unknown/missing countries', () => {
    expect(currencyForCountry('Atlantis')).toBe('INR');
    expect(currencyForCountry(null)).toBe('INR');
    expect(currencyForCountry(undefined)).toBe('INR');
  });

  it('suggests (never forces) a currency change on country change', () => {
    const suggestion = suggestCurrencyOnCountryChange('United Kingdom', 'INR');
    expect(suggestion).toEqual({ suggested: 'GBP', changed: true });

    const noChange = suggestCurrencyOnCountryChange('India', 'INR');
    expect(noChange.changed).toBe(false);
  });
});
