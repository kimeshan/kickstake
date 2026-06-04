"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, emailOtp } from "@/lib/auth-client";
import { Logo, GoogleIcon } from "@/components/brand";
import { Input } from "@/components/ui/input";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
    if (error) return setError(error.message ?? "Couldn't send the code.");
    setCode("");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn.emailOtp({ email: email.trim(), otp: code });
    setLoading(false);
    if (error) return setError(error.message ?? "That code didn't work.");
    router.push("/dashboard");
    router.refresh();
  }

  async function google() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/dashboard`,
    });
    if (error) {
      setGoogleLoading(false);
      setError(error.message ?? "Google sign-in isn't available.");
    }
  }

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center duration-700 animate-in fade-in slide-in-from-bottom-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Run the draw. Run the prizes.
            <br />
            Run the bragging rights.
          </p>
        </div>

        <div className="relative rounded-3xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-sm duration-700 animate-in fade-in slide-in-from-bottom-4">
          {/* floodlight glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          />

          {step === "email" ? (
            <>
              <h1 className="font-display text-3xl text-balance">
                Kick off your KickStake
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a 6-digit code. No
                passwords, ever.
              </p>

              <form onSubmit={sendCode} className="mt-6 space-y-3">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send me a code"}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                OR
                <span className="h-px flex-1 bg-border" />
              </div>

              <button
                onClick={google}
                disabled={googleLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-secondary/40 font-medium text-foreground transition hover:bg-secondary/70 active:scale-[.98] disabled:opacity-50"
              >
                <GoogleIcon className="size-5" />
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-balance">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>

              <form onSubmit={verify} className="mt-6 space-y-3">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  maxLength={6}
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
                  {loading ? "Verifying…" : "Verify & continue"}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  ← Use a different email
                </button>
                <button
                  onClick={() => sendCode({ preventDefault() {} } as React.FormEvent)}
                  disabled={loading}
                  className="font-medium text-primary transition hover:opacity-80 disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tracking-only — KickStake never touches your money.
        </p>
      </div>
    </main>
  );
}
