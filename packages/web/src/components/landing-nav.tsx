"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";

export function LandingNav() {
  const t = useTranslations("nav");
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition hover:text-foreground">
            {t("howItWorks")}
          </a>
          <a href="#features" className="transition hover:text-foreground">
            {t("features")}
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            {t("faq")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-[.97]"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-[.97]"
              >
                {t("startFree")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
