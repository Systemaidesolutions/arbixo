import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { STANDARD_ATC_CODES } from "../lib/atcSeedData";

const prisma = new PrismaClient();

// ============================================================
// STARTER DATA ONLY — NOT AN AUTHORITATIVE BIR TABLE.
//
// The curated ATC set lives in lib/atcSeedData.ts (STANDARD_ATC_CODES) so the
// app and the seed share one source. It is a common EWT subset, not the full
// BIR catalogue — load the complete official list via Admin → ATC codes →
// Import. BIR revises rates periodically (e.g. RR 5-2025, RR 24-2025), so verify
// every code against the current table before real filings:
// https://www.bir.gov.ph/WithHoldingTax
// ============================================================
async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user bootstrap. " +
        "Set both in .env and re-run the seed to create the global admin account."
    );
    return;
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Pre-verified and role ADMIN — this is the one account meant to
  // bootstrap access to a fresh deployment without going through the
  // email verification flow (there's no one else to verify it yet).
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", isVerified: true },
    create: { email, passwordHash, role: "ADMIN", isVerified: true },
  });

  console.log(`Seeded global admin account: ${email}`);
}

async function main() {
  for (const atc of STANDARD_ATC_CODES) {
    await prisma.atcCode.upsert({
      where: { code: atc.code },
      update: {},
      create: atc,
    });
  }
  console.log(`Seeded ${STANDARD_ATC_CODES.length} ATC codes. Verify rates against bir.gov.ph before going live.`);

  await seedAdminUser();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
