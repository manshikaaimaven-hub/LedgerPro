/*
  ORIGINAL PATH: src/components/customer-shell/StatCard.tsx

  One reusable card for the 6 summary numbers (balance, total txns,
  total credit, total debit, amount paid, remaining). Takes a tone so
  each stat gets its themed icon background, matching the color-token
  system already used across the app (success/danger/info/warning/brand/gold).
*/
"use client";

type Tone = "success" | "danger" | "info" | "warning" | "brand" | "gold";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-light text-success",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
  warning: "bg-warning-light text-warning",
  brand: "bg-brand-light text-brand-dark",
  gold: "bg-gold-light text-gold-dark",
};

const VALUE_TONE_CLASS: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
  warning: "text-warning",
  brand: "text-brand-dark",
  gold: "text-gold-dark",
};

interface StatCardProps {
  icon: string; // tabler icon class, e.g. "ti-wallet"
  label: string;
  value: string;
  tone: Tone;
}

export function StatCard({ icon, label, value, tone }: StatCardProps) {
  return (
    <div className="bg-white border border-line rounded-card p-4 shadow-card">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center mb-3 ${TONE_CLASS[tone]}`}>
        <i className={`ti ${icon} text-lg`} aria-hidden="true" />
      </div>
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className={`text-xl font-semibold ${VALUE_TONE_CLASS[tone]}`}>{value}</div>
    </div>
  );
}