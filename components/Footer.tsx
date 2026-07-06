export function Footer() {
  return (
    <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-500 sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-between">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} Systemaide Solutions Inc.
          <span className="mx-2 text-neutral-300">|</span>
          <span className="font-semibold text-brand-navy">ARbixo</span> Accounting System
          <span className="mx-2 hidden text-neutral-300 sm:inline">|</span>
          <span className="hidden sm:inline">
            <span className="font-medium text-brand-navy">Accounting Intelligence.</span>{" "}
            <span className="font-medium text-brand-green">Business Excellence.</span>
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
