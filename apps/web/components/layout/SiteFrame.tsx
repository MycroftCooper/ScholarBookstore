import { type ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type SiteFrameProps = {
  children: ReactNode;
};

export function SiteFrame({ children }: SiteFrameProps) {
  return (
    <main className="min-h-screen bg-[var(--color-page)] text-[var(--color-ink)]">
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
