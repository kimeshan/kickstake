"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { StatusBadge, type Sweepstake } from "./_components";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [stakes, setStakes] = useState<Sweepstake[] | null>(null);

  useEffect(() => {
    apiFetch("/sweepstakes")
      .then((r) => r.json())
      .then(setStakes)
      .catch(() => setStakes([]));
  }, []);

  return (
    <div className="space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {t("organiser")}
          </p>
          <h1 className="font-display text-4xl">{t("title")}</h1>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          {t("start")}
        </Link>
      </div>

      {stakes === null ? (
        <div className="grid place-items-center py-16">
          <div className="size-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : stakes.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {stakes.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/${s.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/50 px-5 py-4 transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {s.tournament?.name}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="font-display text-xl text-primary">
                    {formatMoney(s.designedPot, s.currency)}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("dashboard");
  const steps = t.raw("steps") as { title: string; desc: string }[];
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="text-5xl">🏆</div>
        <h2 className="mt-4 font-display text-2xl">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
        <Link
          href="/dashboard/new"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          {t("emptyCta")}
        </Link>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("howTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-border bg-card/40 p-4"
            >
              <div className="font-display text-2xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-1 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
