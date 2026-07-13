import { prisma } from "@/lib/prisma";
import type { JournalType } from "@prisma/client";

// Files attached to a posted transaction, stored as base64 data URLs (like
// company logos) keyed by journal + document no. Cap size so the DB row and the
// app payload stay sane.
export type AttachmentInput = { fileName: string; contentType?: string | null; sizeBytes?: number; data: string };

const MAX_DATA_LEN = 4_500_000; // base64 length (~3.3 MB raw)
const MAX_FILES = 10;

export async function saveAttachments(
  companyId: string,
  journalType: JournalType,
  documentNo: string,
  files: AttachmentInput[] | undefined,
  userId?: string
): Promise<void> {
  const valid = (files ?? []).filter((f) => f && typeof f.data === "string" && f.data.startsWith("data:") && f.fileName).slice(0, MAX_FILES);
  for (const f of valid) {
    if (f.data.length > MAX_DATA_LEN) continue; // too large — skip (client validates first)
    await prisma.transactionAttachment.create({
      data: {
        companyId,
        journalType,
        documentNo,
        fileName: f.fileName.slice(0, 255),
        contentType: f.contentType ?? null,
        sizeBytes: f.sizeBytes ?? null,
        data: f.data,
        uploadedById: userId ?? null,
      },
    });
  }
}

/** Metadata (no file bytes) for the given documents, grouped by document no. */
export async function listAttachments(companyId: string, journalType: JournalType, documentNos: string[]) {
  if (documentNos.length === 0) return {} as Record<string, { id: string; fileName: string; contentType: string | null; sizeBytes: number | null }[]>;
  const rows = await prisma.transactionAttachment.findMany({
    where: { companyId, journalType, documentNo: { in: documentNos } },
    select: { id: true, documentNo: true, fileName: true, contentType: true, sizeBytes: true },
    orderBy: { createdAt: "asc" },
  });
  const map: Record<string, { id: string; fileName: string; contentType: string | null; sizeBytes: number | null }[]> = {};
  for (const r of rows) (map[r.documentNo] ??= []).push({ id: r.id, fileName: r.fileName, contentType: r.contentType, sizeBytes: r.sizeBytes });
  return map;
}
