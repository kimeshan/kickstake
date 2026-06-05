import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { sendSupportEmail } from "../email/email";

interface TournamentRequest {
  tournamentName?: string;
  email?: string;
  note?: string;
}

@Controller("support")
export class SupportController {
  // Public — usable from the marketing site and the create wizard.
  @Public()
  @Post("tournament-request")
  async tournamentRequest(@Body() body: TournamentRequest) {
    const name = body.tournamentName?.trim();
    if (!name) throw new BadRequestException("Tournament name is required.");
    const email = body.email?.trim();
    await sendSupportEmail({
      subject: `Tournament request: ${name}`,
      body: [
        `Tournament: ${name}`,
        `From: ${email || "(no email given)"}`,
        "",
        body.note?.trim() || "(no note)",
      ].join("\n"),
      replyTo: email || undefined,
    });
    return { ok: true };
  }
}
