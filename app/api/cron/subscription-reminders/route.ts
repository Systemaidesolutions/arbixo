import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/currentUser";
import { setAuditSuppressed } from "@/lib/auditContext";
import { sendSubscriptionReminderEmail } from "@/lib/mail";
import { subscriptionStatus, RENEW_WINDOW_DAYS } from "@/lib/subscription";

// Runs daily via Vercel Cron. Emails admins + each company's registered/
// billing addresses when a subscription is within the renew window and no
// reminder has been sent for the current period. Admins can also trigger
// it manually. Set CRON_SECRET in Vercel to authorize the scheduled run.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  const admin = authorized ? null : await getAdminUser().catch(() => null);
  if (!authorized && !admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + RENEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [companies, admins] = await Promise.all([
    prisma.company.findMany({
      where: {
        subscriptionEndsAt: { gte: now, lte: windowEnd },
        subscriptionReminderSentAt: null,
      },
      include: { users: { select: { email: true } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } }),
  ]);

  const adminEmails = admins.map((a) => a.email);

  // Flag updates shouldn't spam the audit trail.
  setAuditSuppressed(true);
  let remindersSent = 0;
  try {
    for (const c of companies) {
      if (!c.subscriptionEndsAt) continue;
      const endsOn = c.subscriptionEndsAt.toISOString().slice(0, 10);
      const { daysLeft } = subscriptionStatus(c.subscriptionEndsAt, now);
      const recipients = Array.from(
        new Set(
          [
            ...adminEmails,
            ...(c.billingEmail ? [c.billingEmail] : []),
            ...c.users.map((u) => u.email),
          ].filter(Boolean)
        )
      );
      await sendSubscriptionReminderEmail(recipients, c.tradeName, endsOn, daysLeft ?? 0);
      await prisma.company.update({
        where: { id: c.id },
        data: { subscriptionReminderSentAt: now },
      });
      remindersSent++;
    }
  } finally {
    setAuditSuppressed(false);
  }

  return NextResponse.json({ ok: true, remindersSent });
}
