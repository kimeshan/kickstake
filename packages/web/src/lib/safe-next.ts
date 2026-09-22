/**
 * Validates a post-sign-in return path from `?next=`. Only same-origin paths
 * under approved prefixes are allowed — never absolute or protocol-relative
 * URLs (open-redirect defence). Anything else falls back to `fallback`.
 */
const ALLOWED_PREFIXES = ["/challenges", "/dashboard"];

export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || typeof raw !== "string") return fallback;
  // Must be a single-slash absolute path; reject "//host", "/\host" and schemes.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, "http://local.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://local.invalid") return fallback;
  const ok = ALLOWED_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
  );
  return ok ? `${url.pathname}${url.search}` : fallback;
}

/** Login URL that returns to `path` after sign-in. */
export const loginWithNext = (path: string) => `/login?next=${encodeURIComponent(path)}`;
