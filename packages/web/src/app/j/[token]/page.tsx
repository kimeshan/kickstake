"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { titleCaseName } from "@/lib/format";
import { flagEmoji } from "@/lib/flag";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";

interface JoinPrize {
  label: string;
  description: string | null;
  ruleType: string;
  amount: number;
  perGroup: boolean;
}

interface DrawEntry {
  team: { name: string; flagCode: string | null; groupLabel: string };
  tier: number | null;
  participantName: string | null;
}

interface JoinView {
  id: string;
  name: string;
  status: "draft" | "open" | "drawn" | "live" | "settled";
  currency: string;
  buyIn: number;
  designedPot: number;
  tournament: { name: string; teamCount: number; groupCount: number } | null;
  prizes: JoinPrize[];
  prizeCount: number;
  participants: { displayName: string }[];
  participantCount: number;
  joinClosed: boolean;
  finalized: boolean;
  draw: DrawEntry[] | null;
}

/** Groups draw entries by player, with the pot (unassigned) last. */
function groupDraw(draw: DrawEntry[], potLabel: string) {
  const map = new Map<
    string,
    { name: string; isPot: boolean; entries: DrawEntry[] }
  >();
  for (const e of draw) {
    const key = e.participantName ?? "__pot__";
    if (!map.has(key))
      map.set(key, {
        name: e.participantName ?? potLabel,
        isPot: e.participantName === null,
        entries: [],
      });
    map.get(key)!.entries.push(e);
  }
  for (const row of map.values())
    // Strongest tier first; extras / pure-random teams (no tier) last.
    row.entries.sort((a, b) => (a.tier ?? Infinity) - (b.tier ?? Infinity));
  return [...map.values()].sort((a, b) => Number(a.isPot) - Number(b.isPot));
}

export default function JoinPage() {
  const t = useTranslations("join");
  const td = useTranslations("draw");
  const pt = useTranslations("prizeTypes");
  const prizeLabel = (p: JoinPrize) =>
    p.ruleType === "custom" ? p.label : pt(`${p.ruleType}.label`);
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

  const open = !!view && !view.joinClosed && view.status !== "settled";
  const groupCount = view?.tournament?.groupCount ?? 12;

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

            {/* Who's in */}
            {view.participants.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("whoIn")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {view.participants.map((p, i) => (
                    <span
                      key={`${p.displayName}-${i}`}
                      className="rounded-full bg-secondary/50 px-2.5 py-1 text-xs"
                    >
                      {titleCaseName(p.displayName)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable prizes */}
            <details className="group mt-3 rounded-2xl bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold">
                <span>🏆 {t("prizes", { count: view.prizeCount })}</span>
                <span className="text-primary transition group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {view.prizes.map((p, i) => (
                  <li
                    key={`${p.ruleType}-${i}`}
                    className="flex items-start justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm">{prizeLabel(p)}</div>
                      {p.perGroup && (
                        <div className="text-[11px] text-primary/80">
                          {t("perGroup", { count: groupCount })}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatMoney(p.amount, view.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            {/* The reveal — once the organiser finalizes */}
            {view.finalized && view.draw && view.draw.length > 0 && (
              <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
                <div className="mb-2 text-sm font-semibold">
                  🎲 {t("drawnTitle")}
                </div>
                <ul className="space-y-2">
                  {groupDraw(view.draw, t("pot")).map((row) => (
                    <li key={row.name}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {row.isPot ? row.name : titleCaseName(row.name)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {row.entries.map((e, i) => (
                          <span
                            key={`${e.team.name}-${i}`}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs"
                          >
                            {flagEmoji(e.team.flagCode)} {e.team.name}
                            {e.tier !== null && (
                              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                                {td("tierBadge", { n: e.tier })}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
