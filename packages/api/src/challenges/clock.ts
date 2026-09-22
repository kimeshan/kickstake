import { Injectable } from "@nestjs/common";

/**
 * Source of "now" for every challenge timing decision, so tests can freeze
 * server time around week boundaries and the final cutoff.
 *
 * Outside production, CHALLENGE_NOW (an ISO instant) pins the clock for
 * local QA of later phases. It is ignored in production.
 */
@Injectable()
export class ChallengeClock {
  private fixed: Date | null = null;

  now(): Date {
    if (this.fixed) return new Date(this.fixed);
    const pinned = process.env.CHALLENGE_NOW;
    if (pinned && process.env.NODE_ENV !== "production") {
      const d = new Date(pinned);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  /** Test seam: pin (or with null, release) the clock. */
  set(at: Date | string | null) {
    this.fixed = at === null ? null : new Date(at);
  }
}
