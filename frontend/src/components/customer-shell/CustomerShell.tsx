/*
  ORIGINAL PATH: src/components/customer-shell/CustomerShell.tsx

  UPDATED — column layout only (topbar / scrollable content / bottom
  nav), same shape as the owner app's <AppShell>. No more sidebar +
  content flex-row, since there's no desktop sidebar anymore.
*/
"use client";

import { CustomerTopbar } from "./CustomerTopbar";
import { CustomerBottomNav } from "./CustomerSidebar";

interface CustomerShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function CustomerShell({ children, title, subtitle }: CustomerShellProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CustomerTopbar title={title} subtitle={subtitle} />
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">{children}</main>
      <CustomerBottomNav />
    </div>
  );
}