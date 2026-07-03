export function Footer() {
  return (
    <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500 sm:px-6">
      <div className="mb-2 text-center text-sm font-semibold">
        <span className="text-brand-navy">Accounting Intelligence. </span>
        <span className="text-brand-green">Business Excellence.</span>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} Systemaide Solutions Inc. All rights reserved.
          <span className="mx-2 hidden text-neutral-300 sm:inline">|</span>
          <span className="block sm:inline">
            <span className="font-semibold text-brand-navy">ARbixo</span> Accounting System
          </span>
        </p>
        <nav className="flex items-center gap-4">
          <a href="#" className="hover:text-brand-blue">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-brand-blue">
            Terms of Service
          </a>
          <a href="#" className="hover:text-brand-blue">
            Help Center
          </a>
        </nav>
      </div>
    </footer>
  );
}
