/**
 * Uses Resend (resend.com) if RESEND_API_KEY is set. If not, falls back
 * to logging the code to the server console — this means registration
 * works out of the box in local development without any email account,
 * at the cost of not actually sending anything. Never let this fallback
 * fail silently: it always prints loudly so it's obvious in a real
 * deployment that email isn't actually configured yet.
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      `[mail] RESEND_API_KEY is not set — verification email NOT sent. ` +
        `For ${email}, the verification code is: ${code}`
    );
    return;
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
    throw new Error(`Failed to send verification email (${res.status}): ${body}`);
  }
}
