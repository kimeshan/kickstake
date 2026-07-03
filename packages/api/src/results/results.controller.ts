import { Controller, Post, Param } from "@nestjs/common";
import { ResultsService } from "./results.service";

@Controller("tournaments")
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  // Organiser-triggered "refresh results now" (any signed-in user via the
  // global auth guard — results are shared tournament data, not per-user).
  // Fetches from the provider when configured, then recomputes prizes.
  @Post(":id/sync-results")
  sync(@Param("id") id: string) {
    return this.results.syncTournament(id);
  }
}
