"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EmailOtpForm } from "@/components/email-otp-form";

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  );
}

function LoginInner() {
  const t = useTranslations("auth");
  const tf = useTranslations("footer");
  const router = useRouter();
  // ?next= returns to e.g. a challenge after sign-in. Validated to local,
  // approved paths only; football users keep the /dashboard default.
  const next = safeNext(useSearchParams().get("next"));
  // Already signed in? Don't show the form again — go straight on.
  const { data: session } = useSession();
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, router, next]);

  // Signed in — show a brief redirecting state instead of the form.
  if (session) return <Spinner />;

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher />
      </div>
      <Link
        href="/"
        className="absolute left-5 top-5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        ← {t("backHome")}
      </Link>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center duration-700 animate-in fade-in slide-in-from-bottom-3">
          <Link href="/" aria-label="KickStake home">
            <Logo />
          </Link>
          <p className="text-sm text-muted-foreground">
            {t("tagline1")}
            <br />
            {t("tagline2")}
          </p>
        </div>

        <div className="relative rounded-3xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-sm duration-700 animate-in fade-in slide-in-from-bottom-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          />
          <EmailOtpForm
            onSignedIn={() => {
              router.push(next);
              router.refresh();
            }}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("footer")}
        </p>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          <Link href="/terms" className="underline transition hover:text-foreground">
            {tf("terms")}
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline transition hover:text-foreground">
            {tf("privacy")}
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginInner />
    </Suspense>
  );
}
