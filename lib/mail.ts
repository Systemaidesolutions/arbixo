// The branded cover banner used on the manuals/NDA/Subscription Agreement
// title pages, reused here as an email header — hosted at a fixed,
// permanent URL (not attached inline) since most email clients block
// inline/base64 images. Always the production domain, even when a UAT
// deploy sends the email, since the banner itself isn't environment-specific.
const EMAIL_BANNER_HTML =
  '<img src="https://www.arbixo.net/email-banner.jpg" alt="ARbixo — Accounting Intelligence. Business Excellence." width="600" style="display:block; width:100%; max-width:600px; height:auto; border-radius:8px 8px 0 0;" />';

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

/**
 * Subscription renewal reminder, sent ~1 week before a company's
 * subscription ends. `to` is the combined recipient list (admins + the
 * company's registered/billing emails). Always logged; sent via Resend
 * when configured.
 */
export async function sendSubscriptionReminderEmail(
  to: string[],
  companyName: string,
  endsOn: string,
  daysLeft: number
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  console.log(
    `[mail] Subscription reminder for "${companyName}" (ends ${endsOn}, ${daysLeft}d) -> ${to.join(", ")}`
  );

  if (!apiKey || to.length === 0) {
    if (!apiKey) console.warn("[mail] RESEND_API_KEY not set — reminder not sent, only logged.");
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `Arbixo subscription for ${companyName} renews soon`,
      html: `
        <div style="font-family: sans-serif; max-width: 460px; margin: 0 auto;">
          <h2 style="color: #0B2A5E;">Subscription renewal reminder</h2>
          <p>The Arbixo subscription for <strong>${companyName}</strong> ends on
          <strong>${endsOn}</strong> (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).</p>
          <p>Please renew to avoid interruption. Access continues even if it lapses, until an
          administrator disables the account.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the reminder (${res.status}): ${body}`);
    return { sent: false };
  }
  return { sent: true };
}

/**
 * Best-effort internal alert for when a welcome email (company or user)
 * couldn't be delivered, so the admin who triggered it knows to follow up
 * manually — e.g. relay the temp password themselves. Deliberately silent
 * (no console noise, no thrown error) when RESEND_API_KEY isn't set at all,
 * since in that case this send would fail for the exact same reason as the
 * one it's reporting on, and the original failure is already logged.
 */
export async function sendAdminFailureAlert(adminEmail: string, subject: string, detail: string): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";
  if (!apiKey) return { sent: false };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: adminEmail,
      subject: `[Arbixo] ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 460px; margin: 0 auto;">
          <h2 style="color: #B91C1C;">Email delivery failed</h2>
          <p>${detail}</p>
          <p style="color: #666; font-size: 13px;">Check Vercel's function logs (search "[mail]") for the full error from Resend.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the admin failure alert too (${res.status}): ${body}`);
    return { sent: false };
  }
  return { sent: true };
}

/**
 * Sent when an admin creates a new company, to the company's own contact
 * email (Company.email) if one was given — that field is optional, so the
 * caller should skip this entirely when it's blank rather than call in with
 * an empty string. Always logged; sent via Resend when configured.
 */
export async function sendCompanyWelcomeEmail(
  companyEmail: string,
  companyName: string
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  console.log(`[mail] Company welcome email for "${companyName}" -> ${companyEmail}`);

  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — company welcome email not sent, only logged.");
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: companyEmail,
      subject: `Welcome to Arbixo, ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          ${EMAIL_BANNER_HTML}
          <div style="padding: 24px 8px 8px;">
            <h2 style="color: #0B2A5E; margin-top: 0;">Welcome to Arbixo</h2>
            <p><strong>${companyName}</strong> has been set up on Arbixo, your cloud accounting platform for Philippine businesses.</p>
            <p>An administrator will be in touch to finish setting up your users and get your books started. In the meantime, you can reach us any time at
            <a href="mailto:info@arbixo.net">info@arbixo.net</a>.</p>
            <p style="color: #666; font-size: 13px;">Accounting Intelligence. Business Excellence. — Systemaide Solutions Inc.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the company welcome email (${res.status}): ${body}`);
    return { sent: false };
  }
  return { sent: true };
}

/**
 * Sent when an admin creates a new user account, to the user's own email and
 * — when the user is assigned to a company with a contact email on file —
 * also to that company's email, as a heads-up that a new account now has
 * access. `to` is the combined recipient list; the caller decides who's on
 * it. Includes the temporary password so the admin doesn't have to relay it
 * by hand. Always logged; sent via Resend when configured.
 */
export async function sendUserWelcomeEmail(
  to: string[],
  userEmail: string,
  tempPassword: string,
  loginUrl: string,
  companyName?: string | null
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  console.log(`[mail] User welcome email for ${userEmail} (temp password included) -> ${to.join(", ")}`);

  if (!apiKey || to.length === 0) {
    if (!apiKey) console.warn("[mail] RESEND_API_KEY not set — user welcome email not sent, only logged.");
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Welcome to Arbixo — your account is ready",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          ${EMAIL_BANNER_HTML}
          <div style="padding: 24px 8px 8px;">
            <h2 style="color: #0B2A5E; margin-top: 0;">Welcome to Arbixo</h2>
            <p>An account has been created for <strong>${userEmail}</strong>${companyName ? ` on <strong>${companyName}</strong>'s Arbixo` : ""}.</p>
            <p>Sign in with:</p>
            <p style="margin: 4px 0;">Email: <strong>${userEmail}</strong></p>
            <p style="margin: 4px 0;">Temporary password: <strong style="letter-spacing: 1px;">${tempPassword}</strong></p>
            <p><a href="${loginUrl}" style="display:inline-block; background:#0B2A5E; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none;">Log in to Arbixo</a></p>
            <p style="color: #666; font-size: 13px;">You can change this password any time from your Profile page after logging in.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the user welcome email (${res.status}): ${body}`);
    return { sent: false };
  }
  return { sent: true };
}

/**
 * Emails one or more voucher codes to a recipient (admin-initiated from the
 * Vouchers page). Always logged so it's recoverable from Vercel's function logs
 * if Resend isn't configured; returns whether it actually sent.
 */
export async function sendVoucherEmail(
  email: string,
  codes: string[],
  note?: string | null
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Arbixo <onboarding@resend.dev>";

  console.log(`[mail] Voucher code(s) for ${email}: ${codes.join(", ")}`);

  if (!apiKey || codes.length === 0) {
    if (!apiKey) console.warn("[mail] RESEND_API_KEY not set — voucher email not sent, only logged.");
    return { sent: false };
  }

  const codeList = codes
    .map(
      (c) =>
        `<p style="font-size:22px; font-weight:600; letter-spacing:3px; color:#0B2A5E; margin:6px 0;">${c}</p>`
    )
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: codes.length > 1 ? "Your Arbixo voucher codes" : "Your Arbixo voucher code",
      html: `
        <div style="font-family: sans-serif; max-width: 460px; margin: 0 auto;">
          <h2 style="color: #0B2A5E;">Arbixo voucher${codes.length > 1 ? "s" : ""}</h2>
          ${note ? `<p>${note}</p>` : ""}
          <p>Use ${codes.length > 1 ? "these codes" : "this code"} on the subscription payment page:</p>
          ${codeList}
          <p style="color: #666; font-size: 13px;">Each voucher can be used once.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected the voucher email (${res.status}): ${body}`);
    return { sent: false };
  }
  return { sent: true };
}
