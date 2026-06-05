"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { flagEmoji } from "@/lib/flag";
import type { Participant, Sweepstake, Team } from "../_components";

interface Props {
  sweepstakeId: string;
  tournamentId: string;
  participants: Participant[];
  onDrawn: (s: Sweepstake) => void;
}

export function DrawPanel({
  sweepstakeId,
  tournamentId,
  participants,
  onDrawn,
}: Props) {
  const t = useTranslations("draw");
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({}); // teamId -> participantId | "pot"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughPlayers = participants.length >= 2;

  async function randomize() {
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/draw`, {
        method: "POST",
        body: JSON.stringify({ mode: "random" }),
      });
      onDrawn(await r.json());
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  async function openManual() {
    setError(null);
    const r = await apiFetch(`/tournaments/${tournamentId}/teams`);
    const ts: Team[] = await r.json();
    setTeams(ts);
    setPicks(Object.fromEntries(ts.map((t) => [t.id, "pot"])));
    setMode("manual");
  }

  async function submitManual() {
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/draw`, {
        method: "POST",
        body: JSON.stringify({
          mode: "manual",
          assignments: teams.map((tm) => ({
            teamId: tm.id,
            participantId: picks[tm.id] === "pot" ? null : picks[tm.id],
          })),
        }),
      });
      onDrawn(await r.json());
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  if (!enoughPlayers) {
    return (
      <div className="rounded-3xl border border-border bg-card/40 p-5 text-center">
        <div className="font-display text-xl">{t("title")}</div>
        <p className="mt-1 text-sm text-muted-foreground">{t("needPlayers")}</p>
      </div>
    );
  }

  if (mode === "manual") {
    // Group teams by group label for a readable grid.
    const groups = [...new Set(teams.map((t) => t.groupLabel))].sort();
    const potCount = teams.filter((tm) => picks[tm.id] === "pot").length;
    return (
      <div className="rounded-3xl border border-border bg-card/40 p-5">
        <div className="flex items-center justify-between">
          <div className="font-display text-xl">{t("manual")}</div>
          <button
            onClick={() => setMode("choose")}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            {t("cancel")}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("manualIntro")}</p>

        <div className="mt-4 space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                {g}
              </div>
              <div className="space-y-1.5">
                {teams
                  .filter((tm) => tm.groupLabel === g)
                  .map((tm) => (
                    <div key={tm.id} className="flex items-center gap-2">
                      <span className="text-lg">{flagEmoji(tm.flagCode)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {tm.name}
                      </span>
                      <select
                        value={picks[tm.id]}
                        onChange={(e) =>
                          setPicks((p) => ({ ...p, [tm.id]: e.target.value }))
                        }
                        className="h-9 w-36 shrink-0 rounded-lg border border-input bg-secondary/40 px-2 text-sm outline-none focus-visible:border-primary/60"
                      >
                        <option value="pot" className="bg-card">
                          {t("pot")}
                        </option>
                        {participants.map((p) => (
                          <option key={p.id} value={p.id} className="bg-card">
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {potCount > 0 && (
          <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-300">
            ⚠️ {t("potWarning", { count: potCount })}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          onClick={submitManual}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
        >
          {busy ? t("randomizing") : t("confirmManual")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card/40 p-5 text-center">
      <div className="font-display text-xl">{t("title")}</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("ready", { count: participants.length })}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={randomize}
          disabled={busy}
          className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
        >
          🎲 {busy ? t("randomizing") : t("randomize")}
        </button>
        <button
          onClick={openManual}
          disabled={busy}
          className="flex-1 rounded-xl border border-border py-3 font-semibold text-foreground transition hover:bg-secondary/60 disabled:opacity-50"
        >
          {t("manual")}
        </button>
      </div>
    </div>
  );
}
