// AUTO-GENERATED from the client's approved "Chart of Accounts (V.2 cleaned).csv".
// The default chart seeded into every new company: a nested tree of Heading
// accounts (non-postable). Posting accounts are added afterward in the Chart
// of Accounts screen. classification/normalBalance are carried for schema
// completeness; they only drive behavior on Posting accounts.
import type { AccountClassification, AccountType, NormalBalance } from "@prisma/client";

export type DefaultAccount = {
  code: string;
  title: string;
  accountType: AccountType;
  classification: AccountClassification;
  normalBalance: NormalBalance;
  parentCode: string | null;
  sortOrder: number;
};

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  {
    "code": "10000",
    "title": "ASSETS",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": null,
    "sortOrder": 0
  },
  {
    "code": "11000",
    "title": "CURRENT ASSETS",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "10000",
    "sortOrder": 1
  },
  {
    "code": "11100",
    "title": "Cash and Cash Equivalents",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 2
  },
  {
    "code": "11200",
    "title": "Accounts Receivable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 3
  },
  {
    "code": "11300",
    "title": "Merchandise Inventory",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 4
  },
  {
    "code": "11400",
    "title": "Prepayments",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 5
  },
  {
    "code": "11500",
    "title": "Input VAT",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 6
  },
  {
    "code": "11600",
    "title": "Other Current Assets",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "11000",
    "sortOrder": 7
  },
  {
    "code": "12200",
    "title": "NON-CURRENT ASSETS",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "10000",
    "sortOrder": 8
  },
  {
    "code": "12010",
    "title": "Land",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "12200",
    "sortOrder": 9
  },
  {
    "code": "12020",
    "title": "Fixed Asset",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "12200",
    "sortOrder": 10
  },
  {
    "code": "12030",
    "title": "Goodwill",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "12200",
    "sortOrder": 11
  },
  {
    "code": "12040",
    "title": "Accumulated Depreciation",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT",
    "parentCode": "12200",
    "sortOrder": 12
  },
  {
    "code": "20000",
    "title": "LIABILITIES",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": null,
    "sortOrder": 13
  },
  {
    "code": "21000",
    "title": "CURRENT LIABILITIES",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "20000",
    "sortOrder": 14
  },
  {
    "code": "21100",
    "title": "Accounts Payable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "21000",
    "sortOrder": 15
  },
  {
    "code": "21200",
    "title": "Notes Payable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "21000",
    "sortOrder": 16
  },
  {
    "code": "21300",
    "title": "Accrued Expenses",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "21000",
    "sortOrder": 17
  },
  {
    "code": "21400",
    "title": "Government Payable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "21000",
    "sortOrder": 18
  },
  {
    "code": "21500",
    "title": "Other Current Liabilities",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "21000",
    "sortOrder": 19
  },
  {
    "code": "22000",
    "title": "NONCURRENT LIABILITY",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "20000",
    "sortOrder": 20
  },
  {
    "code": "22010",
    "title": "Long-term Notes Payable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "22000",
    "sortOrder": 21
  },
  {
    "code": "22020",
    "title": "Other Non-Current Payable",
    "accountType": "HEADING",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT",
    "parentCode": "22000",
    "sortOrder": 22
  },
  {
    "code": "30000",
    "title": "EQUITY",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": null,
    "sortOrder": 23
  },
  {
    "code": "31000",
    "title": "Capital Stock",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 24
  },
  {
    "code": "31100",
    "title": "Additional Paid-in Capital",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 25
  },
  {
    "code": "31200",
    "title": "Owner's Capital",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 26
  },
  {
    "code": "31300",
    "title": "Owner's Drawings",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 27
  },
  {
    "code": "31400",
    "title": "Retained Earnings",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 28
  },
  {
    "code": "31500",
    "title": "Current Year Earnings",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 29
  },
  {
    "code": "31600",
    "title": "Prior Year Adjustments",
    "accountType": "HEADING",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT",
    "parentCode": "30000",
    "sortOrder": 30
  },
  {
    "code": "40000",
    "title": "REVENUE",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": null,
    "sortOrder": 31
  },
  {
    "code": "41000",
    "title": "Sales",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "40000",
    "sortOrder": 32
  },
  {
    "code": "41110",
    "title": "VATable Sales",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 33
  },
  {
    "code": "41200",
    "title": "Zero Rated Sales",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 34
  },
  {
    "code": "41300",
    "title": "Exempt Sales",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 35
  },
  {
    "code": "41400",
    "title": "Non-VAT Sales",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 36
  },
  {
    "code": "41040",
    "title": "Sales Returns and Allowances (-)",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 37
  },
  {
    "code": "41050",
    "title": "Sales Discount (-)",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "41000",
    "sortOrder": 38
  },
  {
    "code": "42000",
    "title": "Other Income",
    "accountType": "HEADING",
    "classification": "REVENUE",
    "normalBalance": "CREDIT",
    "parentCode": "40000",
    "sortOrder": 39
  },
  {
    "code": "50000",
    "title": "COST OF SALES / SERVICES",
    "accountType": "HEADING",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT",
    "parentCode": null,
    "sortOrder": 40
  },
  {
    "code": "51000",
    "title": "Cost of Goods Sold",
    "accountType": "HEADING",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT",
    "parentCode": "50000",
    "sortOrder": 41
  },
  {
    "code": "52000",
    "title": "Cost of Services",
    "accountType": "HEADING",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT",
    "parentCode": "50000",
    "sortOrder": 42
  },
  {
    "code": "6000",
    "title": "OPERATING EXPENSES",
    "accountType": "HEADING",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT",
    "parentCode": null,
    "sortOrder": 43
  },
  {
    "code": "80000",
    "title": "OTHER EXPENSES",
    "accountType": "HEADING",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT",
    "parentCode": null,
    "sortOrder": 44
  }
];
