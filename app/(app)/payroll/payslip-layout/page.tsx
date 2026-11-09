import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { getOrCreateSetup } from "@/lib/payroll/server";
import { cleanOptions, isLayoutKind } from "@/lib/payroll/payslipLayout";
import { PayslipLayoutClient } from "./PayslipLayoutClient";

export const dynamic = "force-dynamic";

// Payroll › Setup › Payslip layout: which output layout this company's payslips
// print in (Standard by default), and the options of its Custom layout.
export default async function PayslipLayoutPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Payslip layout</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }
  const setup = await getOrCreateSetup(company.id);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Payslip layout</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Choose how this company&apos;s payslips print. Standard is the default. Pick Compact or Detailed, or build a Custom layout. The
        preview uses sample figures; open a payroll run and press Payslips to print real ones.
      </p>
      <PayslipLayoutClient
        canEdit={Boolean(capability?.canPost)}
        layout={isLayoutKind(setup.payslipLayout) ? setup.payslipLayout : "STANDARD"}
        custom={setup.payslipOptions ? cleanOptions(setup.payslipOptions) : null}
        company={{ name: company.registeredName || company.tradeName, address: company.businessAddress, tin: company.tin, logoUrl: company.logoUrl }}
      />
    </main>
  );
}
