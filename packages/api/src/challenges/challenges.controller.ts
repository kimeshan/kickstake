import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { ChallengesService } from "./challenges.service";
import { RateLimiter, clientKey } from "./rate-limit";
import { TrustedOriginGuard } from "./trusted-origin.guard";

interface AuthUser {
  id: string;
}

// Nest paths are /challenges/* — the browser reaches them at /api/challenges/*
// through the web app's rewrite. Every response is per-user: never cache.
const NO_STORE = "private, no-store";

// Previews are public → keyed by client IP. Joins require a session → keyed
// by account, so everyone behind the same proxy hop isn't throttled together.
const invitationViews = new RateLimiter(120, 60_000);
const joins = new RateLimiter(20, 60_000);

@Controller("challenges")
@UseGuards(TrustedOriginGuard)
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Public()
  @Get("invitations/:token")
  @Header("Cache-Control", NO_STORE)
  async invitation(@Param("token") token: string, @Req() req: Request) {
    invitationViews.hit(clientKey(req));
    // Optional session: lets a returning member skip straight to progress.
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return this.challenges.invitation(token, session?.user.id ?? null);
  }

  @Post("invitations/:token/join")
  @HttpCode(200)
  @Header("Cache-Control", NO_STORE)
  join(
    @CurrentUser() user: AuthUser,
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    joins.hit(user.id);
    return this.challenges.join(user.id, token, body);
  }

  @Get("mine")
  @Header("Cache-Control", NO_STORE)
  mine(@CurrentUser() user: AuthUser) {
    return this.challenges.mine(user.id);
  }

  @Get(":id")
  @Header("Cache-Control", NO_STORE)
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.challenges.detail(user.id, id);
  }

  @Get(":id/me")
  @Header("Cache-Control", NO_STORE)
  me(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.challenges.me(user.id, id);
  }

  @Patch(":id/me")
  @Header("Cache-Control", NO_STORE)
  updateMe(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.challenges.updateMe(user.id, id, body);
  }

  @Put(":id/me/weeks/:week")
  @Header("Cache-Control", NO_STORE)
  saveWeek(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("week") week: string,
    @Body() body: unknown,
  ) {
    return this.challenges.saveMyWeek(user.id, id, week, body);
  }

  @Get(":id/standings")
  @Header("Cache-Control", NO_STORE)
  standings(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("week") week: unknown) {
    return this.challenges.standings(user.id, id, week);
  }

  @Get(":id/manage")
  @Header("Cache-Control", NO_STORE)
  manage(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.challenges.manage(user.id, id);
  }

  @Patch(":id/settings")
  @Header("Cache-Control", NO_STORE)
  settings(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.challenges.updateSettings(user.id, id, body);
  }

  @Post(":id/invitation/rotate")
  @HttpCode(200)
  @Header("Cache-Control", NO_STORE)
  rotate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.challenges.rotateInvitation(user.id, id);
  }

  @Patch(":id/members/:memberId")
  @Header("Cache-Control", NO_STORE)
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
  ) {
    return this.challenges.updateMember(user.id, id, memberId, body);
  }

  @Put(":id/members/:memberId/weeks/:week")
  @Header("Cache-Control", NO_STORE)
  correctWeek(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Param("week") week: string,
    @Body() body: unknown,
  ) {
    return this.challenges.correctMemberWeek(user.id, id, memberId, week, body);
  }

  @Get(":id/export.csv")
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const csv = await this.challenges.exportCsv(user.id, id);
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="challenge-${id}.csv"`,
        "Cache-Control": NO_STORE,
      })
      .send(csv);
  }

  @Get(":id/summary")
  @Header("Cache-Control", NO_STORE)
  summary(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("week") week: unknown) {
    return this.challenges.summary(user.id, id, week);
  }
}
