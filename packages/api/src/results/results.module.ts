import { Module, type OnApplicationBootstrap } from "@nestjs/common";
import { ResultsController } from "./results.controller";
import { ResultsService } from "./results.service";

@Module({
  controllers: [ResultsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule implements OnApplicationBootstrap {
  constructor(private readonly results: ResultsService) {}

  // Refresh once at boot so a deploy never serves stale results until the
  // next cron tick. Fire-and-forget: boot must not block on the provider.
  onApplicationBootstrap() {
    if (!process.env.FOOTBALL_DATA_API_KEY) return;
    void this.results.syncAll();
  }
}
