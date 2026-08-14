/*
  ORIGINAL PATH: src/components/summary/StatCard.tsx

  Displays one summary statistic (e.g. Total Credit) in a small card.
  Reused 4x on the Summary page instead of writing 4 separate components.

*/
import type { ComponentType } from "react";

interface StatCardProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color: "green" | "red" | "amber" | "blue";
}

// IMPORTANT: Tailwind needs full, literal class names to detect them at
// build time. `bg-${color}/[0.06]` on its own never works safely either —
// this lookup table gives Tailwind real, complete strings so nothing gets
// purged from the production build.
const COLOR_STYLES = {
  green: {
    // tint: "bg-success/[0.07]",
    tint: "bg-[#F6FFFA]",
    border: "border-success/20",
    tab: "border-l-success",
    chipBg: "bg-success-light",
    chipText: "text-success",
    valueText: "text-success-dark",

  },
  red: {
    // tint: "bg-danger/[0.07]",
    tint: "bg-[#FFF7F8]",
    border: "border-danger/20",
    tab: "border-l-danger",
    chipBg: "bg-danger-light",
    chipText: "text-danger",
    valueText: "text-danger-dark",
    
  },
  amber: {
    // tint: "bg-warning/[0.07]",
    tint: "bg-[#FFFDF7]",
    border: "border-warning/20",
    tab: "border-l-warning",
    chipBg: "bg-warning-light",
    chipText: "text-warning",
    valueText: "text-warning-dark",
    
  },
  blue: {
    // tint: "bg-info/[0.07]",
    tint: "bg-[#F7FAFF]",
    border: "border-info/20",
    tab: "border-l-info",
    chipBg: "bg-info-light",
    chipText: "text-info",
    valueText: "text-info-dark",
    
  },
} as const;

export function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const s = COLOR_STYLES[color];

  return (
    <div
      className={`relative overflow-hidden ${s.tint} backdrop-blur-md border ${s.border} border-l-[3px] ${s.tab} rounded-card p-3.5 h-28 flex flex-col justify-between`}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className={`w-10 h-10 rounded-xl bg-white border-2 shadow-sm flex items-center justify-center ${s.chipText} ${
            color === "green"
              ? "border-green-200"
              : color === "red"
              ? "border-red-200"
              : color === "amber"
              ? "border-amber-200"
              : "border-blue-200"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="text-[13px] text-text-secondary leading-tight">{label}</div>
      </div>
      <div className={`text-[22px] font-semibold tabular-nums mt-0.5 ${s.valueText}`}>{value}</div>
    </div>
  );
}