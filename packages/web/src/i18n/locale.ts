"use server";

import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

const COOKIE = "NEXT_LOCALE";
// 1 year
const MAX_AGE = 60 * 60 * 24 * 365;

export async function getUserLocale(): Promise<Locale> {
  const value = (await cookies()).get(COOKIE)?.value;
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE, locale, { maxAge: MAX_AGE, path: "/" });
}
