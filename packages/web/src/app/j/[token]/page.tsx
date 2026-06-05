"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";

interface JoinView {
  id: string;
  name: string;
  status: "draft" | "open" | "drawn" | "live" | "settled";
  currency: string;
  buyIn: number;
  designedPot: number;
  tournament: { name: string; teamCount: number } | null;
  prizeCount: number;
  participantCount: number;
}

export default function JoinPage() {
  const t = useTranslations("join");
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<JoinView | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/j/${token}`)
      .then((r) => r.json())
      .then(setView)
      .catch(() => setMissing(true));
  }, [token]);

  const open = view?.status === "draft" || view?.status === "open";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJoining(true);
    try {
      const r = await apiFetch(`/j/${token}/participants`, {
        method: "POST",
        body: JSON.stringify({ displayName: name.trim(), email: email.trim() }),
      });
      setView(await r.json());
      setJoined(true);
    } catch {
      setError(t("error"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="grain flex min-h-screen flex-col items-center px-5 py-10">
      <div className="absolute right-5 top-5">
        <LanguageSwitcher />
      </div>
      <Link href="/" aria-label="KickStake" className="mb-8">
        <Logo />
      </Link>

      <div className="w-full max-w-sm">
        {missing ? (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-center text-muted-foreground">
            {t("notFound")}
          </p>
        ) : !view ? (
          <div className="grid place-items-center py-16">
            <div className="size-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : (
          <div className="duration-500 animate-in fade-in slide-in-from-bottom-3">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">
                {t("invited")}
              </div>
              <h1 className="mt-1 font-display text-3xl text-balance">
                {view.name}
              </h1>
              {view.tournament && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {view.tournament.name}
                </p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {(
                [
                  [formatMoney(view.buyIn, view.currency), t("buyIn")],
                  [formatMoney(view.designedPot, view.currency), t("pot")],
                  [String(view.participantCount), t("players")],
                ] as [string, string][]
              ).map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-card p-3 text-center">
                  <div className="font-display text-xl text-primary">{v}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {l}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-card p-3 text-center text-sm font-semibold">
              🏆 {t("prizes", { count: view.prizeCount })}
            </div>

            {joined ? (
              <div className="mt-6 rounded-3xl border border-primary/30 bg-primary/[0.07] p-6 text-center">
                <div className="font-display text-2xl">{t("successTitle")}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("successBody")}
                </p>
              </div>
            ) : open ? (
              <form onSubmit={join} className="mt-6 space-y-3">
                <Input
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                />
                <button
                  type="submit"
                  disabled={joining || !name.trim()}
                  className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
                >
                  {joining ? t("joining") : t("joinButton")} →
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {t("noAccount")} · {t("waiting")}
                </p>
              </form>
            ) : (
              <p className="mt-6 rounded-2xl border border-border bg-card/60 p-5 text-center text-sm text-muted-foreground">
                {t("closed")}
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
