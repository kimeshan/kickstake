/**
 * Brand + app-wide constants (web). Single source of truth for things that
 * aren't environment secrets: name, domain, contact email, share links.
 *
 * Runtime base URLs (which differ per environment) come from env vars —
 * everything brand-level lives here.
 */

export const APP_NAME = "KickStake";
export const DOMAIN = "kickstake.app";
export const TAGLINE = "The group sweepstake, sorted.";
export const DESCRIPTION =
  "Create a football tournament sweepstake, share a link, and let KickStake run the draw and the prizes for you.";

/** Environment-aware base URL for building shareable links (e.g. join links). */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? `https://${DOMAIN}`;

export const EMAIL = {
  /** Public-facing contact / support address. */
  contact: "hello@kickstake.app",
  /** Transactional "from" address (sign-in codes, notifications). */
  noreply: "noreply@kickstake.app",
} as const;

/** Participant join link, e.g. https://kickstake.app/j/abc123 (spec §3.2). */
export const joinUrl = (token: string) => `${APP_URL}/j/${token}`;

/** Open-source repo + maker (free & open source ❤️). */
export const GITHUB_URL = "https://github.com/kimeshan/kickstake";
export const MAKER = {
  name: "Kimeshan Naidoo",
  url: "https://github.com/kimeshan",
};
