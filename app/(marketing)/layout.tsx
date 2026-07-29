import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ARbixo — Accounting Intelligence. Business Excellence.",
  description:
    "Cloud accounting and BIR-ready reporting for Philippine businesses. Books of accounts, financial statements, VAT, withholding and RELIEF files — in one place. Powered by Systemaide Solutions Inc.",
};

// Public marketing pages: no app chrome, no authentication.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-neutral-800">{children}</div>;
}
