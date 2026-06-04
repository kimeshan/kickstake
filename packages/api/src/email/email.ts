import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// Must be a verified Resend domain in production. resend.dev only delivers to
// the Resend account owner, which is fine for early testing.
const from = process.env.EMAIL_FROM ?? "KickStake <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

type OtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

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
        <div style="color:#5a6452;font-size:12px;margin-top:20px;">Tracking-only. KickStake never processes payments.</div>
      </td></tr>
    </table>
  </body>
</html>`;
}
