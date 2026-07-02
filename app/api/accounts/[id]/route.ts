import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AccountClassification, NormalBalance } from "@prisma/client";

// Walks upward from candidateParentId toward the root, looking for
// accountId. Used to block reparenting an account under one of its own
// descendants, which would create a cycle the tree-builder can't resolve.
async function isDescendant(candidateParentId: string, accountId: string): Promise<boolean> {
  let current = await prisma.account.findUnique({ where: { id: candidateParentId } });
  while (current) {
    if (current.id === accountId) return true;
    if (!current.parentAccountId) return false;
    current = await prisma.account.findUnique({ where: { id: current.parentAccountId } });
  }
  return false;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: { children: true, parent: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ account });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const {
    code,
    title,
    classification,
    normalBalance,
    isActive,
    parentAccountId,
    openingBalance,
    openingBalanceDate,
  } = body ?? {};

  if (code && code !== account.code) {
    const duplicate = await prisma.account.findUnique({
      where: { companyId_code: { companyId: account.companyId, code } },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Account code "${code}" is already in use` }, { status: 409 });
    }
  }

  if (parentAccountId !== undefined && parentAccountId !== account.parentAccountId) {
    if (parentAccountId === account.id) {
      return NextResponse.json({ error: "An account cannot be its own parent" }, { status: 400 });
    }
    if (parentAccountId) {
      const parent = await prisma.account.findUnique({ where: { id: parentAccountId } });
      if (!parent || parent.companyId !== account.companyId) {
        return NextResponse.json({ error: "Parent account not found in this company" }, { status: 400 });
      }
      if (await isDescendant(parentAccountId, account.id)) {
        return NextResponse.json(
          { error: "Can't move an account under one of its own sub-accounts" },
          { status: 400 }
        );
      }
    }
  }

  const updated = await prisma.account.update({
    where: { id: params.id },
    data: {
      code: code ?? undefined,
      title: title ?? undefined,
      classification: (classification as AccountClassification) ?? undefined,
      normalBalance: (normalBalance as NormalBalance) ?? undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      parentAccountId: parentAccountId === undefined ? undefined : parentAccountId,
      openingBalance: openingBalance ?? undefined,
      openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : undefined,
    },
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const [childCount, entryCount] = await Promise.all([
    prisma.account.count({ where: { parentAccountId: params.id } }),
    prisma.ledgerEntry.count({ where: { accountId: params.id } }),
  ]);

  if (childCount > 0) {
    return NextResponse.json(
      { error: "This account has sub-accounts. Reassign or delete them first." },
      { status: 409 }
    );
  }
  if (entryCount > 0) {
    return NextResponse.json(
      { error: "This account has posted ledger entries and can't be deleted. Deactivate it instead." },
      { status: 409 }
    );
  }

  await prisma.account.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
