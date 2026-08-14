/*
  ORIGINAL PATH: src/components/customer-shell/Toast.tsx

  Small reusable toast — mirrors the owner app's inline .toast pattern
  (fixed message that appears then auto-dismisses) but as a component
  so every customer page can trigger one without repeating the timeout
  logic. Renders fixed at the top of the 430px frame so it's visible
  above the scrollable content, below the topbar.
*/
"use client";

import { useEffect } from "react";
import { IconCircleCheck, IconAlertCircle } from "@tabler/icons-react";

export interface ToastState {
  message: string;
  variant: "success" | "error";
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.variant === "success";

  return (
    <div className="fixed top-3 left-4 right-4 z-50 fade-in max-w-[398px] mx-auto">
      <div
        className={`rounded-input px-4 py-3 text-sm font-medium flex items-center gap-2 shadow-card ${
          isSuccess ? "bg-success text-white" : "bg-danger text-white"
        }`}
      >
        {isSuccess ? <IconCircleCheck size={18} /> : <IconAlertCircle size={18} />}
        {toast.message}
      </div>
    </div>
  );
}