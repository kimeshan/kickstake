"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDateRange, formatInstant, formatNumber } from "@/lib/challenge";
import { useChallenge } from "@/components/challenge/context";
import { LevelBadge } from "@/components/challenge/ui";

const WHO_URL = "https://www.who.int/news-room/fact-sheets/detail/physical-activity";

export default function RulesPage() {
  const { detail } = useChallenge();
  const t = useTranslations("challenge.rules");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const fmt = (n: number) => formatNumber(n, locale);
  const tz = detail.timeZone;
  const ladder = detail.ladder;

  const section = "rounded-3xl border border-border bg-card/60 p-4";
  const heading = "mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground";

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">{t("title")}</h1>
      <p className="text-pretty">{t("intro")}</p>
      <p className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 font-semibold text-primary">
        {t("success", { count: detail.baselineMinutes, weeks: detail.weekCount })}
      </p>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className={section} aria-labelledby="ladder-h">
          <h2 id="ladder-h" className={heading}>
            {t("ladderTitle")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-muted-foreground">
                <th scope="col" className="pb-2 text-start font-medium">{t("colMinutes")}</th>
                <th scope="col" className="pb-2 text-start font-medium">{t("colLevel")}</th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((rung, i) => (
                <tr key={rung.level} className="border-t border-border">
                  <td className="py-2 font-semibold">
                    {i === 0
                      ? t("minutesUnder", { count: fmt(ladder[1].minMinutes - 1) })
                      : t("minutesFrom", { count: fmt(rung.minMinutes) })}
                  </td>
                  <td className="py-2">
                    <LevelBadge level={rung.level} medal={rung.medal} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className={section} aria-labelledby="dates-h">
            <h2 id="dates-h" className={heading}>
              {t("datesTitle")}
            </h2>
            <ul className="space-y-2 text-sm">
              {detail.timing.weeks.map((w) => (
                <li key={w.weekNumber} className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold">
                    {tc("weekRange", { n: w.weekNumber, range: formatDateRange(w.startDate, w.endDate, locale) })}
                  </span>
                  <span className="text-muted-foreground">
                    {t("reportBy", { time: formatInstant(w.reportingDueAt, locale, tz) })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("finalCutoff", { time: formatInstant(detail.timing.finalEditCutoff, locale, tz) })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{tc("timeZoneNote", { tz })}</p>
          </section>

          <section className={section} aria-labelledby="count-h">
            <h2 id="count-h" className={heading}>
              {t("countTitle")}
            </h2>
            <ul className="list-disc space-y-1.5 ps-5 text-sm">
              {(["count1", "count2", "count3", "count4", "count5"] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </section>

          <section className={section} aria-labelledby="care-h">
            <h2 id="care-h" className={heading}>
              {t("careTitle")}
            </h2>
            <ul className="list-disc space-y-1.5 ps-5 text-sm">
              {(["care1", "care2", "care3"] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("healthNote")}{" "}
              <a href={WHO_URL} target="_blank" rel="noopener noreferrer" className="underline">
                {t("whoLink")}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
