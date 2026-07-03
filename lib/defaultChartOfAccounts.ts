// AUTO-GENERATED from the client's "Chart of Accounts.xlsx" — the default
// chart seeded into every newly created company. Editable afterwards in the
// Chart of Accounts screen. Section headers (all-caps groupings) are omitted;
// classification/normal balance are derived from the account code + title.
import type { AccountClassification, NormalBalance } from "@prisma/client";

export type DefaultAccount = {
  code: string;
  title: string;
  classification: AccountClassification;
  normalBalance: NormalBalance;
};

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  {
    "code": "11000",
    "title": "Cash and Cash Equivalents",
    "classification": "CASH_ON_HAND",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11010",
    "title": "Cash on Hand",
    "classification": "CASH_ON_HAND",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11011",
    "title": "Petty Cash Fund",
    "classification": "CASH_ON_HAND",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11012",
    "title": "Revolving Fund",
    "classification": "CASH_ON_HAND",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11020",
    "title": "Cash in Bank",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11021",
    "title": "BDO Checking",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11022",
    "title": "BDO Savings",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11023",
    "title": "BPI Checking",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11024",
    "title": "BPI Savings",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11025",
    "title": "Metrobank",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11026",
    "title": "LandBank",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11027",
    "title": "UnionBank",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11028",
    "title": "GCash Business",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11029",
    "title": "Maya Business",
    "classification": "CASH_IN_BANK",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11100",
    "title": "Accounts Receivable",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11110",
    "title": "Trade Receivables",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11120",
    "title": "Customer Advances",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11130",
    "title": "Employee Receivables",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11140",
    "title": "Receivable - Officers",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11150",
    "title": "Receivable - Stockholders",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11160",
    "title": "Affiliate Receivables",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11190",
    "title": "Allowance for Doubtful Accounts (-)",
    "classification": "ACCOUNTS_RECEIVABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "11200",
    "title": "Merchandise Inventory",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11210",
    "title": "Raw Materials",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11220",
    "title": "Work in Process",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11230",
    "title": "Finished Goods",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11240",
    "title": "Office Supplies Inventory",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11250",
    "title": "Shop Supplies",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11260",
    "title": "Spare Parts",
    "classification": "INVENTORY",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11300",
    "title": "Prepayments",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11310",
    "title": "Prepaid Rent",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11320",
    "title": "Prepaid Insurance",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11330",
    "title": "Prepaid Taxes",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11340",
    "title": "Prepaid Licenses",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11350",
    "title": "Prepaid Software",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11390",
    "title": "Other Prepaid Expenses",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11400",
    "title": "Input VAT",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11410",
    "title": "Input VAT - Goods",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11420",
    "title": "Input VAT - Services",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11430",
    "title": "Input VAT - Capital Goods",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11440",
    "title": "Creditable Withholding Tax",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11450",
    "title": "Deferred Input VAT",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "11500",
    "title": "Other Current Assets",
    "classification": "OTHER_CURRENT_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12010",
    "title": "Land",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12020",
    "title": "Land Improvements",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12030",
    "title": "Building",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12040",
    "title": "Building Improvements",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12050",
    "title": "Furniture and Fixtures",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12060",
    "title": "Office Equipment",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12070",
    "title": "Computer Equipment",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12080",
    "title": "Transportation Equipment",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12090",
    "title": "Machinery",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12100",
    "title": "Leasehold Improvements",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12110",
    "title": "Construction in Progress",
    "classification": "FIXED_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12150",
    "title": "Software",
    "classification": "OTHER_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12160",
    "title": "Website Development",
    "classification": "OTHER_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12170",
    "title": "Trademark",
    "classification": "OTHER_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12180",
    "title": "Patent",
    "classification": "OTHER_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12190",
    "title": "Goodwill",
    "classification": "OTHER_ASSET",
    "normalBalance": "DEBIT"
  },
  {
    "code": "12910",
    "title": "Accumulated Depreciation - Building",
    "classification": "ACCUMULATED_DEPRECIATION",
    "normalBalance": "CREDIT"
  },
  {
    "code": "12920",
    "title": "Accumulated Depreciation - Furniture",
    "classification": "ACCUMULATED_DEPRECIATION",
    "normalBalance": "CREDIT"
  },
  {
    "code": "12930",
    "title": "Accumulated Depreciation - Office Equipment",
    "classification": "ACCUMULATED_DEPRECIATION",
    "normalBalance": "CREDIT"
  },
  {
    "code": "12940",
    "title": "Accumulated Depreciation - Vehicles",
    "classification": "ACCUMULATED_DEPRECIATION",
    "normalBalance": "CREDIT"
  },
  {
    "code": "12950",
    "title": "Accumulated Depreciation - Machinery",
    "classification": "ACCUMULATED_DEPRECIATION",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21000",
    "title": "Accounts Payable",
    "classification": "ACCOUNTS_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21010",
    "title": "Trade Payables",
    "classification": "ACCOUNTS_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21020",
    "title": "Supplier Payables",
    "classification": "ACCOUNTS_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21100",
    "title": "Notes Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21200",
    "title": "Accrued Expenses",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21210",
    "title": "Accrued Salaries",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21220",
    "title": "Accrued Utilities",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21230",
    "title": "Accrued Professional Fees",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21300",
    "title": "Government Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21310",
    "title": "Output VAT Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21320",
    "title": "Withholding Tax Payable - Expanded",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21330",
    "title": "Withholding Tax Payable - Compensation",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21340",
    "title": "Final Tax Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21350",
    "title": "SSS Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21360",
    "title": "PhilHealth Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21370",
    "title": "Pag-IBIG Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21380",
    "title": "Income Tax Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21390",
    "title": "Local Business Tax Payable",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21400",
    "title": "Other Current Liabilities",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21410",
    "title": "Due to Employees",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21420",
    "title": "Due to Officers",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21430",
    "title": "Due to Stockholders",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21440",
    "title": "Customer Deposits",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "21450",
    "title": "Unearned Revenue",
    "classification": "OTHER_CURRENT_LIABILITY",
    "normalBalance": "CREDIT"
  },
  {
    "code": "22010",
    "title": "Long-term Notes Payable",
    "classification": "LONG_TERM_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "22020",
    "title": "Bank Loan",
    "classification": "LONG_TERM_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "22030",
    "title": "Lease Liability",
    "classification": "LONG_TERM_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "22040",
    "title": "Deferred Tax Liability",
    "classification": "LONG_TERM_PAYABLE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31000",
    "title": "Capital Stock",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31100",
    "title": "Additional Paid-in Capital",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31200",
    "title": "Owner's Capital",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31300",
    "title": "Owner's Drawings",
    "classification": "EQUITY_GETS_CLOSED",
    "normalBalance": "DEBIT"
  },
  {
    "code": "31400",
    "title": "Retained Earnings",
    "classification": "EQUITY_DOES_NOT_CLOSE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31500",
    "title": "Current Year Earnings",
    "classification": "EQUITY_GETS_CLOSED",
    "normalBalance": "CREDIT"
  },
  {
    "code": "31600",
    "title": "Prior Year Adjustments",
    "classification": "EQUITY_GETS_CLOSED",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41000",
    "title": "Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41110",
    "title": "VATable Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41120",
    "title": "VATAble Sales - Good",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41130",
    "title": "Government Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41200",
    "title": "Zero Rated Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41210",
    "title": "Zero Rated Sales - Goods",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41220",
    "title": "Zero Rated Sales - Service",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41230",
    "title": "Export Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41300",
    "title": "Exempt Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41310",
    "title": "Exempt Sales - Goods",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41320",
    "title": "Exempt Sales - Servides",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41400",
    "title": "Non-VAT Sales",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41410",
    "title": "Non-VAT Sales - Goods",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41420",
    "title": "Non-VAT Sales - Services",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "41040",
    "title": "Sales Returns and Allowances (-)",
    "classification": "REVENUE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "41050",
    "title": "Sales Discount (-)",
    "classification": "REVENUE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "42000",
    "title": "Other Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "42010",
    "title": "Interest Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "42020",
    "title": "Rental Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "42030",
    "title": "Foreign Exchange Gain",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "42040",
    "title": "Miscellaneous Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "51000",
    "title": "Cost of Goods Sold",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51100",
    "title": "Cost of Services",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51200",
    "title": "Direct Materials",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51300",
    "title": "Direct Labor",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51400",
    "title": "Factory Overhead",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51500",
    "title": "Purchases",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51600",
    "title": "Purchase Returns",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "51700",
    "title": "Purchase Discounts",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61000",
    "title": "Amortizations",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61010",
    "title": "Bad Debts",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61020",
    "title": "Chartable Contributions",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61030",
    "title": "Depletion",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61040",
    "title": "Depreciation",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61100",
    "title": "Entertainment, Amusement and Recreation",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61110",
    "title": "Fringe Benefits",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61120",
    "title": "Interest",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61130",
    "title": "Losses",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61140",
    "title": "Pension Trust",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61150",
    "title": "Rental",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61160",
    "title": "Research and Development",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61170",
    "title": "Salaries, Wages and Allowances",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61180",
    "title": "SSS, GSIS, Philhealth, HDMF and Other Contributions",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61190",
    "title": "Taxes and Licenses",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61200",
    "title": "Transportation and Travel",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61210",
    "title": "Janitorial and Messengerial Services",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61220",
    "title": "Professional Fees",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61230",
    "title": "Security Services",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61240",
    "title": "Advertising Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61250",
    "title": "Commission Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61260",
    "title": "Office Supplies Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61270",
    "title": "Light and Water",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61280",
    "title": "Utlities",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61290",
    "title": "Light and Water",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61300",
    "title": "Telephone Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61310",
    "title": "Internet Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61320",
    "title": "Postage Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61330",
    "title": "Training and Seminar",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61340",
    "title": "Fuel and Oil",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61350",
    "title": "Repairs and Maintenance",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61360",
    "title": "Insurance Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61370",
    "title": "Bank Charges",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "61380",
    "title": "Software Subscription",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "71000",
    "title": "Interest Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "71100",
    "title": "Dividend Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "71200",
    "title": "Gain on Sale of Assets",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "71300",
    "title": "Foreign Exchange Gain",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "71400",
    "title": "Miscellaneous Income",
    "classification": "REVENUE",
    "normalBalance": "CREDIT"
  },
  {
    "code": "81000",
    "title": "Interest Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81100",
    "title": "Foreign Exchange Loss",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81200",
    "title": "Loss on Sale of Assets",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81300",
    "title": "Bad Debts Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81400",
    "title": "Donation Expense",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81500",
    "title": "Penalties and Surcharges",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81600",
    "title": "Loss Due to Theft",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  },
  {
    "code": "81700",
    "title": "Prior Period Adjustments",
    "classification": "EXPENSE",
    "normalBalance": "DEBIT"
  }
];
