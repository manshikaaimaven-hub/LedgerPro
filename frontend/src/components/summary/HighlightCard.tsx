import type { ComponentType } from "react";
import { IconPhone, IconCircleCheck } from "@tabler/icons-react";
import type { TopBalanceEntry } from "@/types/summary";

interface HighlightCardProps {
  title: string;
  icon: ComponentType<{ size?: number }>;
  variant: "positive" | "negative";
  entries: TopBalanceEntry[];
  emptyMessage: string;
  className?: string;
}

function initials(name: string): string {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

function formatCurrency(n: number): string {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export function HighlightCard({ title, icon: Icon, variant, entries, emptyMessage, className = "" }: HighlightCardProps) {
  const isPositive = variant === "positive";

  return (
    <div
      className={`${
        isPositive
          ? "bg-[#F6FFFA] border-[#C7F0DB]"
          : "bg-[#FFF7F8] border-[#F8C8CF]"
      } border rounded-card overflow-hidden flex flex-col p-2 gap-1.5 ${className}`}
    >
      <div
        className={`px-2.5 py-2 text-[13px] font-medium flex items-center gap-2 ${
          isPositive ? "text-success-dark" : "text-danger-dark"
        }`}
      >
        <Icon size={16} />
        {title}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface rounded-input text-text-secondary">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
              isPositive
                ? "bg-white border-2 border-success/30 shadow-sm text-success-dark"
                : "bg-white border-2 border-danger/30 shadow-sm"
            }`}
          >
            <IconCircleCheck size={24} />
          </div>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`w-full text-left px-3 py-[13px] flex items-center gap-2.5
            bg-white border border-line rounded-input
            transition-all duration-150 hover:shadow-sm active:scale-[0.98]
            ${isPositive ? "active:bg-success-light" : "active:bg-danger-light"}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0  
              ${
                isPositive ? "from-success to-success-dark" : "from-danger to-danger-dark"
              }`}
            >
              {initials(entry.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-medium text-text-primary truncate">{entry.name}</div>
              <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                <IconPhone size={13} />
                {entry.phone || "—"}
              </div>
            </div>
            <div className={`text-base font-semibold tabular-nums ${isPositive ? "text-success-dark" : "text-danger-dark"}`}>
              {formatCurrency(entry.balance)}
            </div>
          </button>
        ))
      )}
    </div>
  );
}