import { Controller, Get, Param } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { tournament, team } from "../db/schema";

@Controller("tournaments")
export class TournamentsController {
  // Tournaments to choose from in the create wizard (organiser-only via the
  // global auth guard). v1 ships WC2026 pre-seeded.
  @Get()
  list() {
    return db.query.tournament.findMany({
      orderBy: [asc(tournament.year), asc(tournament.name)],
    });
  }

  // Teams in a tournament — used by the manual-draw grid.
  @Get(":id/teams")
  teams(@Param("id") id: string) {
    return db.query.team.findMany({
      where: eq(team.tournamentId, id),
      orderBy: [asc(team.groupLabel), asc(team.name)],
    });
  }
}
