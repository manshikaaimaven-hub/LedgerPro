"use client";

import  ProtectedRoute from "@/components/ProtectedRoute";
import SummaryPage from "@/app/owner/SummaryPage";
import { AppShell } from "@/components/layout/AppShell";

// Root route ("/") IS the Summary/Dashboard page — matches your bottom
// nav where Summary is the home tab, and matches login's router.push("/").
// ProtectedRoute handles the "not logged in → send to /login" redirect
// client-side, since static export has no server to do it for us.
export default function Home() {
  return (
    <ProtectedRoute>
      <AppShell>
        <SummaryPage />
      </AppShell>
      
    </ProtectedRoute>
  );
}