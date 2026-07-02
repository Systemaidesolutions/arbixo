import type { Account, AccountClassification, NormalBalance } from "@prisma/client";

// Default normal balance per classification. This is only a *suggestion*
// shown when creating an account — the field on the Account model stays
// explicit and editable, because contra accounts (Accumulated
// Depreciation, Sales Returns, etc.) don't follow the default for their
// classification.
export const DEFAULT_NORMAL_BALANCE: Record<AccountClassification, NormalBalance> = {
  CASH_IN_BANK: "DEBIT",
  CASH_ON_HAND: "DEBIT",
  ACCOUNTS_RECEIVABLE: "DEBIT",
  OTHER_CURRENT_ASSET: "DEBIT",
  INVENTORY: "DEBIT",
  FIXED_ASSET: "DEBIT",
  ACCUMULATED_DEPRECIATION: "CREDIT", // contra-asset
  OTHER_ASSET: "DEBIT",
  ACCOUNTS_PAYABLE: "CREDIT",
  OTHER_CURRENT_LIABILITY: "CREDIT",
  LONG_TERM_PAYABLE: "CREDIT",
  EQUITY_DOES_NOT_CLOSE: "CREDIT",
  EQUITY_GETS_CLOSED: "CREDIT",
  REVENUE: "CREDIT",
  EXPENSE: "DEBIT",
};

export const CLASSIFICATION_LABELS: Record<AccountClassification, string> = {
  CASH_IN_BANK: "Cash in Bank",
  CASH_ON_HAND: "Cash on Hand",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  OTHER_CURRENT_ASSET: "Other Current Asset",
  INVENTORY: "Inventory",
  FIXED_ASSET: "Fixed Asset",
  ACCUMULATED_DEPRECIATION: "Accumulated Depreciation",
  OTHER_ASSET: "Other Asset",
  ACCOUNTS_PAYABLE: "Accounts Payable",
  OTHER_CURRENT_LIABILITY: "Other Current Liability",
  LONG_TERM_PAYABLE: "Long-Term Payable",
  EQUITY_DOES_NOT_CLOSE: "Equity — Doesn't Close",
  EQUITY_GETS_CLOSED: "Equity — Gets Closed",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

// The manual's classifications, in the order they appear in the Chart of
// Accounts editor's left-hand list.
export const CLASSIFICATION_ORDER: AccountClassification[] = [
  "CASH_IN_BANK",
  "CASH_ON_HAND",
  "ACCOUNTS_RECEIVABLE",
  "OTHER_CURRENT_ASSET",
  "INVENTORY",
  "FIXED_ASSET",
  "ACCUMULATED_DEPRECIATION",
  "OTHER_ASSET",
  "ACCOUNTS_PAYABLE",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_PAYABLE",
  "EQUITY_DOES_NOT_CLOSE",
  "EQUITY_GETS_CLOSED",
  "REVENUE",
  "EXPENSE",
];

export type AccountNode = Account & { children: AccountNode[] };

// Turns the flat list Prisma returns into a parent → children tree,
// grouped by classification. One pass over the array (O(n)), no repeated
// .filter() calls per node.
export function buildAccountTree(accounts: Account[]): Record<string, AccountNode[]> {
  const byId = new Map<string, AccountNode>();
  for (const account of accounts) {
    byId.set(account.id, { ...account, children: [] });
  }

  const roots: AccountNode[] = [];
  for (const account of byId.values()) {
    if (account.parentAccountId) {
      const parent = byId.get(account.parentAccountId);
      // If the parent isn't in this result set (e.g. filtered out), fall
      // back to treating this account as a root rather than dropping it.
      if (parent) {
        parent.children.push(account);
        continue;
      }
    }
    roots.push(account);
  }

  const grouped: Record<string, AccountNode[]> = {};
  for (const classification of CLASSIFICATION_ORDER) {
    grouped[classification] = roots
      .filter((a) => a.classification === classification)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  return grouped;
}
