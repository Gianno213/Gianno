"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { completeAuthCallback, INVALID_AUTH_LINK } from "@/lib/auth/callback";
export default function AuthCallback() {
  const task = useRef<Promise<string> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    task.current ??= completeAuthCallback({
      url: window.location.href,
      clearUrl: () =>
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname,
        ),
      createClient,
    });
    void task.current.then(
      (destination) => {
        if (active) window.location.replace(destination);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · ACCESSO SICURO</p>
        <h1>
          {error
            ? "Collegamento non utilizzabile"
            : "Verifica del collegamento"}
        </h1>
        {error ? (
          <>
            <p role="alert">{INVALID_AUTH_LINK}</p>
            <Link href="/login">Richiedi una nuova email</Link>
          </>
        ) : (
          <p role="status">Verifica della sessione in corso…</p>
        )}
      </section>
    </main>
  );
}
