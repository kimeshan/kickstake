import { Resend } from "resend";
import { CONTACT_EMAIL, DEFAULT_EMAIL_FROM } from "../constants";
import { fill, reminderCopy } from "./challenge-reminder-copy";

const apiKey = process.env.RESEND_API_KEY;
// Must be a verified Resend domain in production (kickstake.app). For quick
// tests before verifying, set EMAIL_FROM to "KickStake <onboarding@resend.dev>"
// — resend.dev only delivers to the Resend account owner.
const from = process.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;

const resend = apiKey ? new Resend(apiKey) : null;

type OtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

// Test seam: under NODE_ENV=test the last OTP per email is captured here so
// integration tests can complete the real sign-in flow in-process. Never
// populated in dev or production.
export const testOtpStore = new Map<string, string>();

// Test seam: reminder emails captured instead of sent under NODE_ENV=test.
export const testReminderStore: {
  to: string;
  subject: string;
  text: string;
  locale: string;
}[] = [];

const COPY: Record<OtpType, { subject: string; lead: string }> = {
  "sign-in": {
    subject: "Your KickStake sign-in code",
    lead: "Use this code to sign in to KickStake.",
  },
  "email-verification": {
    subject: "Verify your email for KickStake",
    lead: "Use this code to verify your email.",
  },
  "forget-password": {
    subject: "Your KickStake reset code",
    lead: "Use this code to reset your account.",
  },
  "change-email": {
    subject: "Confirm your new KickStake email",
    lead: "Use this code to confirm your new email address.",
  },
};

/**
 * Sends a one-time code. When RESEND_API_KEY isn't set (local dev), the code
 * is logged to the API console instead so sign-in still works end-to-end.
 */
