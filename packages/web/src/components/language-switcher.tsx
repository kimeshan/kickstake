"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";
import { useRouter } from "next/navigation";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Locale;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <Globe className="size-4" aria-hidden />
      <select
        aria-label="Language"
        value={locale}
        onChange={onChange}
        disabled={isPending}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-foreground outline-none disabled:opacity-50"
      >
        {locales.map((l) => (
          <option key={l} value={l} className="bg-card text-foreground">
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
