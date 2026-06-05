export const locales = [
  "en",
  "es",
  "fr",
  "zh",
  "hi",
  "ar",
  "pt",
  "ru",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Right-to-left locales — drive the <html dir> attribute.
export const rtlLocales: Locale[] = ["ar"];

// Native names for the language switcher.
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  zh: "中文",
  hi: "हिन्दी",
  ar: "العربية",
  pt: "Português",
  ru: "Русский",
};
