"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatNumber, MEDAL_STYLES, type Rung } from "@/lib/challenge";

/**
 * The level scale with the selected week's position marked: rungs already
 * reached are lit, the current level is outlined, the baseline is labelled.
 */
export function LevelLadder({
  ladder,
  minutes,
  baseline,
}: {
  ladder: Rung[];
  minutes: number | null;
  baseline: number;
}) {
  const t = useTranslations("challenge.ladder");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const current =
    minutes === null ? null : [...ladder].reverse().find((r) => minutes >= r.minMinutes)?.level ?? 0;

  return (
    <div>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={t("title")}>
        {ladder.map((r, i) => {
          const reached = minutes !== null && minutes >= r.minMinutes;
          const isCurrent = current === r.level;
          const range =
            i === 0
              ? `0–${formatNumber(ladder[1].minMinutes - 1, locale)}`
              : `${formatNumber(r.minMinutes, locale)}+`;
          return (
            <li
              key={r.level}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 text-center",
                reached ? MEDAL_STYLES[r.medal] : "border-border bg-card/40 text-muted-foreground",
                isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              <span className="text-xs font-bold">{tc("level", { level: r.level })}</span>
              <span className="font-display text-lg leading-tight">{range}</span>
              <span className="text-[11px]">{r.level === 0 ? tc("building") : tc(`medal.${r.medal}`)}</span>
              {r.minMinutes === baseline && (
                <span className="mt-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {t("baseline")}
                </span>
              )}
              {isCurrent && <span className="sr-only">{t("youAreHere")}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {minutes === null ? t("hintEmpty", { count: baseline }) : t("hint")}
      </p>
    </div>
  );
}
