import { Controller, Get, Post, Put, Body, Param } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  SweepstakesService,
  type CreateSweepstakeInput,
  type PrizeInput,
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

  @Put(":id/prizes")
  savePrizes(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { prizes: PrizeInput[] },
  ) {
    return this.sweepstakes.savePrizes(user.id, id, body.prizes);
  }
}
