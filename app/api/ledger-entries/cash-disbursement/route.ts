import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeVat, computeWithholding } from "@/lib/vat";
import {
  postDocument,
  DuplicateDocumentError,
  UnbalancedEntryError,
  type LedgerLineInput,
} from "@/lib/ledgerPosting";
import type { CounterpartyType, VatType } from "@prisma/client";

type InputLine = {
  accountId: string;
  amount: number;
  description?: string | null;
  vatType?: VatType | null;
  amountIsGross?: boolean;
  atcCodeId?: string | null;
};

type RequestBody = {
  companyId: string;
  locationId?: string | null;
  documentNo: string;
  checkNo?: string | null;
  postingDate: string;
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
  cashAccountId: string;
  particulars?: string | null;
  lines: InputLine[];
};

function counterpartyFields(body: RequestBody) {
  if (!body.counterpartyType || !body.counterpartyId) {
    return { counterpartyType: null, customerId: null, vendorId: null, employeeId: null, contactId: null };
  }
  return {
    counterpartyType: body.counterpartyType,
    customerId: body.counterpartyType === "CUSTOMER" ? body.counterpartyId : null,
    vendorId: body.counterpartyType === "VENDOR" ? body.counterpartyId : null,
    employeeId: body.counterpartyType === "EMPLOYEE" ? body.counterpartyId : null,
    contactId: body.counterpartyType === "CONTACT" ? body.counterpartyId : null,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RequestBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { companyId, documentNo, cashAccountId, postingDate, lines } = body;
  if (!companyId || !documentNo || !cashAccountId || !postingDate || !lines?.length) {
    return NextResponse.json(
      { error: "companyId, documentNo, cashAccountId, postingDate, and at least one line are required" },
      { status: 400 }
    );
  }

  // Only fetch Tax Posting Setup + ATC rates if this document actually
  // needs them — most General Journal-style sundry lines won't.
  const needsVatSetup = lines.some((l) => l.vatType && l.vatType !== "NON_VAT");
  const atcCodeIds = [...new Set(lines.map((l) => l.atcCodeId).filter(Boolean))] as string[];

  const [taxSetup, atcCodes] = await Promise.all([
    needsVatSetup || atcCodeIds.length
      ? prisma.taxPostingSetup.findUnique({ where: { companyId } })
      : Promise.resolve(null),
    atcCodeIds.length
      ? prisma.atcCode.findMany({ where: { id: { in: atcCodeIds } } })
      : Promise.resolve([]),
  ]);
  const atcById = new Map(atcCodes.map((a) => [a.id, a]));

  const counterparty = counterpartyFields(body);
  const glLines: LedgerLineInput[] = [];
  let totalDebit = 0;
  let totalWithholdingCredit = 0;

  for (const line of lines) {
    const vatType = line.vatType ?? null;
    const vat = vatType
      ? computeVat({ vatType, amount: line.amount, amountIsGross: line.amountIsGross ?? true })
      : { grossAmount: line.amount, netAmount: line.amount, vatAmount: 0 };

    const atc = line.atcCodeId ? atcById.get(line.atcCodeId) : null;
    const withholdingAmt = atc ? computeWithholding(vat.netAmount, Number(atc.ratePercent)) : 0;

    // Main line — always the Net amount, never Gross. The Gross figure
    // only exists as metadata for BIR reporting; the actual GL account
    // (Purchases, an expense, a fixed asset, etc.) should never carry
    // the VAT-inclusive amount, or the trial balance would double-count
    // VAT once the companion Input VAT line is added below.
    glLines.push({
      accountId: line.accountId,
      debitAmount: vat.netAmount,
      description: line.description ?? body.particulars ?? null,
      ...counterparty,
      vatType,
      grossAmount: vatType ? vat.grossAmount : null,
      netAmount: vatType ? vat.netAmount : null,
      vatAmount: vatType ? vat.vatAmount : null,
      atcCode: atc?.code ?? null,
      atcDescription: atc?.description ?? null,
      withholdingAmt: withholdingAmt || null,
    });
    totalDebit += vat.netAmount;

    if (vat.vatAmount > 0) {
      if (!taxSetup?.inputVatAccountId) {
        return NextResponse.json(
          {
            error:
              "This line has VAT but no Input VAT account is configured. Set one at Company → Tax Posting Setup first.",
          },
          { status: 400 }
        );
      }
      glLines.push({
        accountId: taxSetup.inputVatAccountId,
        debitAmount: vat.vatAmount,
        description: `Input VAT — ${body.documentNo}`,
      });
      totalDebit += vat.vatAmount;
    }

    if (withholdingAmt > 0) {
      if (!taxSetup?.withholdingTaxPayableAccountId) {
        return NextResponse.json(
          {
            error:
              "This line has withholding tax but no Withholding Tax Payable account is configured. Set one at Company → Tax Posting Setup first.",
          },
          { status: 400 }
        );
      }
      glLines.push({
        accountId: taxSetup.withholdingTaxPayableAccountId,
        creditAmount: withholdingAmt,
        description: `Withholding tax (${atc?.code}) — ${body.documentNo}`,
      });
      totalWithholdingCredit += withholdingAmt;
    }
  }

  // Balancing line: whatever's left after withholding is deducted is
  // what actually leaves the bank/cash account. This is the manual's
  // "Cash Amount" auto-computed balancing figure, made explicit.
  const cashAmount = Math.round((totalDebit - totalWithholdingCredit) * 100) / 100;
  if (cashAmount <= 0) {
    return NextResponse.json(
      { error: "Computed cash amount is zero or negative — check the line amounts." },
      { status: 400 }
    );
  }
  glLines.push({
    accountId: cashAccountId,
    creditAmount: cashAmount,
    description: body.particulars ?? null,
    checkNo: body.checkNo ?? null,
    ...counterparty,
  });

  try {
    const created = await postDocument({
      companyId,
      locationId: body.locationId ?? null,
      journalType: "CASH_DISBURSEMENT",
      documentType: "PAYMENT",
      documentNo,
      postingDate: new Date(postingDate),
      lines: glLines,
    });
    return NextResponse.json({ entries: created, cashAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof UnbalancedEntryError || err instanceof DuplicateDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
