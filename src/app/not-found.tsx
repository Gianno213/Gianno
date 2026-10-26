import Link from "next/link";
export default function NotFound() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <p className="eyebrow">GIANNO PEOPLE</p>
        <h1>Questa pagina non è disponibile.</h1>
        <p>
          La risorsa potrebbe non esistere o non essere accessibile con le tue
          autorizzazioni.
        </p>
        <Link href="/dashboard" className="button">
          Torna alla panoramica
        </Link>
      </section>
    </main>
  );
}
