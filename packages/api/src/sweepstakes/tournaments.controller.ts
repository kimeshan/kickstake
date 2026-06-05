import { Controller, Get } from "@nestjs/common";
import { asc } from "drizzle-orm";
import { db } from "../db";
import { tournament } from "../db/schema";

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
}
