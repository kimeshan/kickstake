import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import {
  sweepstake,
  prizeCategory,
  tournament,
  participant,
  team,
  teamAssignment,
} from "../db/schema";
import { generatePrizes, prizeTotal } from "./prize-generation";
import {
  runDraw,
  runTieredDraw,
  DRAW_ALGO_VERSION,
  type RemainderPolicy,
  type DrawTiering,
  type Assignment,
  type RankedTeam,
} from "./draw";

/** Minor-unit exponent for a currency (2 for USD, 0 for JPY/KRW). */
function fractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export interface UpdateInput {
  currency?: string;
  name?: string;
  joinClosed?: boolean;
  finalized?: boolean;
}

export interface ParticipantInput {
  displayName?: string;
  email?: string | null;
  paid?: boolean;
}

export interface DrawInput {
  mode: "random" | "manual";
  tiering?: DrawTiering; // random only; "auto" bands teams by strength rank
  remainderPolicy?: RemainderPolicy;
  assignments?: Assignment[]; // required for manual
}

export interface JoinInput {
  displayName: string;
  email?: string;
}

export interface PrizeInput {
  label: string;
  description?: string | null;
  ruleType: string;
  amount: number; // minor units (per-group amount when perGroup)
  perGroup: boolean;
  enabled: boolean;
}

const RULE_TYPES = new Set([
  "winner",
  "runner_up",
  "third_place",
  "group_top",
  "group_bottom",
  "player_of_tournament",
  "golden_boot",
  "most_cards",
  "least_conceded",
  "most_possession",
  "least_possession",
  "biggest_loss",
  "custom",
]);

export interface CreateSweepstakeInput {
  tournamentId: string;
  name: string;
  currency?: string;
  buyIn: number; // minor units, per person
  donation?: number; // minor units
  expectedParticipants: number;
}

@Injectable()
export class SweepstakesService {
  async create(organiserId: string, input: CreateSweepstakeInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Name is required.");
    if (!Number.isInteger(input.buyIn) || input.buyIn < 0)
      throw new BadRequestException("buyIn must be a non-negative integer (minor units).");
    if (!Number.isInteger(input.expectedParticipants) || input.expectedParticipants < 2)
      throw new BadRequestException("expectedParticipants must be at least 2.");
    const donation = input.donation ?? 0;
    if (!Number.isInteger(donation) || donation < 0)
      throw new BadRequestException("donation must be a non-negative integer (minor units).");

    const t = await db.query.tournament.findFirst({
      where: eq(tournament.id, input.tournamentId),
    });
    if (!t) throw new NotFoundException("Tournament not found.");

    const designedPot = input.buyIn * input.expectedParticipants + donation;
    if (designedPot <= 0)
      throw new BadRequestException("Pot must be greater than zero — set a buy-in or a donation.");

    const [created] = await db
      .insert(sweepstake)
      .values({
        organiserId,
        tournamentId: t.id,
        name,
        currency: input.currency ?? "ZAR",
        buyIn: input.buyIn,
        donation,
        designedPot,
        status: "draft",
        joinToken: nanoid(8),
        remainderPolicy: "spread_fairly",
      })
      .returning();

    const prizes = generatePrizes(designedPot, t.groupCount).map((p) => ({
      ...p,
      sweepstakeId: created.id,
    }));
    await db.insert(prizeCategory).values(prizes);

    return this.findOne(organiserId, created.id);
  }

  async list(organiserId: string) {
    return db.query.sweepstake.findMany({
      where: eq(sweepstake.organiserId, organiserId),
      orderBy: [desc(sweepstake.createdAt)],
      with: { tournament: true },
    });
  }

  async findOne(organiserId: string, id: string) {
    const s = await db.query.sweepstake.findFirst({
      where: eq(sweepstake.id, id),
      with: {
        tournament: true,
        prizeCategories: true,
        participants: true,
        assignments: { with: { team: true, participant: true } },
      },
    });
    if (!s) throw new NotFoundException("Sweepstake not found.");
    if (s.organiserId !== organiserId)
      throw new ForbiddenException("Not your sweepstake.");
    return s;
  }

  /** Update config — currency (re-denominated) and/or name. */
  async update(organiserId: string, id: string, input: UpdateInput) {
    const s = await this.findOne(organiserId, id);
    const patch: Partial<typeof sweepstake.$inferInsert> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException("Name can't be empty.");
      patch.name = name;
    }

    if (input.joinClosed !== undefined) patch.joinClosed = !!input.joinClosed;

    if (input.finalized !== undefined) {
      if (input.finalized && s.assignments.length === 0)
        throw new BadRequestException("Run the draw before finalizing.");
      patch.finalized = !!input.finalized;
    }

