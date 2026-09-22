/**
 * Brand + app-wide constants (api). Mirrors the brand values in
 * packages/web/src/lib/constants.ts. Keep the two in sync — these are stable
 * (domain, emails), so the small duplication beats wiring a shared build
 * package through the Docker/runtime setup.
 */

export const APP_NAME = "KickStake";
export const DOMAIN = "kickstake.app";

/** Environment-aware base URL (for links in emails, etc.). */
export const APP_URL = process.env.APP_URL ?? `https://${DOMAIN}`;

/** Public-facing contact / support address. */
export const CONTACT_EMAIL = "hello@kickstake.app";

/** Default transactional "from" when EMAIL_FROM isn't set. */
export const DEFAULT_EMAIL_FROM = `${APP_NAME} <${CONTACT_EMAIL}>`;

/**
 * Public base URL of the challenge experience — used to build invitation
 * links. Deliberately separate from APP_URL (the football app). Prod:
 * https://challenge.kickstake.app
 */
export const CHALLENGE_APP_URL =
  process.env.CHALLENGE_APP_URL ?? `https://challenge.${DOMAIN}`;

export const challengeInviteUrl = (token: string) =>
  `${CHALLENGE_APP_URL}/challenges/join/${token}`;
