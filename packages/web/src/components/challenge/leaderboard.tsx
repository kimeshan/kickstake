"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatNumber, type StandingEntry } from "@/lib/challenge";
import { LevelBadge } from "./ui";

type Mode = "week" | "overall";

const PODIUM = ["🥇", "🥈", "🥉"];

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

/**
 * Everyone in the challenge, ranked for the selected week or by challenge
 * total. Ties share a rank; people with nothing entered are listed, unranked,
 * at the end. Weeks at the baseline sit on every row so volume isn't the
 * only measure of success.
 */
export function Leaderboard({
  entries,
  weekCount,
  baseline,
  initialLimit,
}: {
  entries: StandingEntry[];
  weekCount: number;
  baseline: number;
  /** Compact view: top N plus your own row, with a "Show all" toggle. */
  initialLimit?: number;
}) {
  const t = useTranslations("challenge.leaderboard");
  const tc = useTranslations("challenge");
  const tg = useTranslations("challenge.group");
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("week");
  const [expanded, setExpanded] = useState(false);
  const fmt = (n: number) => formatNumber(n, locale);

  const rankOf = (e: StandingEntry) => (mode === "week" ? e.rank : e.overallRank);
  const valueOf = (e: StandingEntry) => (mode === "week" ? e.minutes : e.totalMinutes);
  // The API orders by the weekly ranking; re-order for the overall view.
  const ordered =
    mode === "week"
      ? entries
      : [...entries].sort((a, b) => {
          const ra = a.overallRank ?? Infinity;
          const rb = b.overallRank ?? Infinity;
          return ra - rb || collator.compare(a.displayName, b.displayName);
        });

  const collapsed = !!initialLimit && !expanded && ordered.length > initialLimit;
  const shown = collapsed ? ordered.filter((e, i) => i < initialLimit! || e.isMe) : ordered;

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={cn(
        "min-h-11 flex-1 rounded-xl text-sm font-semibold transition",
        mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t("title")} className="flex gap-1 rounded-2xl border border-border bg-secondary/40 p-1">
        {tab("week", t("thisWeek"))}
        {tab("overall", t("overall"))}
      </div>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground">
          {tg("empty")}
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-2" aria-label={mode === "week" ? t("thisWeek") : t("overall")}>
          {shown.map((e) => {
            const rank = rankOf(e);
            const value = valueOf(e);
            return (
              <li
                key={e.memberId}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-2xl border p-3",
                  e.isMe ? "border-primary/60 bg-primary/5" : "border-border bg-card/60",
                )}
              >
                <span
                  className="w-10 shrink-0 text-center font-display text-xl text-muted-foreground"
                  aria-label={rank === null ? tc("notEntered") : t("rankLabel", { rank })}
                >
                  {rank === null ? "–" : rank <= 3 ? PODIUM[rank - 1] : tg("rank", { rank })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-semibold" dir="auto">
                      {e.displayName}
                    </span>
                    {e.isMe && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {tc("you")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {mode === "week" &&
                      (e.level !== null && e.medal !== null ? (
                        <LevelBadge level={e.level} medal={e.medal} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{tc("notEntered")}</span>
                      ))}
                    <span className="text-xs text-muted-foreground">
                      {tg("weeksAt", { done: e.successfulWeeks, total: weekCount, count: baseline })}
                    </span>
                    {mode === "week" && e.updateSource === "organiser" && (
                      <span className="text-xs text-muted-foreground">{tc("updatedByOrganiser")}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-end font-display text-2xl">
                  {value === null ? (
                    <span className="font-sans text-xs text-muted-foreground">{mode === "overall" ? tc("notEntered") : ""}</span>
                  ) : (
                    <>
                      {fmt(value)}
                      <span className="ms-1 font-sans text-xs text-muted-foreground">{tc("minUnit")}</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {collapsed && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary"
        >
          {t("showAll", { count: ordered.length })}
        </button>
      )}
    </div>
  );
}
