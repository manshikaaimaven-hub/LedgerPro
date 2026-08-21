/*
  ORIGINAL PATH: src/components/shell/Topbar.tsx

  Shown at the top of every main tab (Summary, New entry, Customers,
  Settings). Greets the user + shows business name on the left, and an
  avatar with the owner's initials on the right. Tapping the avatar opens
  a dropdown with the owner's name/business and a Sign out button.

*/
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";
import { getOwner, clearSession, type Owner } from "@/lib/auth";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string): string {
  return (
    name.trim().split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"
  );
}

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Loaded only after mount — avoids a "?" flash from static export
  // pre-rendering with no localStorage available on the server.
  const [owner, setOwner] = useState<Owner | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setOwner(getOwner());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayTitle = title ?? getGreeting();
  const displaySubtitle = subtitle ?? owner?.business_name ?? "";
  const initials = owner ? getInitials(owner.full_name) : "";

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <div className="relative z-50 bg-white/90 backdrop-blur-xl border-b border-[#E8E5F5] px-4 pt-3.5 pb-3 flex items-center justify-between flex-shrink-0">
      <div>
        <div className="text-2xl font-display font-medium text-text-primary">{displayTitle}</div>
        {displaySubtitle && (
          <div className="text-[13px] text-text-secondary mt-0.5">{displaySubtitle}</div>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-[38px] h-[38px] rounded-full bg-brand text-white flex items-center justify-center text-[13px] font-semibold hover:brightness-110 transition-all"
          aria-label="Open profile menu"
        >
          {initials}
        </button>

        {menuOpen && (
          <div className="fade-in absolute right-0 top-[46px] w-[220px] bg-white/95 backdrop-blur-xl border border-[#E8E5F5] rounded-card shadow-card overflow-hidden z-[999]">
            <div className="px-4 py-3 border-b border-line/70">
              <div className="text-[14px] font-medium text-text-primary">{owner?.full_name ?? "—"}</div>
              <div className="text-[12px] text-text-secondary mt-0.5">{owner?.business_name ?? "—"}</div>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/owner/settings");
              }}
              className="w-full text-left px-4 py-2.5 text-[14px] text-text-primary hover:bg-black/[0.03] transition-colors"
            >
              View settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-danger-dark bg-danger-light/70 hover:bg-danger-light transition-colors"
            >
              <IconLogout size={17} stroke={1.75} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}