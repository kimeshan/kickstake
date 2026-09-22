import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require a session. Everything else is public: the landing
// page, participant join pages (/j/:token), the challenge home and challenge
// invitations (/challenges/join/:token).
const PROTECTED_PREFIXES = ["/dashboard"];

/** /challenges/<id>/… — private challenge pages (not the home, not invites). */
function isPrivateChallengePath(pathname: string) {
  const m = pathname.match(/^\/challenges\/([^/]+)(\/|$)/);
  return !!m && m[1] !== "join";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isDashboard = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isChallenge = isPrivateChallengePath(pathname);
  if (!isDashboard && !isChallenge) {
    return NextResponse.next();
  }

  // Cookie presence is only a navigation hint — the API enforces the real
  // session, membership and organiser checks on every request.
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");
  if (!sessionCookie) {
    const login = new URL("/login", request.url);
    // Challenge pages come back to where they started after sign-in; the
    // login page validates `next` again before using it.
    if (isChallenge) login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
