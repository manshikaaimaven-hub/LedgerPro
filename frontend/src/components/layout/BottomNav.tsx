/*
  ORIGINAL PATH: src/components/shell/BottomNav.tsx

  Fixed bottom tab bar — Summary / New entry / Customers / Settings.
  Highlights whichever tab matches the current URL.
*/
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconFileInvoice, IconUsers, IconSettings } from "@tabler/icons-react";

const TABS = [
  { href: "/", label: "Summary", icon: IconHome },
  { href: "/owner/entry", label: "New entry", icon: IconFileInvoice },
  { href: "/owner/customers", label: "Customers", icon: IconUsers },
  { href: "/owner/settings", label: "Settings", icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white/90 backdrop-blur-xl border-t border-[#E8E5F5] flex flex-shrink-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        // Exact match for "/", prefix match for nested routes like /customers/[id]
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 pb-3 border-t-[2.5px] text-[11px] font-medium transition-colors ${
              active
                ? "text-brand border-t-brand"
                : "text-[#8A8FA3] border-t-transparent"
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