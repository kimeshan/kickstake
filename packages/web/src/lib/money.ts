const SYMBOLS: Record<string, string> = {
  ZAR: "R",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Formats an integer minor-unit amount (e.g. cents) as a currency string. */
export function formatMoney(minor: number, currency = "ZAR"): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const hasCents = minor % 100 !== 0;
  const major = (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${major}`;
}

/** Major units (e.g. "150") → integer minor units (15000). */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}
