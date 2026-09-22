"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  ChallengeApiError,
  challengeApi,
  formatDate,
  formatDateRange,
  formatInstant,
  formatNumber,
  type MyProgress,
  type MyWeek,
} from "@/lib/challenge";
import { useChallenge } from "@/components/challenge/context";
import { UpdateDialog } from "@/components/challenge/update-dialog";
import {
  BaselineBar,
  InProgressTag,
  ResultBadge,
  Spinner,
  StateCard,
  WeekPicker,
  useRefreshOnFocus,
  useReload,
} from "@/components/challenge/ui";

export default function ProgressPage() {
  const { detail } = useChallenge();
  const t = useTranslations("challenge.progress");
  const tc = useTranslations("challenge");
  if (!detail.role.isMember) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-display text-3xl">{t("organiserOnlyTitle")}</h1>
        <StateCard
          message={t("organiserOnlyHint")}
          action={{ label: tc("join.openManage"), href: `/challenges/${detail.id}/manage` }}
        />
      </div>
    );
  }
  return <MemberProgress />;
}

function MemberProgress() {
  const { detail, refresh } = useChallenge();
  const t = useTranslations("challenge.progress");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const picked = useRef(false);
  const [editing, setEditing] = useState<MyWeek | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const apply = useCallback((p: MyProgress) => {
    setProgress(p);
    setLoadFailed(false);
    // Follow the server's current week (e.g. after Monday midnight) unless
    // the person chose a week themselves.
    if (!picked.current) setSelected(p.timing.defaultWeek);
  }, []);

  const [nonce, load] = useReload();

  useEffect(() => {
    let live = true;
    challengeApi<MyProgress>(`/${detail.id}/me`)
      .then((p) => live && apply(p))
      .catch((e) => {
        if (!live) return;
        // Membership/session problems are handled by the layout's states.
        if (e instanceof ChallengeApiError && (e.status === 401 || e.status === 403)) return refresh();
        setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [detail.id, nonce, apply, refresh]);
  useRefreshOnFocus(load);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!progress) {
    return loadFailed ? (
      <StateCard message={tc("states.error")} action={{ label: tc("retry"), onClick: load }} />
    ) : (
      <Spinner />
    );
  }

  const { timing, weeks, summary } = progress;
  const week = weeks[(selected ?? timing.defaultWeek) - 1];
  const tz = detail.timeZone;
  const baseline = detail.baselineMinutes;
  const result = week.result;
  const fmt = (n: number) => formatNumber(n, locale);

  const phaseNote =
    timing.phase === "upcoming"
      ? t("upcoming", { date: formatDate(timing.weeks[0].startDate, locale, true) })
      : timing.phase === "reporting"
        ? t("reporting", { time: formatInstant(timing.finalEditCutoff, locale, tz) })
        : timing.phase === "finished"
          ? t("finished", { time: formatInstant(timing.finalEditCutoff, locale, tz) })
          : null;

  const disabledReason =
    week.status === "future"
      ? t("futureWeek")
      : !timing.beforeCutoff
        ? t("closedWeek")
        : progress.participantEditingLocked
          ? t("locked")
          : null;

  const allDone = summary.successfulWeeks === summary.weekCount;

  return (
    <div className="space-y-5">
      <div aria-live="polite" className="sr-only">
        {toast}
      </div>
      {toast && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
          {toast}
        </div>
      )}
      {phaseNote && (
        <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm">{phaseNote}</p>
      )}
      {allDone && (
        <p className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-center font-semibold text-primary">
          {t("allWeeks", { done: summary.successfulWeeks, total: summary.weekCount, count: baseline })}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section className="space-y-4 rounded-3xl border border-border bg-card/80 p-5" aria-labelledby="week-heading">
          <h1 id="week-heading" className="sr-only">
            {tc("weekRange", { n: week.weekNumber, range: formatDateRange(week.startDate, week.endDate, locale) })}
          </h1>
          <WeekPicker
            weeks={weeks}
            value={week.weekNumber}
            onChange={(n) => {
              picked.current = true;
              setSelected(n);
            }}
          />

          <div className="text-center">
            {week.inProgress && (
              <div className="mb-2 flex justify-center">
                <InProgressTag />
              </div>
            )}
            {week.status === "future" ? (
              <p className="py-6 text-lg text-muted-foreground">
                {tc("startsOn", { date: formatDate(week.startDate, locale) })}
              </p>
            ) : week.minutes === null ? (
              <p className="py-6 text-xl font-semibold text-muted-foreground">{t("noTotal")}</p>
            ) : (
              <p className="py-2">
                <span className="font-display text-7xl text-foreground">{fmt(week.minutes)}</span>
                <span className="ms-2 text-lg text-muted-foreground">{tc("minUnit")}</span>
              </p>
            )}
            {result && (
              <div className="flex justify-center">
                <ResultBadge result={result} />
              </div>
            )}
          </div>

          {result && (
            <div className="space-y-2">
              <BaselineBar
                percent={result.baselinePercent}
                label={
                  result.reachedBaseline
                    ? t("baselineReached")
                    : t("baseline", { percent: result.baselinePercent, count: baseline })
                }
              />
              <p className="text-center text-sm font-semibold">
                {result.minutesToNext === null
                  ? t("highest")
                  : t("toNext", { count: fmt(result.minutesToNext), level: result.nextLevel! })}
              </p>
            </div>
          )}

          {(week.updatedAt || week.updateSource === "organiser") && (
            <p className="text-center text-xs text-muted-foreground">
              {week.updateSource === "organiser" && <span className="font-semibold">{tc("updatedByOrganiser")} · </span>}
              {week.updatedAt && tc("savedAt", { time: formatInstant(week.updatedAt, locale, tz) })}
            </p>
          )}

          {week.status === "elapsed" && week.minutes === null && timing.beforeCutoff && (
            <p className="text-center text-sm text-muted-foreground">
              {t("reminder", { n: week.weekNumber, time: formatInstant(week.reportingDueAt, locale, tz) })}
            </p>
          )}

          <button
            type="button"
            onClick={() => setEditing(week)}
            disabled={!week.editable}
            className="h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-[0_0_24px_rgba(198,241,53,0.25)] transition active:scale-[.98] disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
          >
            {t("update")}
          </button>
          {!week.editable && disabledReason && (
            <p className="text-center text-sm text-muted-foreground">{disabledReason}</p>
          )}
        </section>

        <div className="mt-5 space-y-5 lg:mt-0">
          <section aria-labelledby="weeks-heading">
            <h2 id="weeks-heading" className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t("weeksTitle")}
            </h2>
            <ul className="grid grid-cols-2 gap-3 [&>li]:min-w-0">
              {weeks.map((w) => (
                <li key={w.weekNumber}>
                  <button
                    type="button"
                    onClick={() => {
                      picked.current = true;
                      setSelected(w.weekNumber);
                    }}
                    aria-pressed={w.weekNumber === week.weekNumber}
                    className={cn(
                      "flex min-h-24 w-full flex-col items-start gap-1 rounded-2xl border p-3 text-start transition",
                      w.weekNumber === week.weekNumber
                        ? "border-primary/60 bg-primary/5"
                        : "border-border bg-card/60 hover:bg-card",
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {tc("week", { n: w.weekNumber })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateRange(w.startDate, w.endDate, locale)}
                    </span>
                    {w.status === "future" ? (
                      <span className="text-sm text-muted-foreground">
                        {tc("startsOn", { date: formatDate(w.startDate, locale) })}
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold">
                          {w.minutes === null ? tc("notEntered") : tc("min", { count: fmt(w.minutes) })}
                        </span>
                        {w.result && <ResultBadge result={w.result} size="sm" />}
                        {w.inProgress && <InProgressTag />}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="summary-heading" className="rounded-3xl border border-border bg-card/60 p-4">
            <h2 id="summary-heading" className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t("summaryTitle")}
            </h2>
            <dl className="grid grid-cols-2 gap-3">
              {[
                [t("total"), summary.totalMinutes === null ? t("none") : tc("min", { count: fmt(summary.totalMinutes) })],
                [t("bestWeek"), summary.bestWeek === null ? t("none") : tc("min", { count: fmt(summary.bestWeek) })],
                [t("successfulWeeks", { count: baseline }), t("successfulOf", { done: summary.successfulWeeks, total: summary.weekCount })],
                [t("bestStreak"), t("streakWeeks", { count: summary.bestStreak })],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-secondary/50 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-lg font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="text-center text-xs text-muted-foreground">
            {tc("timeZoneNote", { tz })} ·{" "}
            <Link href={`/challenges/${detail.id}/rules`} className="underline">
              {tc("nav.rules")}
            </Link>
          </p>
        </div>
      </div>

      {editing && (
        <UpdateDialog
          challengeId={detail.id}
          week={editing}
          timeZone={tz}
          onClose={() => setEditing(null)}
          onSaved={(p, minutes) => {
            setEditing(null);
            if (p) apply(p);
            else load();
            const range = formatDateRange(editing.startDate, editing.endDate, locale);
            setToast(
              minutes === null
                ? t("clearedToast", { range })
                : t("savedToast", { minutes: tc("minutes", { count: minutes }), range }),
            );
          }}
        />
      )}
    </div>
  );
}
