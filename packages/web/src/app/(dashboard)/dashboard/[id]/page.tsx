"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { joinUrl } from "@/lib/constants";
import { StatusBadge, type Sweepstake, type Prize } from "../_components";
import { PrizeEditor } from "./prize-editor";

export default function SweepstakeDetailPage() {
  const t = useTranslations("detail");
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<Sweepstake | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/sweepstakes/${id}`)
      .then((r) => r.json())
      .then(setS)
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        {t("notFound")}{" "}
        <Link href="/dashboard" className="text-primary underline">
          {t("back")}
        </Link>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="grid place-items-center py-16">
        <div className="size-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  const groupCount = s.tournament?.groupCount ?? 12;
  const link = joinUrl(s.joinToken);
  const stats: [string, string][] = [
    [t("pot"), formatMoney(s.designedPot, s.currency)],
    [t("buyIn"), formatMoney(s.buyIn, s.currency)],
    [t("players"), String(s.participants?.length ?? 0)],
  ];

  async function copy() {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6 duration-500 animate-in fade-in">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl">{s.name}</h1>
          <StatusBadge status={s.status} />
        </div>
        <p className="mt-1 text-muted-foreground">{s.tournament?.name}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card/50 p-4 text-center"
          >
            <div className="font-display text-2xl text-primary">{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Share */}
      <div className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-5">
        <div className="text-sm font-semibold">{t("share")}</div>
        <p className="mt-1 text-xs text-muted-foreground">{t("shareHint")}</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-background/60 px-3 py-2 font-mono text-sm text-primary">
            {link}
          </code>
          <button
            onClick={copy}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition active:scale-95"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>

      {/* Prizes — view + manage */}
      <PrizeEditor
        sweepstakeId={s.id}
        currency={s.currency}
        groupCount={groupCount}
        designedPot={s.designedPot}
        prizes={s.prizeCategories ?? []}
        editable={s.status === "draft" || s.status === "open"}
        onSaved={(prizes: Prize[]) => setS({ ...s, prizeCategories: prizes })}
      />

      <div>
        <button
          disabled
          className="w-full cursor-not-allowed rounded-xl bg-primary/40 py-3.5 font-semibold text-primary-foreground"
        >
          ⚡ {t("runDraw")}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t("runDrawHint")}
        </p>
      </div>
    </div>
  );
}
