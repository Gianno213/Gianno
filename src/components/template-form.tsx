"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createTemplate } from "@/app/actions";
import { DEFAULT_CRITERIA } from "@/domain/evaluations";
import { Field, Submit } from "@/components/ui";
export function TemplateForm({ nextVersion = 1 }: { nextVersion?: number }) {
  const [criteria, setCriteria] = useState(() =>
    DEFAULT_CRITERIA.map((c) => ({ ...c, weight: String(c.weight) })),
  );
  const total = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const valid =
    criteria.length > 0 &&
    criteria.every((c) => c.label.trim().length > 0 && Number(c.weight) > 0) &&
    Math.abs(total - 100) < 0.00001;
  function change(index: number, field: "label" | "weight", value: string) {
    setCriteria((previous) =>
      previous.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }
  return (
    <form
      action={createTemplate}
      className="stack"
      style={{ gap: 17, paddingTop: 15 }}
    >
      <input name="return_to" type="hidden" value="/impostazioni" />
      <input
        type="hidden"
        name="criteria"
        value={JSON.stringify(
          criteria.map((c) => ({ ...c, weight: Number(c.weight) })),
        )}
      />
      <Field label="Nome del modello">
        <input name="name" defaultValue="Valutazione mensile Gianno" required />
      </Field>
      <div className="form-grid">
        <Field label="Mansione · facoltativa">
          <input name="job_title" placeholder="Tutte le mansioni" />
        </Field>
        <Field label="Versione">
          <input
            name="version"
            type="number"
            min="1"
            defaultValue={nextVersion}
            required
          />
        </Field>
      </div>
      <div>
        <div className="section-title">
          <h3>Parametri di valutazione</h3>
          <span
            className={valid ? "text-success" : "text-danger"}
            style={{ fontSize: 12 }}
            aria-live="polite"
          >
            Totale {total.toLocaleString("it-IT")} / 100%
          </span>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {criteria.map((c, index) => (
            <div className="criterion-row" key={c.key}>
              <Field label={`Parametro ${index + 1}`}>
                <input
                  value={c.label}
                  required
                  maxLength={200}
                  onChange={(e) => change(index, "label", e.target.value)}
                />
              </Field>
              <Field label="Peso %">
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  required
                  value={c.weight}
                  onChange={(e) => change(index, "weight", e.target.value)}
                />
              </Field>
              <button
                type="button"
                className="icon-button text-danger"
                onClick={() =>
                  setCriteria((previous) =>
                    previous.filter((_, i) => i !== index),
                  )
                }
                aria-label={`Rimuovi parametro ${index + 1}`}
                disabled={criteria.length === 1}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="text-link"
          style={{ border: 0, background: "none", padding: "13px 0" }}
          onClick={() =>
            setCriteria((previous) => [
              ...previous,
              {
                key: `criterio_${crypto.randomUUID().replaceAll("-", "")}`,
                label: "",
                weight: "0",
              },
            ])
          }
        >
          <Plus size={14} />
          Aggiungi parametro
        </button>
        <p className="muted">
          I pesi devono sommare esattamente il 100%. Ogni parametro sarà
          valutato da 1 a 5. Una nuova versione non modifica le schede già
          compilate.
        </p>
      </div>
      <button className="button" type="submit" disabled={!valid}>
        Crea nuova versione
      </button>
    </form>
  );
}
