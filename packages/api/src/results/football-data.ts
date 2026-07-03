/**
 * football-data.org v4 adapter. Free tier covers the World Cup.
 *
 * A tournament opts in via `tournament.dataSourceId = "football-data:<code>"`
 * (WC2026 is seeded with "football-data:WC"); the sync runs only when
 * FOOTBALL_DATA_API_KEY is set. Everything provider-specific — stage names,
 * team-name quirks — is contained here so another provider can slot in later.
 */
import type { Stage } from "./engine";

const BASE_URL = "https://api.football-data.org/v4";

export interface ProviderTeamRef {
  externalId: string | null;
  name: string | null;
}

export interface ProviderMatch {
  externalId: string;
  stage: Stage;
  groupLabel: string | null;
  kickoffAt: Date | null;
  home: ProviderTeamRef;
  away: ProviderTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  /** "home" | "away" | null — provider's overall verdict (covers shoot-outs). */
  winnerSide: "home" | "away" | null;
  status: "scheduled" | "in_play" | "finished";
}

// Provider stage → our stage. Multiple spellings guard against naming drift
// (the 48-team format's round of 32 is new in 2026).
const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "group",
  LAST_32: "round_of_32",
  ROUND_OF_32: "round_of_32",
  PLAYOFF_ROUND: "round_of_32",
  LAST_16: "round_of_16",
  ROUND_OF_16: "round_of_16",
  QUARTER_FINALS: "quarter_final",
  QUARTER_FINAL: "quarter_final",
  SEMI_FINALS: "semi_final",
  SEMI_FINAL: "semi_final",
  THIRD_PLACE: "third_place",
  THIRD_PLACE_PLAYOFF: "third_place",
  FINAL: "final",
};

function mapStatus(s: string): ProviderMatch["status"] {
  if (s === "FINISHED" || s === "AWARDED") return "finished";
  if (s === "IN_PLAY" || s === "PAUSED" || s === "LIVE") return "in_play";
  return "scheduled"; // SCHEDULED / TIMED / POSTPONED / SUSPENDED / CANCELLED
}

function mapMatch(m: any): ProviderMatch | null {
  const stage = STAGE_MAP[m.stage];
  if (!stage) return null;
  const winner: string | null = m.score?.winner ?? null;
  return {
    externalId: String(m.id),
    stage,
    // v4 sends "GROUP_A" (older payloads "Group A") → "A"
    groupLabel:
      stage === "group" && typeof m.group === "string"
        ? m.group.replace(/^group[\s_]+/i, "")
        : null,
    kickoffAt: m.utcDate ? new Date(m.utcDate) : null,
    home: {
      externalId: m.homeTeam?.id != null ? String(m.homeTeam.id) : null,
      name: m.homeTeam?.name ?? null,
    },
    away: {
      externalId: m.awayTeam?.id != null ? String(m.awayTeam.id) : null,
      name: m.awayTeam?.name ?? null,
    },
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    homePenalties: m.score?.penalties?.home ?? null,
    awayPenalties: m.score?.penalties?.away ?? null,
    winnerSide:
      winner === "HOME_TEAM" ? "home" : winner === "AWAY_TEAM" ? "away" : null,
    status: mapStatus(m.status),
  };
}

/** Fetches every match of a competition, mapped to our domain shape. */
export async function fetchCompetitionMatches(
  competitionCode: string,
  apiKey: string,
  onUnknownStage: (stage: string) => void = (stage) =>
    console.warn(`football-data.org: unmapped stage "${stage}" — matches skipped`),
): Promise<ProviderMatch[]> {
  const res = await fetch(`${BASE_URL}/competitions/${competitionCode}/matches`, {
    headers: { "X-Auth-Token": apiKey },
  });
  if (!res.ok)
    throw new Error(`football-data.org ${res.status} for ${competitionCode}`);
  const body = (await res.json()) as { matches?: { stage?: string }[] };
  const raw = body.matches ?? [];
  // An unmapped stage means a naming drift (e.g. the 2026 round of 32) —
  // surface it loudly instead of silently dropping a whole round.
  for (const stage of new Set(
    raw.map((m) => m.stage).filter((s): s is string => !!s && !STAGE_MAP[s]),
  ))
    onUnknownStage(stage);
  return raw.map(mapMatch).filter((m): m is ProviderMatch => m !== null);
}

export interface ProviderScorer {
  playerName: string;
  team: ProviderTeamRef;
  goals: number;
}

/** Fetches the competition's top scorers (Golden Boot leaders). */
export async function fetchCompetitionScorers(
  competitionCode: string,
  apiKey: string,
): Promise<ProviderScorer[]> {
  const res = await fetch(
    `${BASE_URL}/competitions/${competitionCode}/scorers?limit=20`,
    { headers: { "X-Auth-Token": apiKey } },
  );
  if (!res.ok)
    throw new Error(
      `football-data.org ${res.status} for ${competitionCode} scorers`,
    );
  const body = (await res.json()) as { scorers?: any[] };
  return (body.scorers ?? [])
    .filter((s) => s?.player?.name)
    .map((s) => ({
      playerName: String(s.player.name),
      team: {
        externalId: s.team?.id != null ? String(s.team.id) : null,
        name: s.team?.name ?? null,
      },
      goals: typeof s.goals === "number" ? s.goals : 0,
    }));
}

// --- Team-name matching -------------------------------------------------------

/** Lowercase, strip diacritics and non-letters: "Côte d’Ivoire" → "cotedivoire". */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Provider spelling (normalized) → our seeded name (normalized).
const NAME_ALIASES: Record<string, string> = {
  korearepublic: "southkorea",
  unitedstates: "usa",
  turkey: "turkiye",
  bosniaandherzegovina: "bosniaherzegovina",
  cotedivoire: "ivorycoast",
  ivorycoast: "ivorycoast",
  caboverde: "capeverde",
  capeverdeislands: "capeverde",
  congodr: "drcongo",
  drcongo: "drcongo",
  iriran: "iran",
  czechrepublic: "czechia",
  netherlands: "netherlands",
};

/**
 * Resolves a provider team to one of ours: by stored externalRef first, then
 * by (aliased) normalized name. Returns null for TBD slots or unknown names.
 */
export function resolveTeamId(
  ref: ProviderTeamRef,
  teams: { id: string; name: string; externalRef: string | null }[],
): string | null {
  if (ref.externalId) {
    const byRef = teams.find((t) => t.externalRef === ref.externalId);
    if (byRef) return byRef.id;
  }
  if (!ref.name) return null;
  const normalized = normalizeTeamName(ref.name);
  const target = NAME_ALIASES[normalized] ?? normalized;
  return teams.find((t) => normalizeTeamName(t.name) === target)?.id ?? null;
}
