/*
  ORIGINAL PATH: src/components/customer-shell/CustomerProtectedRoute.tsx

  Same hydration-safe pattern as the owner's ProtectedRoute — checked
  state starts false, flips true only after a useEffect confirms both
  a customer token AND a selected business exist. Prevents a flash of
  protected content during static-export pre-render.
*/
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCustomerToken } from "@/services/customerAuthService";
import { getCurrentBusiness } from "@/lib/currentBusiness";

export default function CustomerProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getCustomerToken();
    if (!token) {
      router.push("/customer/customer-login");
      return;
    }
    const business = getCurrentBusiness();
    if (!business) {
      // Logged in, but hasn't picked/been assigned a business yet.
      router.push("/customer-select-business");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) return null; // render nothing until confirmed — avoids flash
  return <>{children}</>;
}