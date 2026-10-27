"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function MfaForm({
  destination = "/dashboard",
}: {
  destination?: string;
}) {
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function prepare() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: factors, error: e } = await supabase.auth.mfa.listFactors();
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactor(verified.id);
      setBusy(false);
      return;
    }
    for (const old of factors.all.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    ))
      await supabase.auth.mfa.unenroll({ factorId: old.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Gianno People",
    });
    if (error) {
      setError(error.message);
    } else {
      setFactor(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setBusy(false);
  }
  async function verify(form: FormData) {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor,
      code: String(form.get("code") || ""),
    });
    if (error) {
      setError("Codice non valido o scaduto. Riprova.");
      setBusy(false);
    } else
      window.location.assign(
        destination === "/auth/password" ? "/auth/password" : "/dashboard",
      );
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!factor ? (
        <button className="button" onClick={prepare} disabled={busy}>
          Configura o verifica MFA
        </button>
      ) : (
        <>
          {qr && (
            <>
              <p>
                Scansiona questo codice con la tua applicazione Authenticator,
                quindi conserva il dispositivo in sicurezza.
              </p>
              {/* SVG generated exclusively by Supabase Auth. */}
              <img
                alt="Codice QR per configurare MFA"
                src={qr}
                width={220}
                height={220}
              />
              <details>
                <summary>Chiave per configurazione manuale</summary>
                <code>{secret}</code>
              </details>
            </>
          )}
          <form action={verify}>
            <label>
              Codice a 6 cifre
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
            </label>
            <button className="button" disabled={busy}>
              Verifica e accedi
            </button>
          </form>
        </>
      )}
    </>
  );
}
