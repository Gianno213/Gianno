import { getUserContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import MfaForm from "./mfa-form";
export default async function MfaPage() {
  const { user, profile, supabase } = await getUserContext();
  if (!user || !supabase) redirect("/login");
  if (profile?.role === "responsabile") redirect("/dashboard");
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect("/dashboard");
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · SICUREZZA</p>
        <h1>Verifica in due passaggi</h1>
        <p>
          Direzione e HR devono verificare il codice della propria applicazione
          di autenticazione.
        </p>
        <MfaForm />
      </section>
    </main>
  );
}
