import { Module } from "@nestjs/common";
import { ChallengesController } from "./challenges.controller";
import { ChallengesService } from "./challenges.service";
import { ChallengeClock } from "./clock";
import { ChallengeRemindersService } from "./reminders.service";

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeClock, ChallengeRemindersService],
})
export class ChallengesModule {}