    if (input.currency !== undefined) {
      const code = input.currency.toUpperCase();
      if (!/^[A-Z]{3}$/.test(code))
        throw new BadRequestException("Invalid currency code.");
      if (code !== s.currency) {
        // Re-denominate so the human-readable amounts stay the same when the
        // minor-unit exponent differs (e.g. USD/2dp → JPY/0dp).
        const factor = 10 ** (fractionDigits(code) - fractionDigits(s.currency));
        const scale = (v: number) => Math.round(v * factor);
        patch.currency = code;
        patch.buyIn = scale(s.buyIn);
        patch.donation = scale(s.donation);
        patch.designedPot = scale(s.designedPot);
        if (factor !== 1) {
          await db.transaction(async (tx) => {
            for (const p of s.prizeCategories) {
              await tx
                .update(prizeCategory)
                .set({ amount: scale(p.amount) })
                .where(eq(prizeCategory.id, p.id));
            }
          });
        }
      }
    }

    if (Object.keys(patch).length)
      await db.update(sweepstake).set(patch).where(eq(sweepstake.id, id));
    return this.findOne(organiserId, id);
  }

  // --- Participant management (organiser) ----------------------------------

  private async ownedParticipant(organiserId: string, id: string, pid: string) {
    await this.findOne(organiserId, id); // ownership check
    const p = await db.query.participant.findFirst({
      where: and(eq(participant.id, pid), eq(participant.sweepstakeId, id)),
    });
    if (!p) throw new NotFoundException("Participant not found.");
    return p;
  }

  async updateParticipant(
    organiserId: string,
    id: string,
    pid: string,
    input: ParticipantInput,
  ) {
    await this.ownedParticipant(organiserId, id, pid);
    const patch: Partial<typeof participant.$inferInsert> = {};
    if (input.displayName !== undefined) {
      const name = input.displayName.trim();
      if (!name) throw new BadRequestException("Name can't be empty.");
      patch.displayName = name;
    }
    if (input.email !== undefined) patch.email = input.email?.trim() || null;
    if (input.paid !== undefined) patch.paid = !!input.paid;
    if (Object.keys(patch).length)
      await db.update(participant).set(patch).where(eq(participant.id, pid));
    return this.findOne(organiserId, id);
  }

  async removeParticipant(organiserId: string, id: string, pid: string) {
    const s = await this.findOne(organiserId, id);
    if (s.status === "settled")
      throw new BadRequestException("This sweepstake is already settled.");
    await this.ownedParticipant(organiserId, id, pid);
    await db.delete(participant).where(eq(participant.id, pid));
    return this.findOne(organiserId, id);
  }

  // --- The draw ------------------------------------------------------------

  async draw(organiserId: string, id: string, input: DrawInput) {
    const s = await this.findOne(organiserId, id);
    // No lock-in: the organiser can re-run / re-assign the draw any time until
    // the sweepstake is settled.
    if (s.status === "settled")
      throw new BadRequestException("This sweepstake is already settled.");
    if (s.participants.length < 2)
      throw new BadRequestException("Add at least 2 players before drawing.");

    const teams = await db
      .select({ id: team.id, strengthRank: team.strengthRank })
      .from(team)
      .where(eq(team.tournamentId, s.tournamentId));
    const teamIds = teams.map((t) => t.id);
    const participantIds = s.participants.map((p) => p.id);

    let assignments: Assignment[];
    let seed: string | null;
    let algoVersion: number | null;
    let tiering: DrawTiering = "none";

    if (input.mode === "manual") {
      assignments = this.validateManual(input.assignments ?? [], teamIds, participantIds);
      seed = null;
      algoVersion = null;
    } else {
      seed = nanoid(12);
      const policy: RemainderPolicy = input.remainderPolicy ?? "spread_fairly";
      tiering = input.tiering ?? "none";
      if (tiering === "auto") {
        if (teams.some((t) => t.strengthRank === null))
          throw new BadRequestException(
            "Tiered draw needs a strength rank on every team in this tournament.",
          );
        assignments = runTieredDraw(
          teams as RankedTeam[],
          participantIds,
          seed,
          policy,
        );
      } else {
        assignments = runDraw(teamIds, participantIds, seed, policy);
      }
      algoVersion = DRAW_ALGO_VERSION;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(teamAssignment)
        .where(eq(teamAssignment.sweepstakeId, id));
      await tx.insert(teamAssignment).values(
        assignments.map((a) => ({
          sweepstakeId: id,
          teamId: a.teamId,
          participantId: a.participantId,
          tier: a.tier ?? null,
        })),
      );
      await tx
        .update(sweepstake)
        .set({
          status: "drawn",
          drawSeed: seed,
          drawAlgoVersion: algoVersion,
          drawTiering: tiering,
          remainderPolicy: input.remainderPolicy ?? s.remainderPolicy,
        })
        .where(eq(sweepstake.id, id));
    });

    return this.findOne(organiserId, id);
  }

  private validateManual(
    provided: Assignment[],
    teamIds: string[],
    participantIds: string[],
  ): Assignment[] {
    const teamSet = new Set(teamIds);
    const partSet = new Set(participantIds);
    const seen = new Set<string>();
    for (const a of provided) {
      if (!teamSet.has(a.teamId))
        throw new BadRequestException("Assignment references an unknown team.");
      if (seen.has(a.teamId))
        throw new BadRequestException("A team was assigned more than once.");
      if (a.participantId !== null && !partSet.has(a.participantId))
        throw new BadRequestException("Assignment references an unknown player.");
      seen.add(a.teamId);
    }
    if (seen.size !== teamIds.length)
      throw new BadRequestException("Every team must be assigned (to a player or the pot).");
    return provided;
  }

  /**
   * Replaces the prize structure (spec §8: PUT prizes). Validates that enabled
   * prizes reconcile to exactly the designed pot before saving.
   */
  async savePrizes(organiserId: string, id: string, prizes: PrizeInput[]) {
    const s = await this.findOne(organiserId, id); // throws if not owner/found
    if (s.status === "settled")
      throw new BadRequestException("This sweepstake is already settled.");
    if (!Array.isArray(prizes) || prizes.length === 0)
      throw new BadRequestException("At least one prize is required.");

    const groupCount = s.tournament?.groupCount ?? 1;
    const clean = prizes.map((p) => {
      const label = p.label?.trim();
      if (!label) throw new BadRequestException("Every prize needs a name.");
      if (!RULE_TYPES.has(p.ruleType))
        throw new BadRequestException(`Unknown prize type: ${p.ruleType}`);
      if (!Number.isInteger(p.amount) || p.amount < 0)
        throw new BadRequestException("Prize amounts must be non-negative integers.");
      return {
        sweepstakeId: id,
        label,
        description: p.description?.trim() || null,
        ruleType: p.ruleType as PrizeInput["ruleType"],
        amount: p.amount,
        perGroup: !!p.perGroup,
        enabled: p.enabled !== false,
      };
    });

    const total = prizeTotal(clean, groupCount);
    if (total !== s.designedPot)
      throw new BadRequestException(
        `Prizes must total the pot (${s.designedPot}); got ${total}.`,
      );

    await db.transaction(async (tx) => {
      await tx.delete(prizeCategory).where(eq(prizeCategory.sweepstakeId, id));
      await tx
        .insert(prizeCategory)
        .values(clean as (typeof prizeCategory.$inferInsert)[]);
    });

    return this.findOne(organiserId, id);
  }

  // --- Public participant join (no auth) -----------------------------------

  /** Public, privacy-safe view of a sweepstake by its join token. */
  async publicView(token: string) {
    const s = await db.query.sweepstake.findFirst({
      where: eq(sweepstake.joinToken, token),
      with: {
        tournament: true,
        prizeCategories: true,
        participants: true,
        assignments: { with: { team: true, participant: true } },
      },
    });
    if (!s) throw new NotFoundException("Sweepstake not found.");
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      currency: s.currency,
      buyIn: s.buyIn,
      designedPot: s.designedPot,
      joinToken: s.joinToken,
      joinClosed: s.joinClosed,
      finalized: s.finalized,
      // The reveal — only once the organiser finalizes.
      draw: s.finalized
        ? s.assignments.map((a) => ({
            team: {
              name: a.team.name,
              flagCode: a.team.flagCode,
              groupLabel: a.team.groupLabel,
            },
            tier: a.tier,
            participantName: a.participant?.displayName ?? null,
          }))
        : null,
      tournament: s.tournament
        ? {
            name: s.tournament.name,
            year: s.tournament.year,
            teamCount: s.tournament.teamCount,
            groupCount: s.tournament.groupCount,
          }
        : null,
      prizes: s.prizeCategories
        .filter((p) => p.enabled)
        .map((p) => ({
          label: p.label,
          description: p.description,
          ruleType: p.ruleType,
          amount: p.amount,
          perGroup: p.perGroup,
        })),
      prizeCount: s.prizeCategories.filter((p) => p.enabled).length,
      participants: s.participants.map((p) => ({ displayName: p.displayName })),
      participantCount: s.participants.length,
    };
  }

  async join(token: string, input: JoinInput) {
    const s = await db.query.sweepstake.findFirst({
      where: eq(sweepstake.joinToken, token),
    });
    if (!s) throw new NotFoundException("Sweepstake not found.");
    // Joining is governed by the admin's joinClosed flag, not the draw — the
    // organiser can keep it open after drawing (people drop in/out) and close
    // it when ready.
    if (s.joinClosed || s.status === "settled")
      throw new BadRequestException("Joining is closed for this sweepstake.");

    const displayName = input.displayName?.trim();
    if (!displayName) throw new BadRequestException("Name is required.");

    await db.insert(participant).values({
      sweepstakeId: s.id,
      displayName,
      email: input.email?.trim() || null,
      amountDue: s.buyIn,
      paid: false,
    });

    return this.publicView(token);
  }
}
