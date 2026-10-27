"use client";
import { useEffect } from "react";
import { hasRecoveryFragment } from "@/lib/auth/callback";
export default function RecoveryLanding() {
  useEffect(() => {
    if (!hasRecoveryFragment(window.location.hash)) return;
    const fragment = window.location.hash;
    // Keep tokens only in the fragment: it is never sent to the application server.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    window.location.replace("/auth/callback" + fragment);
  }, []);
  return null;
}
