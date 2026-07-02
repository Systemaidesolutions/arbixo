/**
 * Uses Resend (resend.com) if RESEND_API_KEY is set. The code is ALWAYS
 * logged to the server console too, regardless of whether sending
 * succeeds — this is what makes a misconfigured/restricted email setup
 * recoverable (check Vercel's function logs) instead of leaving someone
 * stuck mid-registration with no way to get their code.
 *
 * Returns whether the email actually sent, rather than throwing —
 * registration should still succeed even if email delivery fails, since
 * the code is recoverable from logs either way.
 */
export async function sendVerificationEmail(email: string, code: string): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  // Always logged — this is the recovery path if sending fails or isn't
  // configured, not just a local-dev convenience.
  console.log(`[mail] Verification code for ${email}: ${code}`);

  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY is not set — email was not sent, only logged above.");
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Arbixo verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <h2 style="color: #0B2A5E;">Verify your Arbixo account</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 28px; font-weight: 600; letter-spacing: 4px; color: #0B2A5E;">${code}</p>
          <p style="color: #666; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // The single most common cause of "email never arrives" with Resend:
    // on an unverified sending domain (still using onboarding@resend.dev),
    // Resend's sandbox mode only delivers to the email address that owns
    // the Resend account itself — every other recipient is silently
    // rejected with a 403. Verifying a real domain in the Resend
    // dashboard removes this restriction.
    console.error(
      `[mail] Resend rejected the email (${res.status}): ${body}\n` +
        `[mail] If this is a 403 and EMAIL_FROM is still onboarding@resend.dev, ` +
        `this is almost certainly Resend's sandbox restriction — in sandbox mode ` +
        `it only delivers to the email address that owns the Resend account. ` +
        `Verify a real sending domain at resend.com/domains to send to anyone else.`
    );
    return { sent: false };
  }

  return { sent: true };
}

/**
 * Sends a password-reset link. Like sendVerificationEmail, the link is
 * ALWAYS logged to the server console so a misconfigured email setup is
 * recoverable from Vercel's function logs. Returns whether it actually
 * sent, so an admin-triggered reset can surface the link directly when
 * email delivery isn't configured yet.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  console.log(`[mail] Password reset link for ${email}: ${resetUrl}`);

  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY is not set — reset email was not sent, only logged above.");
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reset your Arbixo password",
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <h2 style="color: #0B2A5E;">Reset your Arbixo password</h2>
          <p>An administrator started a password reset for your account. Click below to set a new password:</p>
          <p><a href="${resetUrl}" style="display:inline-block; background:#0B2A5E; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none;">Reset password</a></p>
          <p style="color: #666; font-size: 13px;">This link expires in 1 hour. If you didn't expect this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the reset email (${res.status}): ${body}`);
    return { sent: false };
  }

  return { sent: true };
}
