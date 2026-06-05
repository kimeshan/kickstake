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
