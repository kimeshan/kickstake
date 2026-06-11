"use client";

import { useTranslations } from "next-intl";
import { flagEmoji } from "@/lib/flag";
import { titleCaseName } from "@/lib/format";
import type { Assignment, Participant } from "../_components";

interface Props {
  assignments: Assignment[];
  participants: Participant[];
  drawSeed: string | null;
  drawTiering: "none" | "auto";
}

// Strongest tier first; extras / pure-random teams (no tier) last.
const byTier = (a: Assignment, b: Assignment) =>
  (a.tier ?? Infinity) - (b.tier ?? Infinity);

function TeamChip({ a, muted }: { a: Assignment; muted?: boolean }) {
  const t = useTranslations("draw");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm ${
        muted ? "bg-secondary/40 text-muted-foreground" : "bg-secondary/50"
      }`}
    >
      {flagEmoji(a.team.flagCode)} {a.team.name}
      {a.tier !== null && (
        <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
          {t("tierBadge", { n: a.tier })}
        </span>
      )}
    </span>
  );
}

export function Assignments({
  assignments,
  participants,
  drawSeed,
  drawTiering,
}: Props) {
  const t = useTranslations("draw");

  // Group teams by participant (and the pot).
  const byPlayer = participants.map((p) => ({
    name: p.displayName,
    teams: assignments.filter((a) => a.participantId === p.id).sort(byTier),
  }));
  const potTeams = assignments
    .filter((a) => a.participantId === null)
    .sort(byTier);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("doneTitle")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {drawSeed
            ? (drawTiering === "auto" ? `${t("tieredNote")} · ` : "") +
              t("seedNote", { seed: drawSeed })
            : t("manualNote")}
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
              {row.teams.map((a) => (
                <TeamChip key={a.team.id} a={a} />
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
              {potTeams.map((a) => (
                <TeamChip key={a.team.id} a={a} muted />
              ))}
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
