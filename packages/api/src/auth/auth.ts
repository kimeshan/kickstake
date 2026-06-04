import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "../db";
import { sendOtpEmail } from "../email/email";

const isProduction = process.env.NODE_ENV === "production";

// Google SSO is only wired up when credentials are present, so the API still
// boots locally without them (email-code sign-in works on its own).
const socialProviders: Record<string, { clientId: string; clientSecret: string }> =
  {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

// Organisers authenticate with an emailed one-time code or Google — no
// passwords anywhere (spec §1). Participants need no account; they join a
// sweepstake by token + display name via public endpoints.
//
// NOTE: nest emits JS only (declaration:false in tsconfig). That's required —
// declaration emit fails with TS2742 because the plugin types reference zod
// internals via a pnpm path. Do not flip declaration back on for this package.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  basePath: "/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.CORS_ORIGIN?.split(",") ?? [
    "http://localhost:3800",
  ],
  socialProviders,
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      async sendVerificationOTP({ email, otp, type }) {
        // Sends via Resend when RESEND_API_KEY is set; logs to console in dev.
        await sendOtpEmail({ email, otp, type });
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session every 24h
  },
  advanced: {
    cookiePrefix: "better-auth",
    defaultCookieAttributes: {
      sameSite: "lax" as const,
      secure: isProduction,
      path: "/",
    },
  },
});
