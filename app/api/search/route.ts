import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRecord } from "@/lib/currentUser";
import {
  NAV_SECTIONS,
  HISTORY_SECTION,
  ADMIN_NAV_SECTIONS,
  isNavGroup,
  type NavSection,
} from "@/lib/navigation";

export type SearchResult = { type: string; label: string; sub?: string; href: string };

// Flatten nav sections (including nested groups) into searchable page entries,
// so a query like "VAT Return" surfaces the report page as a clickable link.
function matchPages(sections: NavSection[], q: string): SearchResult[] {
  const ql = q.toLowerCase();
  const out: SearchResult[] = [];
  for (const section of sections) {
    for (const item of section.links) {
      const links = isNavGroup(item) ? item.links : [item];
      for (const l of links) {
        if (l.label.toLowerCase().includes(ql)) {
          out.push({ type: "Page", label: l.label, sub: section.title, href: l.href });
        }
      }
    }
  }
  return out.slice(0, 8);
}

type Party = {
  code: string;
  tradeName?: string | null;
  registeredName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
};

function partyLabel(p: Party): string {
  const name = [p.lastName, p.firstName].filter(Boolean).join(", ");
  return p.tradeName || p.registeredName || name || p.code;
}

// Generic, role-scoped search. Admins search companies + users; subscribers
// search their own company's chart of accounts and agents.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserRecord();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = { contains: q, mode: "insensitive" as const };
  const results: SearchResult[] = [];

  if (user.role === "ADMIN") {
    results.push(...matchPages(ADMIN_NAV_SECTIONS, q));
    const [companies, users] = await Promise.all([
      prisma.company.findMany({
        where: { OR: [{ tradeName: like }, { tin: like }, { registeredName: like }] },
        select: { id: true, tradeName: true, tin: true },
        take: 8,
      }),
      prisma.user.findMany({
        where: { email: like },
        select: { id: true, email: true, role: true },
        take: 8,
      }),
    ]);
    for (const c of companies)
      results.push({ type: "Company", label: c.tradeName, sub: c.tin, href: `/admin/companies/${c.id}` });
    for (const u of users)
      results.push({
        type: "User",
        label: u.email,
        sub: u.role === "ADMIN" ? "Admin" : "Subscriber",
        href: `/admin/users/${u.id}/edit`,
      });
  } else if (user.companyId) {
    results.push(...matchPages([...NAV_SECTIONS, HISTORY_SECTION], q));
    const companyId = user.companyId;
    const partySelect = {
      id: true,
      code: true,
      tradeName: true,
      registeredName: true,
      lastName: true,
      firstName: true,
    };
    const partyWhere = {
      companyId,
      OR: [
        { code: like },
        { tradeName: like },
        { registeredName: like },
        { lastName: like },
        { email: like },
      ],
    };
    const empWhere = {
      companyId,
      OR: [{ code: like }, { lastName: like }, { firstName: like }, { email: like }],
    };

    const [accounts, customers, vendors, employees, contacts] = await Promise.all([
      prisma.account.findMany({
        where: { companyId, OR: [{ code: like }, { title: like }] },
        select: { id: true, code: true, title: true },
        take: 6,
      }),
      prisma.customer.findMany({ where: partyWhere, select: partySelect, take: 5 }),
      prisma.vendor.findMany({ where: partyWhere, select: partySelect, take: 5 }),
      prisma.employee.findMany({
        where: empWhere,
        select: { id: true, code: true, lastName: true, firstName: true },
        take: 5,
      }),
      prisma.contact.findMany({ where: partyWhere, select: partySelect, take: 5 }),
    ]);

    for (const a of accounts)
      results.push({ type: "Account", label: `${a.code} — ${a.title}`, href: "/accounts" });
    for (const c of customers)
      results.push({ type: "Customer", label: partyLabel(c), sub: c.code, href: "/agents" });
    for (const v of vendors)
      results.push({ type: "Vendor", label: partyLabel(v), sub: v.code, href: "/agents" });
    for (const e of employees)
      results.push({ type: "Employee", label: partyLabel(e), sub: e.code, href: "/agents" });
    for (const c of contacts)
      results.push({ type: "Contact", label: partyLabel(c), sub: c.code, href: "/agents" });
  }

  return NextResponse.json({ results: results.slice(0, 25) });
}
