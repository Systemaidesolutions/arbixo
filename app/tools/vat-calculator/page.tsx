import { prisma } from "@/lib/prisma";
import { toPlain } from "@/lib/serialize";
import { VatCalculatorDemo } from "./VatCalculatorDemo";

export default async function VatCalculatorPage() {
  const atcCodes = await prisma.atcCode.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return <VatCalculatorDemo atcCodes={toPlain(atcCodes)} />;
}
