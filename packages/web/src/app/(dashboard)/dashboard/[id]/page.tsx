"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney, CURRENCIES } from "@/lib/money";
import { joinUrl } from "@/lib/constants";
import { StatusBadge, type Sweepstake, type Prize } from "../_components";
import { PrizeEditor } from "./prize-editor";
import { ParticipantsManager } from "./participants-manager";
import { DrawPanel } from "./draw-panel";
import { Assignments } from "./assignments";

export default function SweepstakeDetailPage() {
  const t = useTranslations("detail");
  const td = useTranslations("draw");
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<Sweepstake | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redrawing, setRedrawing] = useState(false);

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
  // No lock-in: everything stays editable until the sweepstake is settled.
  const editable = s.status !== "settled";
  const drawn = s.status === "drawn" || s.status === "live" || s.status === "settled";
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

  async function patch(body: Record<string, unknown>) {
    const r = await apiFetch(`/sweepstakes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setS(await r.json());
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
        <div className="mt-1 flex items-center gap-3">
          <p className="text-muted-foreground">{s.tournament?.name}</p>
          {editable && (
            <select
              value={s.currency}
              onChange={(e) => patch({ currency: e.target.value })}
              aria-label={t("currency")}
              className="rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground outline-none focus-visible:border-primary/60"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-card">
                  {c.code}
                </option>
              ))}
            </select>
          )}
        </div>
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
        {editable && (
          <div className="mt-3 flex items-center justify-between border-t border-primary/15 pt-3">
            <span className="text-xs text-muted-foreground">
              {s.joinClosed ? t("joiningClosed") : t("joiningOpen")}
            </span>
            <button
              onClick={() => patch({ joinClosed: !s.joinClosed })}
              className="text-xs font-semibold text-primary transition hover:opacity-80"
            >
              {s.joinClosed ? t("openJoining") : t("closeJoining")}
            </button>
          </div>
        )}
      </div>

      {/* Players */}
      <ParticipantsManager
        sweepstakeId={s.id}
        currency={s.currency}
        participants={s.participants ?? []}
        editable={editable}
        onChange={setS}
      />

      {/* Draw / reveal — re-runnable any time until settled */}
      {drawn && !redrawing ? (
        <div className="space-y-3">
          <Assignments
            assignments={s.assignments ?? []}
            participants={s.participants ?? []}
            drawSeed={s.drawSeed}
          />
          {editable && (
            <div className="space-y-2">
              <button
                onClick={() => patch({ finalized: !s.finalized })}
                className={`w-full rounded-xl py-3 font-semibold transition active:scale-[.98] ${
                  s.finalized
                    ? "border border-primary/40 bg-primary/10 text-primary"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {s.finalized ? `✓ ${t("finalized")}` : t("finalize")}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {t("finalizeHint")}
              </p>
              <button
                onClick={() => setRedrawing(true)}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {td("redraw")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <DrawPanel
          sweepstakeId={s.id}
          tournamentId={s.tournament?.id ?? ""}
          participants={s.participants ?? []}
          onDrawn={(ns) => {
            setS(ns);
            setRedrawing(false);
          }}
        />
      )}

      {/* Prizes — view + manage */}
      <PrizeEditor
        sweepstakeId={s.id}
        currency={s.currency}
        groupCount={groupCount}
        designedPot={s.designedPot}
        prizes={s.prizeCategories ?? []}
        editable={editable}
        onSaved={(prizes: Prize[]) => setS({ ...s, prizeCategories: prizes })}
      />
    </div>
  );
}
