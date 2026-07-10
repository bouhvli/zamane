import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM_ADDRESS = process.env.MAIL_FROM ?? "Zamane <onboarding@resend.dev>";

/**
 * Sends the password-reset email via Resend when RESEND_API_KEY is
 * configured. Otherwise falls back to logging the link to the server
 * console — callers decide whether to also surface it in the API
 * response (dev-only, see api/auth/forgot-password.ts).
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  if (!resend) {
    console.log(`[dev] password reset link for ${email}: ${resetLink}`);
    return;
  }

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Reset your Zamane password",
    html: `
      <p>We received a request to reset your Zamane password.</p>
      <p><a href="${resetLink}">Click here to choose a new password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

export function isEmailConfigured(): boolean {
  return resend !== null;
}
