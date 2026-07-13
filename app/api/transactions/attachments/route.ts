import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRecord } from "@/lib/currentUser";
import { listAttachments } from "@/lib/transactionAttachments";
import type { JournalType } from "@prisma/client";

// Attachment metadata (no bytes) for a set of document nos, so the transaction
// list can show 📎 links.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user?.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const journalType = request.nextUrl.searchParams.get("journalType") as JournalType | null;
  const docs = (request.nextUrl.searchParams.get("documentNos") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!journalType) return NextResponse.json({ error: "journalType is required" }, { status: 400 });

  const attachments = await listAttachments(user.companyId, journalType, docs);
  return NextResponse.json({ attachments });
}
