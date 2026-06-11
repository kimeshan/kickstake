/**
 * The draw (spec §4). Distributes T teams across N participants from a seed so
 * the result is reproducible / provably fair.
 *
 * Each participant gets floor(T/N) teams; the T mod N remainder is either
 * spread one-each to participants ("spread_fairly", default) or left to the pot
 * ("to_pot", participantId = null). You do NOT need N === T — any N >= 2 works.
 */

// v2 added the tiered draw (runTieredDraw). The sweepstake's drawTiering says
// which path produced a given draw; the version covers both.
export const DRAW_ALGO_VERSION = 2;

export type RemainderPolicy = "spread_fairly" | "to_pot";
export type DrawTiering = "none" | "auto";

export interface Assignment {
  teamId: string;
  participantId: string | null; // null = pot
  tier?: number | null; // strength band (1 = strongest) under a tiered draw
}

export interface RankedTeam {
  id: string;
  strengthRank: number; // ordinal within the tournament, 1 = strongest
}

// Deterministic PRNG seeded from a string (xmur3 → mulberry32).
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns one assignment per team — every team is assigned (to a player or the pot). */
export function runDraw(
  teamIds: readonly string[],
  participantIds: readonly string[],
  seed: string,
  remainderPolicy: RemainderPolicy,
): Assignment[] {
  const rand = seededRandom(seed);
  const teams = shuffle(teamIds, rand);
  const players = shuffle(participantIds, rand);

  const n = players.length;
  const base = Math.floor(teams.length / n);

  const assignments: Assignment[] = [];
  let i = 0;
  for (const p of players) {
    for (let k = 0; k < base; k++) {
      assignments.push({ teamId: teams[i++], participantId: p });
    }
  }

  // Remainder (T mod N teams left).
  const remainder = teams.slice(i);
  remainder.forEach((teamId, r) => {
    assignments.push({
      teamId,
      participantId: remainderPolicy === "to_pot" ? null : players[r],
    });
  });

  return assignments;
}

/**
 * Tiered draw: teams are sorted by strength rank and chunked into
 * floor(T/N) bands of N; each band is shuffled and dealt one team per
 * participant. Everyone gets exactly one team from every band — luck stays in
 * play within a band, but nobody lands two favourites while someone else gets
 * two outsiders.
 *
 * The T mod N remainder is the WEAKEST teams (an extra team shouldn't be a
 * windfall), handled by the same remainder policy as the pure-random draw.
 */
export function runTieredDraw(
  teams: readonly RankedTeam[],
  participantIds: readonly string[],
  seed: string,
  remainderPolicy: RemainderPolicy,
): Assignment[] {
  const rand = seededRandom(seed);
  const sorted = [...teams]
    .sort((a, b) => a.strengthRank - b.strengthRank)
    .map((t) => t.id);
  const players = shuffle(participantIds, rand);

  const n = players.length;
  const base = Math.floor(sorted.length / n);

  const assignments: Assignment[] = [];
  for (let b = 0; b < base; b++) {
    const band = shuffle(sorted.slice(b * n, (b + 1) * n), rand);
    band.forEach((teamId, j) => {
      assignments.push({ teamId, participantId: players[j], tier: b + 1 });
    });
  }

  // Remainder: weakest T mod N teams, spread over a fresh shuffle so the
  // extras don't favour anyone in particular.
  const remainder = sorted.slice(base * n);
  const extras = shuffle(players, rand);
  remainder.forEach((teamId, r) => {
    assignments.push({
      teamId,
      participantId: remainderPolicy === "to_pot" ? null : extras[r],
      tier: null,
    });
  });

  return assignments;
}
