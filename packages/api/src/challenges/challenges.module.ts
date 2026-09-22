import { Module } from "@nestjs/common";
import { ChallengesController } from "./challenges.controller";
import { ChallengesService } from "./challenges.service";
import { ChallengeClock } from "./clock";

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeClock],
})
export class ChallengesModule {}
