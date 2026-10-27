import Link from "next/link";
import { getUserContext } from "@/lib/auth";
import { updatePassword } from "@/app/actions";
import { redirect } from "next/navigation";
export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user, supabase } = await getUserContext();
  if (!user || !supabase)
    redirect(
      "/login?error=Sessione%20non%20valida.%20Richiedi%20una%20nuova%20email%20di%20recupero.",
    );
  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa =
    assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2";
  const params = await searchParams;
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · ACCESSO</p>
        <h1>Imposta la password</h1>
        {params.error && <p role="alert">{params.error}</p>}
        {needsMfa ? (
          <>
            <p>
              Prima di cambiare la password, verifica il secondo fattore già
              associato al tuo account.
            </p>
            <Link className="button" href="/auth/mfa?next=/auth/password">
              Verifica MFA e continua
            </Link>
          </>
        ) : (
          <form action={updatePassword}>
            <label>
              Nuova password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Conferma password
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button className="button">Salva password</button>
          </form>
        )}
      </section>
    </main>
  );
}
