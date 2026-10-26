import { signIn, requestPasswordReset } from "@/app/actions";
import { isConfigured } from "@/lib/supabase/server";
import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE</p>
        <h1>Bentornato.</h1>
        <p>Accedi al tuo spazio di lavoro con l’account aziendale.</p>
        {params.success && (
          <p role="status" className="notice">
            {params.success}
          </p>
        )}
        {params.error && (
          <p role="alert" className="notice error">
            {params.error}
          </p>
        )}
        {!isConfigured() ? (
          <p className="notice">
            Supabase non è ancora configurato. Segui il README e imposta le
            variabili in .env.local.
          </p>
        ) : (
          <form action={signIn}>
            <label>
              Email aziendale
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button className="button" type="submit">
              Accedi
            </button>
          </form>
        )}
        {isConfigured() && (
          <details>
            <summary>Password dimenticata?</summary>
            <form action={requestPasswordReset}>
              <label>
                Email aziendale
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <button className="button">Invia istruzioni di recupero</button>
            </form>
          </details>
        )}
        <p className="muted">
          L’accesso è riservato agli utenti abilitati. Per Direzione e HR è
          richiesta l’autenticazione a due fattori.
        </p>
        <Link href="/">Configurazione ambiente</Link>
      </section>
    </main>
  );
}
