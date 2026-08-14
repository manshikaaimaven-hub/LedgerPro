/*
  ORIGINAL PATH: src/components/summary/NetOutstandingCard.tsx

  Shows the business's overall outstanding balance as one big number —
  green if customers owe the business money (receivable), red if the
  business owes customers money (payable).

*/
import { IconCoinRupee } from "@tabler/icons-react";

interface NetOutstandingCardProps {
  net: number;
  label: "receivable" | "payable";
}

function formatCurrency(n: number): string {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export function NetOutstandingCard({ net, label }: NetOutstandingCardProps) {
  const isPositive = net >= 0;

  return (
    <div
      className={`relative overflow-hidden backdrop-blur-md border rounded-card min-h-[104px] p-4 flex items-center justify-between ${
        isPositive
          ? "bg-[#F6FFFA] border-[#C7F0DB]"
          : "bg-[#FFF7F8] border-[#F8C8CF]"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-card flex items-center justify-center flex-shrink-0 mr-3.5 bg-gradient-to-br ${
          isPositive
            ? "bg-white border-2 border-success/30 text-success-dark shadow-sm"
            : "bg-white border-2 border-danger/30 text-danger-dark shadow-sm"
        }`}
      >
        <IconCoinRupee size={24} />
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-display text-text-secondary mb-1">Net outstanding</div>
        <div className={`text-[27px] font-semibold tabular-nums ${isPositive ? "text-success-dark" : "text-danger-dark"}`}>
          {formatCurrency(net)}
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium capitalize backdrop-blur-sm ${
          isPositive ? "bg-success/15 text-success-dark" : "bg-danger/15 text-danger-dark"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? "bg-success" : "bg-danger"}`} />
        {label}
      </div>
    </div>
  );
}