"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import {
  formatMoney,
  toMinor,
  currencySymbol,
  CURRENCIES,
  DEFAULT_CURRENCY,
} from "@/lib/money";
import { Input } from "@/components/ui/input";

interface Tournament {
  id: string;
  name: string;
  year: number;
  teamCount: number;
  groupCount: number;
}

export default function NewSweepstakePage() {
  const t = useTranslations("create");
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [buyIn, setBuyIn] = useState(10);
  const [players, setPlayers] = useState(12);
  const [donation, setDonation] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/tournaments")
      .then((r) => r.json())
      .then((ts: Tournament[]) => {
        setTournaments(ts);
        if (ts[0]) setTournamentId(ts[0].id);
      })
      .catch(() => setError(t("error")));
  }, [t]);

  const pot =
    toMinor(buyIn, currency) * (players || 0) + toMinor(donation, currency);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/sweepstakes", {
        method: "POST",
        body: JSON.stringify({
          tournamentId,
          name: name.trim(),
          currency,
          buyIn: toMinor(buyIn, currency),
          donation: toMinor(donation, currency),
          expectedParticipants: players,
        }),
      });
      const created = await res.json();
      router.push(`/dashboard/${created.id}`);
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 duration-500 animate-in fade-in">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← KickStake
        </Link>
        <h1 className="mt-2 font-display text-4xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border border-border bg-card/50 p-6"
      >
        <Field label={t("tournament")}>
          <select
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            required
            className="h-12 w-full rounded-xl border border-input bg-secondary/40 px-4 text-foreground outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            {tournaments.map((tn) => (
              <option key={tn.id} value={tn.id} className="bg-card">
                {tn.name} · {tn.teamCount} teams
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("name")}>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </Field>

        <Field label={t("currency")}>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-secondary/40 px-4 text-foreground outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-card">
                {c.code} · {c.name} ({currencySymbol(c.code)})
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("buyIn")}>
            <MoneyInput
              symbol={currencySymbol(currency)}
              value={buyIn}
              onChange={setBuyIn}
            />
          </Field>
          <Field label={t("players")}>
            <Input
              type="number"
              min={2}
              inputMode="numeric"
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label={t("donation")}>
          <MoneyInput
            symbol={currencySymbol(currency)}
            value={donation}
            onChange={setDonation}
          />
        </Field>

        <div className="rounded-2xl bg-secondary/40 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{t("pot")}</span>
            <span className="font-display text-3xl text-primary">
              {formatMoney(pot, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("potHint")}</p>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-border px-5 py-3 font-medium text-muted-foreground transition hover:text-foreground"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={submitting || !tournamentId || !name.trim() || pot <= 0}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
          >
            {submitting ? t("creating") : t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

function MoneyInput({
  symbol,
  value,
  onChange,
}: {
  symbol: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
        {symbol}
      </span>
      <Input
        type="number"
        min={0}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pl-9"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
