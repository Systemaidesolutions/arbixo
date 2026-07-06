import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/currentUser";
import { sendVoucherEmail } from "@/lib/mail";

// Emails one or more voucher codes to an address the admin enters.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const codes = Array.isArray(body?.codes)
    ? body.codes.filter((c: unknown): c is string => typeof c === "string" && c.length > 0)
    : [];
  const note = typeof body?.note === "string" ? body.note : null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (codes.length === 0) {
    return NextResponse.json({ error: "No voucher codes to send." }, { status: 400 });
  }

  const { sent } = await sendVoucherEmail(email, codes, note);
  if (!sent) {
    return NextResponse.json(
      { error: "Email couldn't be sent (delivery not configured). The codes are recorded in the server logs." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, sent: codes.length });
}
