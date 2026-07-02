import { prisma } from "@/lib/prisma";
import { CompanySetupClient } from "./CompanySetupClient";

export default async function CompanySetupPage() {
  const company = await prisma.company.findFirst();
  return <CompanySetupClient initialCompany={company} />;
}
