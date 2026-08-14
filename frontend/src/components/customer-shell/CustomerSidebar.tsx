/*
  ORIGINAL PATH: src/components/customer-shell/CustomerSidebar.tsx

  RENAMED IN SPIRIT to a bottom nav — no more desktop sidebar variant,
  since the whole customer app now lives inside the same 430px mobile
  frame as the owner app. Matches the owner app's BottomNav.tsx pattern
  exactly: fixed row of icon+label tabs, active tab highlighted.

  Logout is NOT a 5th nav tab — it lives inside the Settings page,
  same placement pattern as the owner app's Settings > Sign out button.
*/
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard, IconReceipt2, IconRotateClockwise2, IconSettings,
} from "@tabler/icons-react";

const NAV_ITEMS = [
  { href: "/customer/customer-dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/customer/customer-transactions", label: "Transactions", icon: IconReceipt2 },
  { href: "/customer/customer-restore-requests", label: "Restore", icon: IconRotateClockwise2 },
  { href: "/customer/customer-settings", label: "Settings", icon: IconSettings },
];

export function CustomerBottomNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white/90 backdrop-blur-xl border-t border-line flex flex-shrink-0">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pb-3 border-t-[2.5px] text-[11px] font-medium transition-colors ${
              active ? "text-brand border-t-brand" : "text-text-tertiary border-t-transparent"
            }`}
          >
            <span
              className={`flex items-center justify-center w-9 h-6 rounded-full transition-all ${
                active ? "bg-brand/12 scale-105" : "bg-transparent"
              }`}
            >
              <Icon size={22} stroke={1.75} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}