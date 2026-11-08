import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginGate } from "@/components/login-gate";

export const metadata: Metadata = {
  title: "Sign in",
};

export const instant = false;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <LoginGate />
    </Suspense>
  );
}
