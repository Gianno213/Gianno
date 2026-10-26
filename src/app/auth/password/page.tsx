import { getUserContext } from "@/lib/auth";
import { updatePassword } from "@/app/actions";
import { redirect } from "next/navigation";
export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user } = await getUserContext();
  if (!user) redirect("/login");
  const params = await searchParams;
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · ACCESSO</p>
        <h1>Imposta la password</h1>
        {params.error && <p role="alert">{params.error}</p>}
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
      </section>
    </main>
  );
}
