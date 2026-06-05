import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { sweepstake, prizeCategory, tournament } from "../db/schema";
import { generatePrizes } from "./prize-generation";

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
}
