/*
  ORIGINAL PATH: src/components/customer-shell/CustomerTopbar.tsx

  Simple top bar: page title + subtitle on the left, nothing fancy on
  the right for now (no avatar dropdown — logout already lives in the
  sidebar). Kept as its own component so page-specific titles are easy
  to pass in, matching the owner side's AppShell pattern.
*/
"use client";

interface CustomerTopbarProps {
  title: string;
  subtitle?: string;
}

export function CustomerTopbar({ title, subtitle }: CustomerTopbarProps) {
  return (
    <div className="bg-white/90 backdrop-blur-xl border-b border-line px-5 md:px-8 pt-5 pb-4 sticky top-0 z-30">
      <div className="text-xl md:text-2xl font-display font-medium text-text-primary">{title}</div>
      {subtitle && <div className="text-sm text-text-secondary mt-0.5">{subtitle}</div>}
    </div>
  );
}