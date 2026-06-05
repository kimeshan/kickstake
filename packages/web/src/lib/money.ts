export interface CurrencyInfo {
  code: string;
  name: string;
}

/** Top ~20 world currencies for the create wizard. Default is USD. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "ZAR", name: "South African Rand" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "KRW", name: "South Korean Won" },
];

export const DEFAULT_CURRENCY = "USD";

/** Minor-unit exponent for a currency (e.g. 2 for USD, 0 for JPY/KRW). */
export function fractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** Major units (e.g. 150) → integer minor units, honouring the currency. */
export function toMinor(major: number, currency = DEFAULT_CURRENCY): number {
  return Math.round((major || 0) * 10 ** fractionDigits(currency));
}

/** Integer minor units → major units (number), honouring the currency. */
export function fromMinor(minor: number, currency = DEFAULT_CURRENCY): number {
  return minor / 10 ** fractionDigits(currency);
}

/** The narrow symbol for a currency, e.g. "$", "£", "R". */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Formats an integer minor-unit amount as a localized currency string. */
export function formatMoney(minor: number, currency = DEFAULT_CURRENCY): string {
  const d = fractionDigits(currency);
  const major = minor / 10 ** d;
  const whole = major % 1 === 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : d,
      maximumFractionDigits: d,
    }).format(major);
  } catch {
    return `${currencySymbol(currency)}${major}`;
  }
}
