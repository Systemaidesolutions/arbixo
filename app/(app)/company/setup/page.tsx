import { getCurrentCompany } from "@/lib/currentUser";
import { CompanySetupClient } from "./CompanySetupClient";

export default async function CompanySetupPage() {
  const company = await getCurrentCompany();
  return <CompanySetupClient initialCompany={company} />;
}
