"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { signIn, emailOtp } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import {
  clearPendingSignin,
  pendingSigninSnapshot,
  readPendingSignin,
  savePendingSignin,
  subscribePendingSignin,
} from "@/lib/pending-signin";

/**
 * The email → 6-digit code sign-in steps (Better Auth email OTP). Shared by
 * /login and the challenge invitation page so both use the same auth flow.
 */
export function EmailOtpForm({
  onSignedIn,
  emailTitle,
  emailSub,
}: {
  onSignedIn: () => void;
  emailTitle?: string;
  emailSub?: string;
}) {
  const t = useTranslations("auth");
  // A code we already emailed (survives the tab being discarded while the
  // person fetches it from their mail app). Null on the server, so the email
  // step renders first and the code step appears after hydration.
  const stored = useSyncExternalStore(
    subscribePendingSignin,
    pendingSigninSnapshot,
    () => null,
  );
  const pending = readPendingSignin(stored);
  // Local edits take precedence over the stored value.
  const [draft, setDraft] = useState<{ step: "email" | "code"; email: string } | null>(null);
  const step = draft?.step ?? (pending ? "code" : "email");
  const email = draft?.email ?? pending?.email ?? "";
  const setEmail = (value: string) => setDraft({ step: "email", email: value });
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setLoading(false);
    if (error) return setError(error.message ?? t("errSend"));
    setCode("");
    savePendingSignin(email.trim());
    setDraft({ step: "code", email: email.trim() });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn.emailOtp({ email: email.trim(), otp: code });
    setLoading(false);
    if (error) return setError(error.message ?? t("errVerify"));
    clearPendingSignin();
    setDraft(null);
    onSignedIn();
  }

  return (
    <>
      {step === "email" ? (
        <>
          <h1 className="font-display text-3xl text-balance">
            {emailTitle ?? t("emailTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {emailSub ?? t("emailSub")}
          </p>

          <form onSubmit={sendCode} className="mt-6 space-y-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              aria-label={t("emailPlaceholder")}
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
            >
              {loading ? t("sending") : t("sendCode")}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl text-balance">
            {t("codeTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.rich("codeSub", {
              email,
              strong: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </p>

          <form onSubmit={verify} className="mt-6 space-y-3">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              aria-label={t("codeTitle")}
              placeholder="••••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="text-center font-mono text-2xl tracking-[0.5em]"
            />
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
            >
              {loading ? t("verifying") : t("verify")}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                clearPendingSignin();
                setDraft({ step: "email", email: "" });
                setError(null);
              }}
              className="min-h-11 text-muted-foreground transition hover:text-foreground"
            >
              {t("useDifferent")}
            </button>
            <button
              type="button"
              onClick={() =>
                sendCode({ preventDefault() {} } as React.FormEvent)
              }
              disabled={loading}
              className="min-h-11 font-medium text-primary transition hover:opacity-80 disabled:opacity-50"
            >
              {t("resend")}
            </button>
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </>
  );
}
