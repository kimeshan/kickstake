"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { titleCaseName } from "@/lib/format";
import { flagEmoji } from "@/lib/flag";
import type { LiveView, LivePrize } from "@/lib/live";

export interface LiveTeamOption {
  teamId: string;
  name: string;
  flagCode: string | null;
  groupLabel: string;
}

/**
 * Live prize money: who has won what so far, what's still in play, and the
 * outcome of every prize. Shown once results exist (organiser dashboard) or
 * once the draw is finalized (participant page).
 *
 * `sweepstakeId`/`teamOptions`/`onChange` are only passed by the organiser
 * dashboard — the public join page renders read-only, so paid-out toggles and
 * the manual "declare winner" override never show there.
 */
export function LivePanel({
  live,
  currency,
  onRefresh,
  sweepstakeId,
  editable = false,
  teamOptions,
  onChange,
}: {
  live: LiveView;
  currency: string;
  onRefresh?: () => Promise<void>;
  sweepstakeId?: string;
  editable?: boolean;
  teamOptions?: LiveTeamOption[];
  onChange?: (s: unknown) => void;
}) {
  const t = useTranslations("live");
  const pt = useTranslations("prizeTypes");
  const format = useFormatter();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState<string | null>(null);
  const [pendingTeam, setPendingTeam] = useState("");

  const prizeLabel = (p: LivePrize) =>
    p.ruleType === "custom" ? p.label : pt(`${p.ruleType}.label`);
  const decidedCount = live.prizes.filter((p) => p.decided).length;
  const canManage = editable && !!sweepstakeId && !!onChange;

  async function refresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function togglePaid(resultId: string, paidOut: boolean) {
    if (!sweepstakeId || !onChange) return;
    setBusy(resultId);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/prize-results/${resultId}`, {
        method: "PATCH",
        body: JSON.stringify({ paidOut }),
      });
      onChange(await r.json());
    } finally {
      setBusy(null);
    }
  }

  async function declareWinner(categoryId: string, groupLabel: string | null, key: string) {
    if (!sweepstakeId || !onChange || !pendingTeam) return;
    setBusy(key);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/prizes/${categoryId}/result`, {
        method: "PATCH",
        body: JSON.stringify({ groupLabel, winningTeamId: pendingTeam }),
      });
      onChange(await r.json());
      setDeclaring(null);
      setPendingTeam("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <h2 className="font-display text-2xl">{t("title")}</h2>
        </div>
        <div className="flex items-center gap-3">
          {live.updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              {t("updated", {
                date: format.dateTime(new Date(live.updatedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={refresh}
              disabled={refreshing}
              className="rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {refreshing ? t("refreshing") : t("refresh")}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <ul className="mt-4 space-y-1.5">
        {live.leaderboard.map((row, i) => (
          <li
            key={row.participantId}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
              i === 0 && row.won > 0
                ? "border border-primary/30 bg-primary/10"
                : "bg-card/60"
            }`}
          >
            <span className="w-5 shrink-0 text-center font-display text-sm text-muted-foreground">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {titleCaseName(row.displayName)}
            </span>
            {row.inPlay > 0 && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {t("inPlay", { amount: formatMoney(row.inPlay, currency) })}
              </span>
            )}
            <span className="shrink-0 font-display text-lg text-primary">
              {formatMoney(row.won, currency)}
            </span>
          </li>
        ))}
        {live.potWon > 0 && (
          <li className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2">
            <span className="w-5" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {t("potRow")}
            </span>
            <span className="shrink-0 font-display text-lg text-muted-foreground">
              {formatMoney(live.potWon, currency)}
            </span>
          </li>
        )}
      </ul>

      {/* Every prize outcome */}
      <details className="group mt-4 rounded-2xl bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold">
          <span>
            🏆 {t("prizeResults", { decided: decidedCount, total: live.prizes.length })}
          </span>
          <span className="text-primary transition group-open:rotate-180">⌄</span>
        </summary>
        <ul className="divide-y divide-border border-t border-border">
          {live.prizes.map((p, i) => {
            const key = `${p.categoryId}:${p.groupLabel ?? ""}`;
            const options = p.groupLabel
              ? (teamOptions ?? []).filter((o) => o.groupLabel === p.groupLabel)
              : (teamOptions ?? []);
            return (
              <li
                key={`${p.categoryId}-${p.groupLabel ?? i}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {prizeLabel(p)}
                    {p.groupLabel && (
                      <span className="ml-1.5 rounded-full bg-secondary/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {t("group", { label: p.groupLabel })}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs">
                    {p.decided && p.winner ? (
                      <span className="text-primary">
                        {flagEmoji(p.winner.flagCode)} {p.winner.name}
                        {p.winner.participantName && (
                          <span className="font-semibold">
                            {" "}
                            — {titleCaseName(p.winner.participantName)}
                          </span>
                        )}
                      </span>
                    ) : p.leader ? (
                      <span className="text-muted-foreground">
                        {t("leader")}:{" "}
                        <span className="text-foreground">
                          {flagEmoji(p.leader.flagCode)}{" "}
                          {p.leader.playerName ?? p.leader.name}
                          {p.leader.playerName && p.leader.name && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({p.leader.name})
                            </span>
                          )}
                        </span>
                        {p.leader.participantName && (
                          <span className="font-semibold text-foreground">
                            {" "}
                            — {titleCaseName(p.leader.participantName)}
                          </span>
                        )}{" "}
                        · {t(`stat.${p.leader.statKey}`, { count: p.leader.statValue })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {p.computable ? t("inPlayBadge") : t("manualBadge")}
                      </span>
                    )}
                  </div>

                  {canManage && !p.decided && (
                    declaring === key ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <select
                          value={pendingTeam}
                          onChange={(e) => setPendingTeam(e.target.value)}
                          aria-label={t("declareWinnerPlaceholder")}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground outline-none"
                        >
                          <option value="" className="bg-card">
                            {t("declareWinnerPlaceholder")}
                          </option>
                          {options.map((o) => (
                            <option key={o.teamId} value={o.teamId} className="bg-card">
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => declareWinner(p.categoryId, p.groupLabel, key)}
                          disabled={!pendingTeam || busy === key}
                          className="shrink-0 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {t("declareWinnerConfirm")}
                        </button>
                        <button
                          onClick={() => {
                            setDeclaring(null);
                            setPendingTeam("");
                          }}
                          className="shrink-0 rounded-lg px-1.5 text-xs text-muted-foreground"
                        >
                          {t("declareWinnerCancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setDeclaring(key);
                          setPendingTeam("");
                        }}
                        className="mt-1 text-xs font-semibold text-primary transition hover:opacity-80"
                      >
                        {t("declareWinner")}
                      </button>
                    )
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`text-sm font-semibold ${
                      p.decided ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {formatMoney(p.amount, currency)}
                  </span>
                  {canManage && p.decided && p.resultId && (
                    <button
                      onClick={() => togglePaid(p.resultId!, !p.paidOut)}
                      disabled={busy === p.resultId}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        p.paidOut
                          ? "bg-primary/15 text-primary"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {p.paidOut ? t("paidOut") : t("markPaid")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
