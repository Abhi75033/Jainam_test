import { COUNTRY_CURRENCY_MAP, DEFAULT_CURRENCY } from '@/config/constants';

/** Currency Engine (§4.6): default currency auto-set from member's country; member can override. */
export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY_MAP[country] ?? DEFAULT_CURRENCY;
}

/**
 * Called when a member's country changes. Per spec this only *suggests*
 * (never forces) a currency update, so callers should surface `suggested`
 * to the client and let the member confirm before writing it back.
 */
export function suggestCurrencyOnCountryChange(newCountry: string, currentCurrency: string): { suggested: string; changed: boolean } {
  const suggested = currencyForCountry(newCountry);
  return { suggested, changed: suggested !== currentCurrency };
}

export function formatMoney(amount: number | string, currencyCode: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}
