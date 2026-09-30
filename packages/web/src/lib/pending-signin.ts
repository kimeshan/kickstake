/**
 * Remembers that a sign-in code was just emailed, so switching to the mail
 * app and back doesn't drop the person on the "enter your email" step.
 *
 * Mobile browsers routinely discard and reload a background tab, which wipes
 * React state. This survives that reload (and a deliberate refresh), and
 * expires with the code itself.
 */
const KEY = "kickstake.pending-signin";

/** Matches the OTP lifetime in packages/api/src/auth/auth.ts. */
export const PENDING_SIGNIN_TTL_MS = 10 * 60 * 1000;

export interface PendingSignin {
  email: string;
  sentAt: number;
}

/** Storage can throw (private mode, blocked cookies) — never break sign-in. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readPendingSignin(raw: string | null, now = Date.now()): PendingSignin | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSignin>;
    if (typeof parsed?.email !== "string" || typeof parsed?.sentAt !== "number") return null;
    if (!parsed.email || now - parsed.sentAt > PENDING_SIGNIN_TTL_MS) return null;
    return { email: parsed.email, sentAt: parsed.sentAt };
  } catch {
    return null;
  }
}

export function savePendingSignin(email: string) {
  safe(() => {
    localStorage.setItem(KEY, JSON.stringify({ email, sentAt: Date.now() }));
    // Same-tab listeners: `storage` only fires in other tabs.
    window.dispatchEvent(new Event(PENDING_SIGNIN_EVENT));
  }, undefined);
}

export function clearPendingSignin() {
  safe(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(PENDING_SIGNIN_EVENT));
  }, undefined);
}

export const PENDING_SIGNIN_EVENT = "kickstake:pending-signin";

export function subscribePendingSignin(onChange: () => void) {
  window.addEventListener(PENDING_SIGNIN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PENDING_SIGNIN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function pendingSigninSnapshot(): string | null {
  return safe(() => localStorage.getItem(KEY), null);
}
