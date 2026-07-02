import type { Metadata } from "next";
import "./globals.css";

// Every page in this app reads live database state (accounts, ledger
// entries, reports) — none of it should ever be statically generated at
// build time. Without this, Next.js tries to pre-render every page
// during `next build`, which runs Prisma queries inside the build
// container where DATABASE_URL either isn't set or the database isn't
// reachable, causing the build to fail entirely. Setting this here, on
// the root layout, applies to every nested page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arbixo",
  description: "Accounting Intelligence. Business Excellence. — powered by Systemaide Solutions Inc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
