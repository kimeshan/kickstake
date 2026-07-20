import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  SweepstakesService,
  type CreateSweepstakeInput,
  type PrizeInput,
  type UpdateInput,
  type ParticipantInput,
  type DrawInput,
  type PrizeResultInput,
} from "./sweepstakes.service";

interface AuthUser {
  id: string;
}

@Controller("sweepstakes")
export class SweepstakesController {
  constructor(private readonly sweepstakes: SweepstakesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateSweepstakeInput,
  ) {
    return this.sweepstakes.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.sweepstakes.list(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sweepstakes.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateInput,
  ) {
    return this.sweepstakes.update(user.id, id, body);
  }

  @Put(":id/prizes")
  savePrizes(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { prizes: PrizeInput[] },
  ) {
    return this.sweepstakes.savePrizes(user.id, id, body.prizes);
  }

  @Patch(":id/participants/:pid")
  updateParticipant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("pid") pid: string,
    @Body() body: ParticipantInput,
  ) {
    return this.sweepstakes.updateParticipant(user.id, id, pid, body);
  }

  @Delete(":id/participants/:pid")
  removeParticipant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("pid") pid: string,
  ) {
    return this.sweepstakes.removeParticipant(user.id, id, pid);
  }

  @Post(":id/draw")
  draw(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: DrawInput,
  ) {
    return this.sweepstakes.draw(user.id, id, body);
  }

  @Patch(":id/prizes/:categoryId/result")
  setPrizeResult(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("categoryId") categoryId: string,
    @Body() body: PrizeResultInput,
  ) {
    return this.sweepstakes.setPrizeResult(user.id, id, categoryId, body);
  }

  @Patch(":id/prize-results/:resultId")
  setPrizePaidOut(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("resultId") resultId: string,
    @Body() body: { paidOut: boolean },
  ) {
    return this.sweepstakes.setPrizePaidOut(user.id, id, resultId, !!body.paidOut);
  }
}
