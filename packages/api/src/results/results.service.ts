import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../db";
import {
  match,
  team,
  tournament,
  scorer,
  sweepstake,
  prizeResult,
} from "../db/schema";
import {
  computeOutcomes,
  buildPrizeRows,
  type EngineMatch,
  type Stage,
} from "./engine";
import {
  fetchCompetitionMatches,
  fetchCompetitionScorers,
  resolveTeamId,
  type ProviderMatch,
  type ProviderScorer,
} from "./football-data";

// Once a day by default — WC results only change a few times a day and the
// free provider tier is rate-limited. Override with RESULTS_CRON.
const RESULTS_CRON = process.env.RESULTS_CRON ?? "0 6 * * *";

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  /** Daily: pull fresh results for every provider-backed tournament. */
  @Cron(RESULTS_CRON)
  async syncAll() {
    if (!process.env.FOOTBALL_DATA_API_KEY) return;
    const tournaments = await db.query.tournament.findMany({
      where: isNotNull(tournament.dataSourceId),
    });
    for (const t of tournaments) {
      try {
        const summary = await this.syncTournament(t.id);
        this.logger.log(
          `Synced "${t.name}": ${summary.matchesUpserted} matches, ` +
            `${summary.sweepstakesRecomputed} sweepstakes recomputed.`,
        );
      } catch (err) {
        // One bad tournament (or a provider hiccup) must not kill the run.
        this.logger.error(`Sync failed for "${t.name}"`, err as Error);
      }
    }
  }

  /**
   * Fetches the tournament's matches from its provider (when configured) and
   * recomputes prize results for every affected sweepstake. Works without a
   * provider too — it then just recomputes from the matches already stored.
   */
  async syncTournament(tournamentId: string) {
    const t = await db.query.tournament.findFirst({
      where: eq(tournament.id, tournamentId),
    });
    if (!t) throw new NotFoundException("Tournament not found.");

    let matchesUpserted = 0;
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    const code = t.dataSourceId?.startsWith("football-data:")
      ? t.dataSourceId.slice("football-data:".length)
      : null;
    if (apiKey && code) {
      const provided = await fetchCompetitionMatches(code, apiKey);
      matchesUpserted = await this.applyProviderMatches(t.id, provided);
      try {
        await this.applyProviderScorers(
          t.id,
          await fetchCompetitionScorers(code, apiKey),
        );
      } catch (err) {
        // Scorers only power the Golden Boot leader — not worth failing the
        // whole sync over.
        this.logger.warn(`Scorer sync failed for "${t.name}"`, err as Error);
      }
    }

    const sweepstakesRecomputed = await this.recomputeTournament(t.id);
    return { matchesUpserted, sweepstakesRecomputed };
  }

  /** Upserts provider matches by (tournament, externalId). Exposed for tests. */
  async applyProviderMatches(
    tournamentId: string,
    provided: ProviderMatch[],
  ): Promise<number> {
    const teams = await db.query.team.findMany({
      where: eq(team.tournamentId, tournamentId),
    });

    let upserted = 0;
    for (const m of provided) {
      const homeTeamId = resolveTeamId(m.home, teams);
      const awayTeamId = resolveTeamId(m.away, teams);
      if (m.home.name && !homeTeamId)
        this.logger.warn(`Unmatched team name from provider: "${m.home.name}"`);
      if (m.away.name && !awayTeamId)
        this.logger.warn(`Unmatched team name from provider: "${m.away.name}"`);

      // Learn provider ids so future syncs don't depend on name matching.
      for (const [teamId, ref] of [
        [homeTeamId, m.home],
        [awayTeamId, m.away],
      ] as const) {
        if (!teamId || !ref.externalId) continue;
        const known = teams.find((t) => t.id === teamId)!;
        if (known.externalRef !== ref.externalId) {
          known.externalRef = ref.externalId;
          await db
            .update(team)
            .set({ externalRef: ref.externalId })
            .where(eq(team.id, teamId));
        }
      }

      const winnerTeamId =
        m.winnerSide === "home"
          ? homeTeamId
          : m.winnerSide === "away"
            ? awayTeamId
            : null;

      const values = {
        tournamentId,
        externalId: m.externalId,
        stage: m.stage,
        groupLabel: m.groupLabel,
        kickoffAt: m.kickoffAt,
        homeTeamId,
        awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homePenalties: m.homePenalties,
        awayPenalties: m.awayPenalties,
        winnerTeamId,
        status: m.status,
        updatedAt: new Date(),
      };
      await db
        .insert(match)
        .values(values)
        .onConflictDoUpdate({
          target: [match.tournamentId, match.externalId],
          set: values,
        });
      upserted++;
    }
    return upserted;
  }

  /** Replaces the tournament's scorer list (Golden Boot leaders). */
  async applyProviderScorers(
    tournamentId: string,
    provided: ProviderScorer[],
  ): Promise<number> {
    const teams = await db.query.team.findMany({
      where: eq(team.tournamentId, tournamentId),
    });
    const rows = provided.map((s) => ({
      tournamentId,
      playerName: s.playerName,
      teamId: resolveTeamId(s.team, teams),
      goals: s.goals,
      updatedAt: new Date(),
    }));
    await db.transaction(async (tx) => {
      await tx.delete(scorer).where(eq(scorer.tournamentId, tournamentId));
      if (rows.length) await tx.insert(scorer).values(rows);
    });
    return rows.length;
  }

  /**
   * Re-derives prize results for every drawn/live sweepstake of a tournament
   * from the matches on file. Decided outcomes are auto-approved; rows an
   * organiser overrode manually are left untouched. Flips drawn → live once
   * the first prize is decided.
   */
  async recomputeTournament(tournamentId: string): Promise<number> {
    const [teams, matches, scorers, sweepstakes] = await Promise.all([
      db.query.team.findMany({ where: eq(team.tournamentId, tournamentId) }),
      db.query.match.findMany({ where: eq(match.tournamentId, tournamentId) }),
      db.query.scorer.findMany({ where: eq(scorer.tournamentId, tournamentId) }),
      db.query.sweepstake.findMany({
        where: and(
          eq(sweepstake.tournamentId, tournamentId),
          inArray(sweepstake.status, ["drawn", "live"]),
        ),
        with: { prizeCategories: true, assignments: true },
      }),
    ]);
    if (matches.length === 0) return 0;

    const engineMatches: EngineMatch[] = matches.map((m) => ({
      stage: m.stage as Stage,
      groupLabel: m.groupLabel,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winnerTeamId: m.winnerTeamId,
      status: m.status,
    }));
    const outcomes = computeOutcomes(teams, engineMatches, scorers);

    for (const s of sweepstakes) {
      const rows = buildPrizeRows(s.prizeCategories, outcomes);
      const decided = rows.filter((r) => r.decided && r.winningTeamId !== null);
      const ownership = new Map(
        s.assignments.map((a) => [a.teamId, a.participantId]),
      );
      const categoryIds = s.prizeCategories.map((c) => c.id);

      await db.transaction(async (tx) => {
        // Replace computed rows wholesale; manual overrides survive.
        if (categoryIds.length) {
          await tx
            .delete(prizeResult)
            .where(
              and(
                inArray(prizeResult.prizeCategoryId, categoryIds),
                ne(prizeResult.status, "manual_override"),
              ),
            );
        }
        const overridden = categoryIds.length
          ? await tx.query.prizeResult.findMany({
              where: inArray(prizeResult.prizeCategoryId, categoryIds),
            })
          : [];
        const isOverridden = (categoryId: string, groupLabel: string | null) =>
          overridden.some(
            (o) =>
              o.prizeCategoryId === categoryId && o.groupLabel === groupLabel,
          );

        const inserts = decided
          .filter((r) => !isOverridden(r.categoryId, r.groupLabel))
          .map((r) => ({
            prizeCategoryId: r.categoryId,
            groupLabel: r.groupLabel,
            winningTeamId: r.winningTeamId,
            winningParticipantId: ownership.get(r.winningTeamId!) ?? null,
            status: "approved" as const,
            approvedAt: new Date(),
          }));
        if (inserts.length) await tx.insert(prizeResult).values(inserts);

        if ((inserts.length || overridden.length) && s.status === "drawn") {
          await tx
            .update(sweepstake)
            .set({ status: "live" })
            .where(eq(sweepstake.id, s.id));
        }
      });
    }
    return sweepstakes.length;
  }
}
