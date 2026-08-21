"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/owner/login/");
  }, [router]);

  return <div className="min-h-screen" />;
}