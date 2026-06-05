import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import {
  sweepstake,
  prizeCategory,
  tournament,
  participant,
} from "../db/schema";
import { generatePrizes, prizeTotal } from "./prize-generation";

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
      },
    });
    if (!s) throw new NotFoundException("Sweepstake not found.");
    if (s.organiserId !== organiserId)
      throw new ForbiddenException("Not your sweepstake.");
    return s;
  }

  /**
   * Replaces the prize structure (spec §8: PUT prizes). Validates that enabled
   * prizes reconcile to exactly the designed pot before saving.
   */
  async savePrizes(organiserId: string, id: string, prizes: PrizeInput[]) {
    const s = await this.findOne(organiserId, id); // throws if not owner/found
    if (s.status !== "draft" && s.status !== "open")
      throw new BadRequestException("Prizes are locked once the draw has run.");
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
      with: { tournament: true, prizeCategories: true, participants: true },
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
      tournament: s.tournament
        ? {
            name: s.tournament.name,
            year: s.tournament.year,
            teamCount: s.tournament.teamCount,
            groupCount: s.tournament.groupCount,
          }
        : null,
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
    // Joinable before the draw only (spec §2 guardrail).
    if (s.status !== "draft" && s.status !== "open")
      throw new BadRequestException("This sweepstake is no longer open to join.");

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
