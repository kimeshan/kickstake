import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { SweepstakesService, type JoinInput } from "./sweepstakes.service";

// Public participant endpoints — no account needed (spec §1, §8: /api/j/:token).
@Controller("j")
export class JoinController {
  constructor(private readonly sweepstakes: SweepstakesService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.sweepstakes.publicView(token);
  }

  @Public()
  @Post(":token/participants")
  join(@Param("token") token: string, @Body() body: JoinInput) {
    return this.sweepstakes.join(token, body);
  }
}
