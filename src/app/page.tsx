import Link from "next/link";
import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/supabase/server";
export default function Home() {
  if (isConfigured()) redirect("/dashboard");
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE · AMBIENTE DI SVILUPPO</p>
        <h1>Le persone, al centro.</h1>
        <p>
          Il progetto è installato. Collega un progetto Supabase per attivare
          autenticazione, fascicoli e documenti privati.
        </p>
        <ol>
          <li>Crea un progetto Supabase in una regione UE.</li>
          <li>
            Applica le migrazioni nella cartella{" "}
            <code>supabase/migrations</code>.
          </li>
          <li>
            Copia <code>.env.example</code> in <code>.env.local</code> e imposta
            URL e chiave pubblica.
          </li>
          <li>
            Crea il primo account Direzione seguendo il README, abilita MFA e
            riavvia il server.
          </li>
        </ol>
        <p>
          I dati reali non sono disponibili finché la configurazione non è
          completata. Nessun account dimostrativo aggira i controlli di accesso.
        </p>
        <Link className="button" href="/login">
          Vai all’accesso
        </Link>
      </section>
    </main>
  );
}
