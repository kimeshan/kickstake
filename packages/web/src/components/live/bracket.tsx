"use client";

import { useTranslations, useFormatter } from "next-intl";
import { titleCaseName } from "@/lib/format";
import { flagEmoji } from "@/lib/flag";
import type { LiveView, LiveMatch, LiveSlot } from "@/lib/live";

/**
 * Knockout bracket, person-first: each tie reads "Ann vs Ben" with the team
 * (and its flag) as the supporting line — the sweepstake is between people.
 * Rounds are columns in one horizontal scroller (snap-scrolled on small
 * screens); later rounds distribute vertically so the tree shape reads.
 */
export function Bracket({ bracket }: { bracket: LiveView["bracket"] }) {
  const t = useTranslations("live");

  if (bracket.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card/50 p-5">
      <h2 className="font-display text-2xl">{t("bracket")}</h2>
      <div className="-mx-5 mt-4 snap-x snap-proximity overflow-x-auto px-5 pb-2 [scroll-padding-inline:1.25rem]">
        <div className="flex min-w-max items-stretch gap-4 lg:gap-6">
          {bracket.map((round) => (
            <div
              key={round.stage}
              className="flex w-56 shrink-0 snap-start flex-col lg:w-60"
            >
              <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t(`stages.${round.stage}`)}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.matches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: LiveMatch }) {
  const t = useTranslations("live");
  const format = useFormatter();
  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        match.status === "in_play"
          ? "border-primary/50 bg-primary/[0.06]"
          : "border-border bg-background/50"
      }`}
    >
      <SlotRow
        slot={match.home}
        score={match.homeScore}
        penalties={match.homePenalties}
        winner={
          match.status === "finished" &&
          match.home !== null &&
          match.winnerTeamId === match.home.teamId
        }
        finished={match.status === "finished"}
      />
      <div className="h-px bg-border" />
      <SlotRow
        slot={match.away}
        score={match.awayScore}
        penalties={match.awayPenalties}
        winner={
          match.status === "finished" &&
          match.away !== null &&
          match.winnerTeamId === match.away.teamId
        }
        finished={match.status === "finished"}
      />
      {match.status === "in_play" ? (
        <div className="bg-primary/10 px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-primary">
          {t("inPlayBadge")}
        </div>
      ) : match.status === "scheduled" && match.kickoffAt ? (
        <div className="border-t border-border/60 px-2.5 py-1 text-center text-[10px] text-muted-foreground">
          {format.dateTime(new Date(match.kickoffAt), {
            day: "numeric",
            month: "short",
          })}
        </div>
      ) : null}
    </div>
  );
}

function SlotRow({
  slot,
  score,
  penalties,
  winner,
  finished,
}: {
  slot: LiveSlot | null;
  score: number | null;
  penalties: number | null;
  winner: boolean;
  finished: boolean;
}) {
  const t = useTranslations("live");

  if (!slot) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground">
        <span className="text-lg leading-none">🏳️</span>
        <span className="flex-1 text-xs">{t("tbd")}</span>
      </div>
    );
  }

  const dimmed = finished && !winner;
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 ${dimmed ? "opacity-50" : ""}`}
    >
      <span className="text-lg leading-none">{flagEmoji(slot.flagCode)}</span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold leading-tight ${
            winner ? "text-primary" : ""
          }`}
        >
          {slot.participantName ? titleCaseName(slot.participantName) : slot.name}
        </span>
        {slot.participantName && (
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {slot.name}
          </span>
        )}
      </span>
      {score !== null && (
        <span
          className={`font-display text-lg tabular-nums ${winner ? "text-primary" : ""}`}
        >
          {score}
          {penalties !== null && (
            <span className="ml-0.5 align-middle text-[10px] text-muted-foreground">
              ({penalties})
            </span>
          )}
        </span>
      )}
    </div>
  );
}
