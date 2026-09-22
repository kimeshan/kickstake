"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChallengeApiError, challengeApi, formatNumber, type Standings } from "@/lib/challenge";
import { useChallenge } from "@/components/challenge/context";
import { Leaderboard } from "@/components/challenge/leaderboard";
import {
  InProgressTag,
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

          <Leaderboard entries={data.entries} weekCount={detail.weekCount} baseline={baseline} />
        </>
      )}
    </div>
  );
}
