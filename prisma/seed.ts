import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// STARTER DATA ONLY — NOT AN AUTHORITATIVE BIR TABLE.
//
// These codes/rates/descriptions are taken only from the ones that
// literally appear in the desktop manual's own screenshots (so they're
// at least internally consistent with the worked examples in lib/vat.test.ts).
// They are NOT a complete or current Alphanumeric Tax Code list.
//
// BIR revises these rates periodically — e.g. RR No. 5-2025 (Feb 2025)
// and RR No. 24-2025 (Sep 2025) both changed creditable withholding tax
// rates within the same year. Before relying on this for real filings,
// verify every code against the BIR's current table:
// https://www.bir.gov.ph/WithHoldingTax
// ============================================================
const STARTER_ATC_CODES = [
  {
    code: "WC100",
    description:
      "Rentals - real or personal properties, poles, satellites & transmission facilities, billboards - Corporate",
    ratePercent: 5,
    incomePaymentType: "GOODS" as const,
  },
  {
    code: "WC158",
    description: "Income payments made by top 20,000 private corporations to their local or resident suppliers of goods - Corporate",
    ratePercent: 1,
    incomePaymentType: "GOODS" as const,
  },
  {
    code: "WC160",
    description: "Income payments made by top 20,000 private corporations to their local or resident suppliers of services - Corporate",
    ratePercent: 2,
    incomePaymentType: "SERVICES" as const,
  },
  {
    code: "WV010",
    description: "Income payments made by top 20,000 private corporations to their local/resident suppliers of goods (VAT supplier)",
    ratePercent: 1,
    incomePaymentType: "GOODS" as const,
  },
  {
    code: "WI158",
    description: "Income payments made by top 20,000 private corporations to their local or resident suppliers of goods - Individual",
    ratePercent: 1,
    incomePaymentType: "GOODS" as const,
  },
];

async function main() {
  for (const atc of STARTER_ATC_CODES) {
    await prisma.atcCode.upsert({
      where: { code: atc.code },
      update: {},
      create: atc,
    });
  }
  console.log(`Seeded ${STARTER_ATC_CODES.length} starter ATC codes. Verify rates against bir.gov.ph before going live.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
