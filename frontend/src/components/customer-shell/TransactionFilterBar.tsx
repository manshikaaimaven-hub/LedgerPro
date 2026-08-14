/*
  ORIGINAL PATH: src/components/customer-shell/TransactionFilterBar.tsx

  Search input + type filter chips + sort toggle. Kept compact for
  430px width — filters collapse into small pill buttons rather than
  dropdowns, matching the app's chip pattern from the owner side
  (.tchip in the HTML prototype).
*/
"use client";

import { IconSearch, IconArrowsSort } from "@tabler/icons-react";

interface TransactionFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  type: "all" | "cr" | "dr";
  onTypeChange: (v: "all" | "cr" | "dr") => void;
  sort: "asc" | "desc";
  onSortChange: (v: "asc" | "desc") => void;
}

export function TransactionFilterBar({
  search, onSearchChange, type, onTypeChange, sort, onSortChange,
}: TransactionFilterBarProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="bg-white border border-line rounded-input flex items-center gap-2 px-3.5 h-11">
        <IconSearch size={17} className="text-text-tertiary shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by note or invoice…"
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        <FilterChip active={type === "all"} onClick={() => onTypeChange("all")} label="All" />
        <FilterChip active={type === "cr"} onClick={() => onTypeChange("cr")} label="Credit" tone="success" />
        <FilterChip active={type === "dr"} onClick={() => onTypeChange("dr")} label="Debit" tone="danger" />

        <button
          onClick={() => onSortChange(sort === "desc" ? "asc" : "desc")}
          className="ml-auto shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-line text-xs font-medium text-text-secondary bg-white"
        >
          <IconArrowsSort size={14} />
          {sort === "desc" ? "Newest" : "Oldest"}
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, label, tone,
}: { active: boolean; onClick: () => void; label: string; tone?: "success" | "danger" }) {
  const activeClass =
    tone === "success" ? "bg-success text-white border-success"
    : tone === "danger" ? "bg-danger text-white border-danger"
    : "bg-brand text-white border-brand";

  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? activeClass : "bg-white text-text-secondary border-line"
      }`}
    >
      {label}
    </button>
  );
}