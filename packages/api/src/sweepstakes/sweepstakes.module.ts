import { Module } from "@nestjs/common";
import { SweepstakesController } from "./sweepstakes.controller";
import { TournamentsController } from "./tournaments.controller";
import { SweepstakesService } from "./sweepstakes.service";

@Module({
  controllers: [SweepstakesController, TournamentsController],
  providers: [SweepstakesService],
})
export class SweepstakesModule {}
