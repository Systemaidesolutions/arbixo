import { prisma } from "@/lib/prisma";
import { computeVat, computeWithholding } from "@/lib/vat";
import type { LedgerLineInput } from "@/lib/ledgerPosting";
import type { CounterpartyType, TaxSource, VatType } from "@prisma/client";

export type ExpandInputLine = {
  accountId: string;
  amount: number;
  description?: string | null;
  referenceNo?: string | null;
  vatType?: VatType | null;
  amountIsGross?: boolean;
  atcCodeId?: string | null;
  // Goods / Service / Capital Goods — BIR SLP taxable breakdown (purchases).
  taxSource?: TaxSource | null;
  // Optional per-line party (overrides the document counterparty on this line).
  counterpartyType?: CounterpartyType | null;
  counterpartyId?: string | null;
};

export type CounterpartyFields = Pick<
  LedgerLineInput,
  "counterpartyType" | "customerId" | "vendorId" | "employeeId" | "contactId"
>;

export function counterpartyFields(
  counterpartyType: CounterpartyType | null | undefined,
  counterpartyId: string | null | undefined
): CounterpartyFields {
  if (!counterpartyType || !counterpartyId) {
    return { counterpartyType: null, customerId: null, vendorId: null, employeeId: null, contactId: null };
  }
  return {
    counterpartyType,
    customerId: counterpartyType === "CUSTOMER" ? counterpartyId : null,
    vendorId: counterpartyType === "VENDOR" ? counterpartyId : null,
    employeeId: counterpartyType === "EMPLOYEE" ? counterpartyId : null,
    contactId: counterpartyType === "CONTACT" ? counterpartyId : null,
  };
}

/**
 * DEBIT:  main + VAT companion lines are debits, withholding companion is
 *         a CREDIT (liability). Cash Disbursement, Purchases on Account —
 *         money going out / money we'll owe.
 * CREDIT: main + VAT companion lines are credits, withholding companion
 *         is a DEBIT (asset). Cash Receipts, Sales on Account — money
 *         coming in / money owed to us.
 */
export type ExpandDirection = "DEBIT" | "CREDIT";

export class MissingPostingAccountError extends Error {}

/**
 * Expands each user-entered line into its real GL lines: the main line
 * (always at Net amount, never Gross), an auto VAT companion line if the
 * line has VAT, and an auto withholding companion line if it has an ATC
 * code. Returns the expanded lines plus the amount still needed to
 * balance the document (what the caller posts as Cash, or Accounts
 * Receivable/Payable, depending on the journal).
 */
export async function expandVatLines(
  companyId: string,
  lines: ExpandInputLine[],
  direction: ExpandDirection,
  counterparty: CounterpartyFields,
  fallbackDescription?: string | null,
  documentNoForLabel?: string
): Promise<{ glLines: LedgerLineInput[]; balancingAmount: number }> {
  const needsVatSetup = lines.some((l) => l.vatType && l.vatType !== "NON_VAT");
  const atcCodeIds = [...new Set(lines.map((l) => l.atcCodeId).filter(Boolean))] as string[];

  const [taxSetup, atcCodes] = await Promise.all([
    needsVatSetup || atcCodeIds.length
      ? prisma.taxPostingSetup.findUnique({ where: { companyId } })
      : Promise.resolve(null),
    atcCodeIds.length ? prisma.atcCode.findMany({ where: { id: { in: atcCodeIds } } }) : Promise.resolve([]),
  ]);
  const atcById = new Map(atcCodes.map((a) => [a.id, a]));

  const vatAccountId = direction === "DEBIT" ? taxSetup?.inputVatAccountId : taxSetup?.outputVatAccountId;
  const vatAccountLabel = direction === "DEBIT" ? "Input VAT" : "Output VAT";
  const withholdingAccountId =
    direction === "DEBIT" ? taxSetup?.withholdingTaxPayableAccountId : taxSetup?.creditableWithholdingTaxAccountId;
  const withholdingAccountLabel = direction === "DEBIT" ? "Withholding Tax Payable" : "Creditable Withholding Tax";

  const glLines: LedgerLineInput[] = [];
  let totalMain = 0;
  let totalWithholding = 0;

  for (const line of lines) {
    const vatType = line.vatType ?? null;
    const vat = vatType
      ? computeVat({ vatType, amount: line.amount, amountIsGross: line.amountIsGross ?? true })
      : { grossAmount: line.amount, netAmount: line.amount, vatAmount: 0 };

    const atc = line.atcCodeId ? atcById.get(line.atcCodeId) : null;
    const withholdingAmt = atc ? computeWithholding(vat.netAmount, Number(atc.ratePercent)) : 0;

    // A per-line party (if set) overrides the document counterparty for this
    // line's main account entry.
    const lineCounterparty =
      line.counterpartyType && line.counterpartyId
        ? counterpartyFields(line.counterpartyType, line.counterpartyId)
        : counterparty;

    const mainLine: LedgerLineInput = {
      accountId: line.accountId,
      description: line.description ?? fallbackDescription ?? null,
      referenceNo: line.referenceNo ?? null,
      ...lineCounterparty,
      vatType,
      grossAmount: vatType ? vat.grossAmount : null,
      netAmount: vatType ? vat.netAmount : null,
      vatAmount: vatType ? vat.vatAmount : null,
      taxSource: line.taxSource ?? null,
      atcCode: atc?.code ?? null,
      atcDescription: atc?.description ?? null,
      withholdingAmt: withholdingAmt || null,
      [direction === "DEBIT" ? "debitAmount" : "creditAmount"]: vat.netAmount,
    };
    glLines.push(mainLine);
    totalMain += vat.netAmount;

    if (vat.vatAmount > 0) {
      if (!vatAccountId) {
        throw new MissingPostingAccountError(
          `This line has VAT but no ${vatAccountLabel} account is configured. Set one at Company → Tax Posting Setup first.`
        );
      }
      glLines.push({
        accountId: vatAccountId,
        description: `${vatAccountLabel} — ${documentNoForLabel ?? ""}`,
        referenceNo: line.referenceNo ?? null,
        [direction === "DEBIT" ? "debitAmount" : "creditAmount"]: vat.vatAmount,
      });
      totalMain += vat.vatAmount;
    }

    if (withholdingAmt > 0) {
      if (!withholdingAccountId) {
        throw new MissingPostingAccountError(
          `This line has withholding tax but no ${withholdingAccountLabel} account is configured. Set one at Company → Tax Posting Setup first.`
        );
      }
      glLines.push({
        accountId: withholdingAccountId,
        description: `${withholdingAccountLabel} (${atc?.code}) — ${documentNoForLabel ?? ""}`,
        referenceNo: line.referenceNo ?? null,
        // Withholding companion always sits on the OPPOSITE side from the
        // main/VAT lines — it's what makes the balancing amount smaller.
        [direction === "DEBIT" ? "creditAmount" : "debitAmount"]: withholdingAmt,
      });
      totalWithholding += withholdingAmt;
    }
  }

  const balancingAmount = Math.round((totalMain - totalWithholding) * 100) / 100;
  return { glLines, balancingAmount };
}

/** Swaps every line's debit and credit amount — used for Sales Return /
 * Purchase Return, which are the normal entry reversed, not a separate
 * set of rules. */
export function flipLines(lines: LedgerLineInput[]): LedgerLineInput[] {
  return lines.map((l) => ({
    ...l,
    debitAmount: l.creditAmount ?? 0,
    creditAmount: l.debitAmount ?? 0,
  }));
}
