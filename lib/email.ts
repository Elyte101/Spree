import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Spree <noreply@spree.market>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your Spree account",
    html: `
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
</html>`,
  });
}
