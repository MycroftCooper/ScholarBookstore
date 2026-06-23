import Link from "next/link";

const footerLinks = [
  ["\u9886\u57df", "/modules"],
  ["\u53d1\u73b0", "/discover"],
  ["\u6295\u7a3f", "/me/submit"],
  ["\u4e2a\u4eba\u4e2d\u5fc3", "/me"],
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-[var(--color-line)] px-4 py-8 text-sm text-[var(--color-muted)] md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="font-mono text-xs">
          GameScholarBookstore
        </div>
        <nav className="flex flex-wrap justify-center gap-x-9 gap-y-3">
          {footerLinks.map(([label, href], index) => (
            <Link key={`${href}-${index}`} href={href} className="hover:text-[var(--color-ink)]">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
