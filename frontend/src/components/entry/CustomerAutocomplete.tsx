/*
This component is CustomerAutocomplete. 
It is a search box with suggestions that helps users quickly find an existing customer while creating a new transaction.
Instead of typing the full customer name every time, users can type a few letters and select the correct customer from a dropdown list.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCustomers } from "@/services/customerService";
import type { Customer } from "@/types/customer";

interface CustomerAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (customer: Customer) => void;
}

function initials(name: string): string {
  return (
    name.trim().split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?"
  );
}

// Debounced search-as-you-type. We wait 300ms after the last keystroke
// before hitting the API — without this, every keystroke fires a request,
// which is wasteful and can cause older responses to overwrite newer ones.
export function CustomerAutocomplete({ value, onChange, onSelect }: CustomerAutocompleteProps) {
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await fetchCustomers(1, value);

        setResults(matches.items);
        setOpen(matches.items.length > 0);
      } catch {
        // Silently ignore search failures — worst case the dropdown
        // just doesn't show suggestions, the user can still type a new name.
        setResults([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <i className="ti ti-user-search text-base text-[#6B7280]" aria-hidden="true" />
        <span className="text-[13px] font-medium text-[#6B7280]">Customer name</span>
      </div>
      <input
        className="w-full bg-white border-[1.5px] border-[#E5E7EB] rounded-[10px] px-4 py-3.5 text-base outline-none focus:border-[#1D9E75]"
        placeholder="Type to search customer…"
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#D1D5DB] rounded-[10px] z-50">
          {results.map((c) => (
            <div
              key={c.id}
              className="px-3.5 py-2.5 cursor-pointer border-b border-[#E5E7EB] last:border-none hover:bg-[#F5F6F8] flex items-center gap-2.5"
              onClick={() => {
                onSelect(c);
                setOpen(false);
              }}
            >
              <div className="w-[30px] h-[30px] rounded-full bg-[#E1F5EE] text-[#085041] flex items-center justify-center text-[11px] font-medium flex-shrink-0">
                {initials(c.name)}
              </div>
              <div className="flex-1">
                <div className="text-sm text-[#111827] font-medium">{c.name}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{c.phone}</div>
              </div>
              <i className="ti ti-chevron-right text-base text-[#9CA3AF]" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}