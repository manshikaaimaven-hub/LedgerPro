/*
AppShell wraps every authenticated tab page with the shared Topbar
and BottomNav, so individual pages (SummaryPage, NewEntryPage, etc.)
only need to render their own scrollable content.
*/
"use client";

import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <Topbar title={title} subtitle={subtitle} />

      <main className="flex-1 overflow-y-auto"> 
      {children}
      </main>
      <BottomNav />
    </div>
  );
}