export async function sendOtpEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: OtpType;
}) {
  const { subject, lead } = COPY[type] ?? COPY["sign-in"];

  if (process.env.NODE_ENV === "test") {
    testOtpStore.set(email, otp);
    return;
  }

  if (!resend) {
    console.log(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        ` KickStake ${type} code for ${email}\n` +
        ` CODE:  ${otp}\n` +
        ` (RESEND_API_KEY not set — logging instead of emailing)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    html: otpHtml({ otp, lead }),
    text: `${lead}\n\nYour code: ${otp}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`,
  });

  if (error) {
    // Surface to the auth flow so the user sees "couldn't send the code".
    throw new Error(`Resend: ${error.message}`);
  }
}

/**
 * Sends a support / "request a tournament" message to the KickStake inbox.
 * Logs in dev (no key) and is a no-op in tests.
 */
export async function sendSupportEmail({
  subject,
  body,
  replyTo,
}: {
  subject: string;
  body: string;
  replyTo?: string;
}) {
  if (process.env.NODE_ENV === "test") return;
  if (!resend) {
    console.log(
      `\n[support] → ${CONTACT_EMAIL}\nSubject: ${subject}\nReply-To: ${replyTo ?? "—"}\n${body}\n`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from,
    to: CONTACT_EMAIL,
    subject,
    text: body,
    replyTo,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export interface ReminderEmail {
  to: string;
  locale: string;
  /** Display name inside the challenge. */
  name: string;
  title: string;
  weekNumber: number;
  /** Localised week range, e.g. "21–27 Sep". */
  range: string;
  /** Localised baseline, e.g. "150". */
  baseline: string;
  /** Localised final cutoff, e.g. "Mon 19 Oct, 12:00 SAST". */
  deadline: string;
  /** Deep link to the person's progress page. */
  url: string;
}

/**
 * "You haven't entered your minutes yet" nudge. Sent by the weekly job and
 * by the organiser from the dashboard. Never sent to people who have entered
 * a total or opted out — the caller decides that.
 */
export async function sendChallengeReminderEmail(input: ReminderEmail) {
  const c = reminderCopy(input.locale);
  const values = {
    title: input.title,
    n: input.weekNumber,
    range: input.range,
    name: input.name,
    baseline: input.baseline,
    deadline: input.deadline,
  };
  const subject = fill(c.subject, values);
  const text = [
    fill(c.lead, values),
    "",
    fill(c.what, values),
    "",
    input.url,
    "",
    fill(c.deadline, values),
    "",
    fill(c.optOut, values),
  ].join("\n");

  if (process.env.NODE_ENV === "test") {
    testReminderStore.push({ to: input.to, subject, text, locale: input.locale });
    return;
  }
  if (!resend) {
    console.log(`\n[challenge reminder] → ${input.to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject,
    text,
    html: reminderHtml(input, c, values),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/** Exported for preview + tests. */
export function reminderHtml(
  input: ReminderEmail,
  c: ReturnType<typeof reminderCopy>,
  values: Record<string, string | number>,
) {
  const rtl = input.locale === "ar";
  return `<!doctype html>
<html${rtl ? ' dir="rtl"' : ""}>
  <body style="margin:0;background:#070906;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070906;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#141a11;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;background:#c6f135;color:#0a0e0a;font-weight:800;font-size:22px;border-radius:10px;">K</div>
            <span style="color:#e8efe0;font-size:20px;font-weight:800;vertical-align:middle;margin-${rtl ? "right" : "left"}:8px;">${escapeHtml(input.title)}</span>
          </td></tr>
          <tr><td style="padding:8px 32px 0;color:#c6f135;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            ${escapeHtml(fill(c.heading, values))}
          </td></tr>
          <tr><td style="padding:12px 32px 0;color:#e8efe0;font-size:16px;line-height:1.5;">
            ${escapeHtml(fill(c.lead, values))}
          </td></tr>
          <tr><td style="padding:12px 32px 0;color:#8a967e;font-size:15px;line-height:1.6;">
            ${escapeHtml(fill(c.what, values))}
          </td></tr>
          <tr><td style="padding:24px 32px;">
            <a href="${escapeHtml(input.url)}" style="display:block;background:#c6f135;color:#0a0e0a;font-size:16px;font-weight:700;text-align:center;text-decoration:none;padding:16px;border-radius:14px;">${escapeHtml(c.cta)}</a>
          </td></tr>
          <tr><td style="padding:0 32px 32px;color:#8a967e;font-size:13px;line-height:1.6;">
            ${escapeHtml(fill(c.deadline, values))}
          </td></tr>
        </table>
        <div style="color:#5a6452;font-size:12px;margin-top:20px;max-width:440px;line-height:1.5;">${escapeHtml(fill(c.optOut, values))}</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function otpHtml({ otp, lead }: { otp: string; lead: string }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#070906;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070906;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#141a11;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr><td style="padding:32px 32px 8px;">
            <div style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;background:#c6f135;color:#0a0e0a;font-weight:800;font-size:22px;border-radius:10px;">K</div>
            <span style="color:#e8efe0;font-size:22px;font-weight:800;letter-spacing:-0.01em;vertical-align:middle;margin-left:8px;">KickStake</span>
          </td></tr>
          <tr><td style="padding:8px 32px 0;color:#8a967e;font-size:15px;line-height:1.5;">
            ${lead}
          </td></tr>
          <tr><td style="padding:24px 32px;">
            <div style="background:#0a0e0a;border:1px solid rgba(198,241,53,0.25);border-radius:14px;padding:20px;text-align:center;">
              <div style="color:#c6f135;font-size:40px;font-weight:800;letter-spacing:0.4em;font-family:'Courier New',monospace;">${otp}</div>
            </div>
          </td></tr>
          <tr><td style="padding:0 32px 32px;color:#8a967e;font-size:13px;line-height:1.6;">
            This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.
          </td></tr>
        </table>
        <div style="color:#5a6452;font-size:12px;margin-top:20px;">Questions? <a href="mailto:${CONTACT_EMAIL}" style="color:#8a967e;">${CONTACT_EMAIL}</a> · Tracking-only. KickStake never processes payments.</div>
      </td></tr>
    </table>
  </body>
</html>`;
}
