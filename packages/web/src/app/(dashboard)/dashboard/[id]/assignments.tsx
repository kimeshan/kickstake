"use client";

import { useTranslations } from "next-intl";
import { flagEmoji } from "@/lib/flag";
import { titleCaseName } from "@/lib/format";
import type { Assignment, Participant } from "../_components";

interface Props {
  assignments: Assignment[];
  participants: Participant[];
  drawSeed: string | null;
}

export function Assignments({ assignments, participants, drawSeed }: Props) {
  const t = useTranslations("draw");

  // Group teams by participant (and the pot).
  const byPlayer = participants.map((p) => ({
    name: p.displayName,
    teams: assignments.filter((a) => a.participantId === p.id).map((a) => a.team),
  }));
  const potTeams = assignments
    .filter((a) => a.participantId === null)
    .map((a) => a.team);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("doneTitle")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {drawSeed ? t("seedNote", { seed: drawSeed }) : t("manualNote")}
        </span>
      </div>

      <ul className="space-y-2">
        {byPlayer.map((row) => (
          <li
            key={row.name}
            className="rounded-2xl border border-border bg-card/40 px-4 py-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{titleCaseName(row.name)}</span>
              <span className="text-xs text-muted-foreground">
                {t("teamsCount", { count: row.teams.length })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.teams.map((tm) => (
                <span
                  key={tm.id}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-sm"
                >
                  {flagEmoji(tm.flagCode)} {tm.name}
                </span>
              ))}
            </div>
          </li>
        ))}

        {potTeams.length > 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card/20 px-4 py-3">
            <div className="mb-1 text-sm font-semibold text-muted-foreground">
              🫙 {t("yourPot")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {potTeams.map((tm) => (
                <span
                  key={tm.id}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary/40 px-2 py-0.5 text-sm text-muted-foreground"
                >
                  {flagEmoji(tm.flagCode)} {tm.name}
                </span>
              ))}
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
