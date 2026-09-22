import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { challengeError } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Exact-match allowlist — same list that drives CORS + Better Auth. */
export function trustedOrigins(): string[] {
  return (process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3800"])
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * CSRF defence for challenge mutations, on top of session + membership
 * checks. The session cookie is scoped to `.kickstake.app`, so a sibling
 * subdomain counts as "same-site" and SameSite=Lax alone isn't enough.
 *
 * Browsers always send Origin on non-GET fetches; when present it must be an
 * exact allowlisted origin. Without Origin (non-browser clients such as the
 * test harness) a browser-supplied `Sec-Fetch-Site: cross-site` is still
 * rejected.
 */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.headers["origin"];
    if (typeof origin === "string" && origin) {
      if (!trustedOrigins().includes(origin)) throw challengeError(403, "untrusted_origin");
      return true;
    }
    if (req.headers["sec-fetch-site"] === "cross-site")
      throw challengeError(403, "untrusted_origin");
    return true;
  }
}
