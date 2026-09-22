"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/auth-client";
import { KMark } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";

export interface MenuAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** Compact challenge header: brand, title and a small account menu. */
export function ChallengeHeader({
  title,
  homeHref = "/challenges",
  actions = [],
  signedIn = true,
}: {
  title?: string;
  homeHref?: string;
  actions?: MenuAction[];
  signedIn?: boolean;
}) {
  const t = useTranslations("challenge");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex min-h-11 w-full items-center rounded-lg px-3 text-start text-sm text-foreground hover:bg-secondary";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={t("brand")}>
          <KMark className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary">{t("brand")}</div>
            {title && <div className="truncate font-semibold leading-tight">{title}</div>}
          </div>
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={open ? t("menu.close") : t("menu.open")}
            className="grid size-11 place-items-center rounded-xl border border-border text-foreground hover:bg-secondary"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {open && (
            <div
              role="menu"
              className="absolute end-0 top-12 z-40 w-64 rounded-2xl border border-border bg-popover p-2 shadow-2xl"
            >
              {actions.map((a) =>
                a.href ? (
                  <Link key={a.label} href={a.href} role="menuitem" className={item} onClick={() => setOpen(false)}>
                    {a.label}
                  </Link>
                ) : (
                  <button
                    key={a.label}
                    type="button"
                    role="menuitem"
                    className={item}
                    onClick={() => {
                      setOpen(false);
                      a.onClick?.();
                    }}
                  >
                    {a.label}
                  </button>
                ),
              )}
              <div className="px-3 py-2">
                <LanguageSwitcher />
              </div>
              {signedIn && (
                <button
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() =>
                    signOut({ fetchOptions: { onSuccess: () => router.replace("/challenges") } })
                  }
                >
                  {t("menu.signOut")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
