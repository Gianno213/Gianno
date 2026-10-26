export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="stack" style={{ gap: 22 }}>
      <div className="skeleton" style={{ width: "40%", height: 40 }} />
      <div className="stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 130 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 320 }} />
      <span className="muted">Caricamento dello spazio di lavoro…</span>
    </div>
  );
}
