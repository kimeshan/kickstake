import { Module } from "@nestjs/common";
import { ChallengesController } from "./challenges.controller";
import { ChallengesService } from "./challenges.service";
import { ChallengeClock } from "./clock";
import { ChallengeDigestsService } from "./digests.service";
import { ChallengeRemindersService } from "./reminders.service";

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeClock, ChallengeRemindersService, ChallengeDigestsService],
})
export class ChallengesModule {}
