"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ChallengeApiError, challengeApi, formatNumber, type Standings } from "@/lib/challenge";
import { useChallenge } from "@/components/challenge/context";
import {
  InProgressTag,
  LevelBadge,
  Spinner,
  StateCard,
  WeekPicker,
  useRefreshOnFocus,
  useReload,
} from "@/components/challenge/ui";

export default function GroupPage() {
  const { detail, refresh } = useChallenge();
  const t = useTranslations("challenge.group");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const [week, setWeek] = useState(detail.timing.defaultWeek);
  const picked = useRef(false);
  const [data, setData] = useState<Standings | null>(null);
  const [failed, setFailed] = useState(false);

  const [nonce, load] = useReload();

  useEffect(() => {
    let live = true;
    challengeApi<Standings>(`/${detail.id}/standings?week=${week}`)
      .then((s) => {
        if (!live) return;
        // Follow the server's current week unless the person picked one.
        if (!picked.current && s.timing.defaultWeek !== week) return setWeek(s.timing.defaultWeek);
        setData(s);
        setFailed(false);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ChallengeApiError && (e.status === 401 || e.status === 403)) return refresh();
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [detail.id, week, nonce, refresh]);
  useRefreshOnFocus(load);

  const fmt = (n: number) => formatNumber(n, locale);
  const baseline = detail.baselineMinutes;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">{t("title")}</h1>
      <WeekPicker
        weeks={detail.timing.weeks}
        value={week}
        onChange={(n) => {
          picked.current = true;
          setWeek(n);
        }}
      />

      {!data || data.week.weekNumber !== week ? (
        failed ? (
          <StateCard message={tc("states.error")} action={{ label: tc("retry"), onClick: load }} />
        ) : (
          <Spinner />
        )
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <p className="text-xs text-muted-foreground">{t("groupMinutes")}</p>
              <p className="mt-1 font-display text-2xl">{fmt(data.aggregates.groupMinutes)}</p>
            </div>
            <p className="rounded-2xl border border-border bg-card/60 p-3 text-sm font-semibold">
              {t("atBaseline", {
                done: data.aggregates.atBaselineCount,
                total: data.aggregates.activeCount,
                count: baseline,
              })}
            </p>
            <p className="rounded-2xl border border-border bg-card/60 p-3 text-sm font-semibold">
              {t("notEnteredCount", { count: data.aggregates.notEnteredCount })}
            </p>
          </div>

          {data.inProgress && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <InProgressTag /> {t("provisional")}
            </p>
          )}

          {data.entries.length === 0 ? (
            <StateCard message={t("empty")} />
          ) : (
            <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {data.entries.map((e) => (
                <li
                  key={e.memberId}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-2xl border p-3",
                    e.isMe ? "border-primary/60 bg-primary/5" : "border-border bg-card/60",
                  )}
                >
                  <span className="w-10 shrink-0 text-center font-display text-xl text-muted-foreground">
                    {e.rank === null ? "–" : t("rank", { rank: e.rank })}
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
                      {e.level !== null && e.medal !== null ? (
                        <LevelBadge level={e.level} medal={e.medal} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{tc("notEntered")}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {t("weeksAt", { done: e.successfulWeeks, total: detail.weekCount, count: baseline })}
                      </span>
                      {e.updateSource === "organiser" && (
                        <span className="text-xs text-muted-foreground">{tc("updatedByOrganiser")}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-end font-display text-2xl">
                    {e.minutes === null ? "" : fmt(e.minutes)}
                    {e.minutes !== null && (
                      <span className="ms-1 text-xs font-sans text-muted-foreground">{tc("minUnit")}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
