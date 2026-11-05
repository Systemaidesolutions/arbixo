import { headers } from "next/headers";
import { getCurrentCompany, getCurrentCapability } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { isLocked } from "@/lib/leavePortalRules";
import { LeavePortalSetupClient } from "./LeavePortalSetupClient";

export const dynamic = "force-dynamic";

// Payroll › Employee leave portal: turn the shareable leave link on, and set
// each employee's PIN. Employees sign in with employee number + PIN.
export default async function LeavePortalSetupPage() {
  const company = await getCurrentCompany();
  const capability = await getCurrentCapability();
  if (!company) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-xl font-medium text-neutral-900">Employee leave portal</h1>
        <p className="mt-2 text-neutral-600">Complete company setup first.</p>
      </main>
    );
  }

  const [settings, employees] = await Promise.all([
    prisma.company.findUnique({ where: { id: company.id }, select: { leavePortalEnabled: true, leavePortalCode: true } }),
    prisma.employee.findMany({
      where: { companyId: company.id, isActive: true },
      select: {
        id: true, code: true, lastName: true, firstName: true, cellNo: true, email: true,
        portalPinSetAt: true, portalLockedUntil: true, payrollProfile: { select: { id: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const h = headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-xl font-medium text-neutral-900">Employee leave portal</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-500">
        Employees file their own leave from their phone, with no ARbixo account. Share the link below; they sign in with their
        employee number and a PIN you set here. Their filings land in <b>Leave</b> as pending for approval. Only payroll staff can
        set or reset a PIN.
      </p>
      <LeavePortalSetupClient
        canEdit={Boolean(capability?.canPost)}
        origin={origin}
        enabled={settings?.leavePortalEnabled ?? false}
        code={settings?.leavePortalCode ?? null}
        employees={employees.map((e) => ({
          id: e.id,
          code: e.code,
          name: `${e.lastName}, ${e.firstName}`,
          contact: e.cellNo || e.email || "",
          hasPin: !!e.portalPinSetAt,
          pinSetAt: e.portalPinSetAt ? e.portalPinSetAt.toISOString() : null,
          locked: isLocked(e.portalLockedUntil),
          payrollReady: !!e.payrollProfile,
        }))}
      />
    </main>
  );
}
