import { getUserContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import MfaForm from "./mfa-form";
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const destination =
    params.next === "/auth/password" ? "/auth/password" : "/dashboard";
  const { user, profile, supabase } = await getUserContext();
  if (!user || !supabase) redirect("/login");
  if (profile?.role === "responsabile" && destination !== "/auth/password")
    redirect("/dashboard");
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect(destination);
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · SICUREZZA</p>
        <h1>Verifica in due passaggi</h1>
        <p>
          Direzione e HR devono verificare il codice della propria applicazione
          di autenticazione.
        </p>
        <MfaForm destination={destination} />
      </section>
    </main>
  );
}
