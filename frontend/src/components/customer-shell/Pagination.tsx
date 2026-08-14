/*
  ORIGINAL PATH: src/components/customer-shell/Pagination.tsx

  Simple prev/next pager with a "Page X of Y" label — fits comfortably
  in 430px width, unlike numbered page buttons which would wrap awkwardly.
*/
"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 px-3 py-2 rounded-input border border-line text-xs font-medium text-text-secondary disabled:opacity-40"
      >
        <IconChevronLeft size={14} /> Prev
      </button>
      <span className="text-xs text-text-tertiary">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-2 rounded-input border border-line text-xs font-medium text-text-secondary disabled:opacity-40"
      >
        Next <IconChevronRight size={14} />
      </button>
    </div>
  );
}