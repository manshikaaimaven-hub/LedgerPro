// /*
// This component is called TypeSelector. 
// Its job is to let the user choose what kind of transaction they are creating.

// There are only two options:
// Credit Note (cr) – Increases the customer's outstanding balance.
// Debit Note (dr) – Decreases the customer's outstanding balance.

// It doesn't save any data itself. 
// It only tells the parent page which option the user selected.

// */

// import type { TransactionType } from "@/types/transaction";

// interface TypeSelectorProps {
//   value: TransactionType;
//   onChange: (type: TransactionType) => void;
// }

// const COPY: Record<TransactionType, { label: string; desc: string; hint: string }> = {
//   cr: {
//     label: "Credit note",
//     desc: "Add to bill",
//     hint: "Credit note — bill amount is added to the customer's outstanding balance.",
//   },
//   dr: {
//     label: "Debit note",
//     desc: "Reduce balance",
//     hint: "Debit note — reduces the customer's outstanding balance (e.g. return, correction, discount).",
//   },
// };

// export function TypeSelector({ value, onChange }: TypeSelectorProps) {
//   return (
//     <>
//       <div className="flex gap-2.5">
//         {(["cr", "dr"] as TransactionType[]).map((type) => {
//           const active = value === type;
//           const activeColor = type === "cr" ? "#1D9E75" : "#E24B4A";
//           const activeBg = type === "cr" ? "#f6fdfb" : "#fff8f8";
//           const iconBg = type === "cr" ? "#E1F5EE" : "#FCEBEB";

//           return (
//             <button
//               key={type}
//               type="button"
//               onClick={() => onChange(type)}
//               className="flex-1 p-4 rounded-xl border-[1.5px] flex flex-col items-center gap-1.5 transition-all"
//               style={{
//                 borderColor: active ? activeColor : "#E5E7EB",
//                 background: active ? activeBg : "transparent",
//               }}
//             >
//               <div
//                 className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
//                 style={{ background: active ? iconBg : "#F5F6F8", color: active ? activeColor : "#6B7280" }}
//               >
//                 <i className={`ti ${type === "cr" ? "ti-arrow-down-circle" : "ti-arrow-up-circle"}`} aria-hidden="true" />
//               </div>
//               <div className="text-[13px] font-medium" style={{ color: active ? activeColor : "#6B7280" }}>
//                 {COPY[type].label}
//               </div>
//               <div className="text-[11px] text-center leading-tight text-[#9CA3AF]">
//                 {COPY[type].desc}
//               </div>
//             </button>
//           );
//         })}
//       </div>

//       <div
//         className="rounded-lg p-3 text-[13px] leading-relaxed flex items-start gap-2 mt-3"
//         style={{ background: "#F5F6F8", color: "#6B7280" }}
//       >
//         <i
//           className="ti ti-info-circle text-[17px] flex-shrink-0 mt-0.5"
//           style={{ color: value === "cr" ? "#1D9E75" : "#E24B4A" }}
//           aria-hidden="true"
//         />
//         <span>{COPY[value].hint}</span>
//       </div>
//     </>
//   );
// }

"use client";

import type { TransactionType } from "@/types/transaction";

interface TypeSelectorProps {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}

const OPTIONS: { type: TransactionType; label: string; sub: string; icon: string }[] = [
  { type: "cr", label: "Credit", sub: "Money in", icon: "ti-arrow-down-circle" },
  { type: "dr", label: "Debit", sub: "Money out", icon: "ti-arrow-up-circle" },
];

export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Entry type">
      {OPTIONS.map((opt) => {
        const active = value === opt.type;
        const isCredit = opt.type === "cr";

        return (
          <button
            key={opt.type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.type)}
            className={[
              "group relative flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left",
              "transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              active
                ? isCredit
                  ? "border-success bg-success-light shadow-glow-success focus-visible:ring-success"
                  : "border-danger bg-danger-light shadow-glow-danger focus-visible:ring-danger"
                : "border-line bg-surface hover:border-line-strong focus-visible:ring-brand",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border text-xl transition-colors",
                active
                  ? isCredit
                    ? "border-success/30 bg-white text-success"
                    : "border-danger/30 bg-white text-danger"
                  : "border-line bg-page text-text-tertiary group-hover:text-text-secondary",
              ].join(" ")}
            >
              <i className={`ti ${opt.icon}`} aria-hidden="true" />
            </span>

            <span className="flex flex-col leading-tight">
              <span
                className={`text-[15px] font-semibold ${
                  active ? (isCredit ? "text-success-dark" : "text-danger-dark") : "text-text-primary"
                }`}
              >
                {opt.label}
              </span>
              <span className="text-[12px] text-text-secondary">{opt.sub}</span>
            </span>

            {active && (
              <span
                className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white ${
                  isCredit ? "bg-success" : "bg-danger"
                }`}
                aria-hidden="true"
              >
                <i className="ti ti-check" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}