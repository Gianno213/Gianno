"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="card">
      <div className="empty">
        <h1 style={{ fontSize: 24 }}>
          Non è stato possibile caricare questa pagina.
        </h1>
        <p>
          Verifica la connessione e riprova. Se il problema continua, contatta
          la Direzione per verificare configurazione e autorizzazioni.
        </p>
        <button className="button" onClick={reset}>
          Riprova
        </button>
      </div>
    </section>
  );
}
