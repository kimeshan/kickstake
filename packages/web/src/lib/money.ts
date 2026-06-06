export interface CurrencyInfo {
  code: string;
  name: string;
}

/** World currencies for the create wizard. Default is USD. */
export const CURRENCIES: CurrencyInfo[] = [
  // Majors
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
  { code: "DKK", name: "Danish Krone" },
  // Africa
  { code: "ZAR", name: "South African Rand" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "NAD", name: "Namibian Dollar" },
  { code: "ZMW", name: "Zambian Kwacha" },
  // Americas
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "PEN", name: "Peruvian Sol" },
  // Middle East
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "ILS", name: "Israeli New Shekel" },
  { code: "TRY", name: "Turkish Lira" },
  // Europe (non-euro)
  { code: "PLN", name: "Polish Złoty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  // Asia-Pacific
  { code: "KRW", name: "South Korean Won" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "LKR", name: "Sri Lankan Rupee" },
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
