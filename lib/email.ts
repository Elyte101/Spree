import { Resend } from "resend";

// STEP 2 (2026-07-10 email flow assessment): bound well under the Next
// proxy's 15s AbortSignal.timeout (lib/serverApi.ts) so a slow Resend API
// call can never itself cause an upstream timeout — this send is now also
// reachable from signup, not just the logged-in "resend verification"
// route. The Resend JS SDK's typed options don't expose a `signal`/timeout
// (only `headers`/`idempotencyKey`), so this is enforced with a manual race
// instead of relying on the SDK. Also called (sequentially, after a
// token-generation call) from signup — leaves headroom under a Vercel
// function's own execution-time limit (e.g. 10s on the Hobby plan).
const RESEND_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function sendVerificationEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping verification email");
    return;
  }

  const resend = new Resend(apiKey);
  // 2026-07-10 email flow assessment: this used to default to a different
  // domain (spree.market) than the backend (spree.com) — neither was a
  // verified Resend domain, so one send path silently failed on every call.
  // Both now default to Resend's sandbox sender; EMAIL_FROM must be set to
  // the SAME value here and in the backend once a real domain is verified.
  const FROM = process.env.EMAIL_FROM ?? "Spree <onboarding@resend.dev>";
  const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;

  try {
    const response = await withTimeout(
      resend.emails.send({
        from: FROM,
        to: email,
        subject: "Verify your Spree account",
        html: _verificationEmailHtml(verifyUrl),
      }),
      RESEND_TIMEOUT_MS,
      "Resend verification email send"
    );
    console.log(
      "[email] verification email sent",
      JSON.stringify({ email_status: "sent", resend_message: response.data?.id ?? null })
    );
    return response;
  } catch (err) {
    console.error(
      "[email] verification email failed",
      JSON.stringify({ email_status: "failed", error: err instanceof Error ? err.message : String(err) })
    );
    throw err;
  }
}

function _verificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#F5F4FF;font-family:'Rubik',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4FF;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(101,90,255,0.10);">
          <tr>
            <td style="background:#655AFF;padding:28px 40px;text-align:center;">
              <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;">Spree</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0F0E1A;letter-spacing:-0.02em;">
                Verify your email
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#5B5675;line-height:1.6;">
                Thanks for joining Spree! Click the button below to confirm your email address and activate your account.
              </p>
              <a href="${verifyUrl}"
                 style="display:inline-block;background:#655AFF;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">
                Verify email address
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:#9B96B8;line-height:1.6;">
                This link expires in 24 hours. If you didn't create a Spree account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F0EEFF;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9B96B8;">
                © ${new Date().getFullYear()} Spree &mdash; Ghana's trusted marketplace
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
