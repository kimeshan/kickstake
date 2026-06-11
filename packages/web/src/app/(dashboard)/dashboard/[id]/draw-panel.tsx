"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [style, setStyle] = useState<"tiered" | "pure">("tiered");
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({}); // teamId -> participantId | "pot"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughPlayers = participants.length >= 2;

  // Teams power the tier preview and the manual grid.
  useEffect(() => {
    apiFetch(`/tournaments/${tournamentId}/teams`)
      .then((r) => r.json())
      .then(setTeams)
      .catch(() => {});
  }, [tournamentId]);

  // Tiering needs a strength rank on every team (custom tournaments may lack it).
  const ranked =
    teams.length > 0 && teams.every((tm) => tm.strengthRank !== null);

  // Mirrors the API's banding: floor(T/N) tiers of N teams by strength rank.
  const bands = useMemo(() => {
    if (!ranked || !enoughPlayers) return [];
    const sorted = [...teams].sort(
      (a, b) => (a.strengthRank ?? 0) - (b.strengthRank ?? 0),
    );
    const n = participants.length;
    const base = Math.floor(sorted.length / n);
    return Array.from({ length: base }, (_, b) =>
      sorted.slice(b * n, (b + 1) * n),
    );
  }, [teams, participants.length, ranked, enoughPlayers]);
  const extras = ranked
    ? teams.length - bands.length * participants.length
    : 0;

  async function randomize() {
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/draw`, {
        method: "POST",
        body: JSON.stringify({
          mode: "random",
          tiering: ranked && style === "tiered" ? "auto" : "none",
        }),
      });
      onDrawn(await r.json());
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  }

  function openManual() {
    setError(null);
    setPicks(Object.fromEntries(teams.map((tm) => [tm.id, "pot"])));
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
    <div className="rounded-3xl border border-border bg-card/40 p-5">
      <div className="text-center">
        <div className="font-display text-xl">{t("title")}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ready", { count: participants.length })}
        </p>
      </div>

      {ranked && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
            <button
              onClick={() => setStyle("tiered")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                style === "tiered"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("tiered")}
            </button>
            <button
              onClick={() => setStyle("pure")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                style === "pure"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pure")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {style === "tiered" ? t("tieredHint") : t("pureHint")}
          </p>

          {style === "tiered" && bands.length > 0 && (
            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-secondary/20 p-3">
              {bands.map((band, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {t("tierLabel", { n: i + 1 })}
                  </span>
                  <span
                    className="truncate text-sm"
                    title={band.map((tm) => tm.name).join(", ")}
                  >
                    {band.map((tm) => flagEmoji(tm.flagCode)).join(" ")}
                  </span>
                </div>
              ))}
              {extras > 0 && (
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {t("tierExtras", { count: extras })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={randomize}
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
        >
          🎲 {busy ? t("randomizing") : t("randomize")}
        </button>
        <button
          onClick={openManual}
          disabled={busy || teams.length === 0}
          className="w-full rounded-xl border border-border py-3 font-semibold text-foreground transition hover:bg-secondary/60 disabled:opacity-50"
        >
          {t("manual")}
        </button>
      </div>
    </div>
  );
}
