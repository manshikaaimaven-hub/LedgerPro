/*
This component is called ProtectedRoute. 
Its job is to protect pages that should only be accessible to logged-in users.
*/
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

/**
 * Wrap any page's content with this component to require a logged-in
 * session. Usage in a page file:
 *
 *   export default function SummaryPage() {
 *     return (
 *       <ProtectedRoute>
 *         ...actual page content...
 *       </ProtectedRoute>
 *     );
 *   }
 *
 * Why a `checked` state instead of just checking isLoggedIn() directly
 * in the render: on first render (both server-render during build AND
 * the initial client render before hydration), we can't safely read
 * localStorage. So we render nothing until after the check runs in
 * useEffect (which only runs in the browser), avoiding a flash of
 * protected content before the redirect kicks in.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login/");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null; // render nothing while checking / redirecting

  return <>{children}</>;
}