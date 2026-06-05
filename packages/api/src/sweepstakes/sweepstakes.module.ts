import { Module } from "@nestjs/common";
import { SweepstakesController } from "./sweepstakes.controller";
import { TournamentsController } from "./tournaments.controller";
import { JoinController } from "./join.controller";
import { SweepstakesService } from "./sweepstakes.service";

@Module({
  controllers: [SweepstakesController, TournamentsController, JoinController],
  providers: [SweepstakesService],
})
export class SweepstakesModule {}
