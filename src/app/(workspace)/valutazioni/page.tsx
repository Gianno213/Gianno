import { italianMonth } from "@/domain/dates";
import {
  saveEvaluation,
  updateEvaluationStatus,
  rectifyEvaluation,
} from "@/app/actions";
import { workspaceData, fullName, employeeOptions } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  SearchForm,
  Badge,
  EmployeeName,
  Feedback,
  statusLabel,
  Notice,
} from "@/components/ui";
import { Plus, ClipboardCheck } from "lucide-react";
export default async function Evaluations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "employees",
    "locations",
    "evaluations",
    "evaluation_templates",
    "diary_entries",
  ]);
  const employees = data.employees || [],
    templates = data.evaluation_templates || [];
  const template =
    templates.find((t) => t.id === params.template) ||
    templates.find((t) => t.active);
  const period = params.period || italianMonth();
  const evaluations = (data.evaluations || [])
    .filter(
      (e) =>
        (!params.employee || e.employee_id === params.employee) &&
        (!params.status || e.status === params.status) &&
        e.period.startsWith(period) &&
        (!params.q ||
          fullName(employees.find((p) => p.id === e.employee_id))
            .toLowerCase()
            .includes(params.q.toLowerCase())),
    )
    .sort((a, b) => b.revision - a.revision);
  const canWrite = profile?.role !== "hr";
  return (
    <>
      <PageHeader
        eyebrow="IL CONFRONTO CHE FA CRESCERE"
        title="Valutazioni mensili"
        description="Una valutazione al mese, motivata dai fatti e accompagnata dal dialogo."
      >
        {canWrite && (
          <a href="#nuova" className="button">
            <Plus size={15} />
            Compila valutazione
          </a>
        )}
      </PageHeader>
      <Feedback params={params} />
      <div className="stats">
        <div className="stat">
          <p className="muted">Collaboratori attivi</p>
          <strong>
            {employees.filter((e) => e.status === "attivo").length}
          </strong>
        </div>
        <div className="stat">
          <p className="muted">Inviate / da verificare</p>
          <strong>
            {
              evaluations.filter((e) =>
                ["inviata", "da_verificare"].includes(e.status),
              ).length
            }
          </strong>
        </div>
        <div className="stat">
          <p className="muted">Convalidate</p>
          <strong>
            {evaluations.filter((e) => e.status === "convalidata").length}
          </strong>
        </div>
        <div className="stat">
          <p className="muted">Non valutabili</p>
          <strong>{evaluations.filter((e) => e.not_evaluable).length}</strong>
        </div>
      </div>
      <Card>
        <SearchForm placeholder="Ricerca per collaboratore…">
          <input name="period" type="month" defaultValue={period} />
          <select name="employee" defaultValue={params.employee || ""}>
            <option value="">Tutti i collaboratori</option>
            {employeeOptions(employees)}
          </select>
          <select name="status" defaultValue={params.status || ""}>
            <option value="">Tutti gli stati</option>
            <option value="bozza">Bozza</option>
            <option value="inviata">Inviata</option>
            <option value="da_verificare">Da verificare</option>
            <option value="convalidata">Convalidata</option>
          </select>
        </SearchForm>
        {evaluations.length ? (
          <div className="timeline">
            {evaluations.map((e) => (
              <article key={e.id} className="timeline-item">
                <div className="timeline-top">
                  <EmployeeName
                    id={e.employee_id}
                    name={fullName(
                      employees.find((p) => p.id === e.employee_id),
                    )}
                    subtitle={`${e.period.slice(0, 7)} · revisione ${e.revision}`}
                  />
                  <div className="row-actions">
                    <span className="score">
                      {e.not_evaluable
                        ? "N/V"
                        : Number(e.weighted_score || 0).toFixed(2)}{" "}
                      <small>{!e.not_evaluable && "/ 5"}</small>
                    </span>
                    <Badge
                      tone={
                        e.status === "convalidata"
                          ? "success"
                          : e.status === "bozza"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {statusLabel(e.status)}
                    </Badge>
                  </div>
                </div>
                <p>{e.not_evaluable ? e.reason : e.comment}</p>
                <details style={{ marginTop: 12 }}>
                  <summary className="text-link">Dettagli e operazioni</summary>
                  <dl className="key-values" style={{ marginTop: 15 }}>
                    {(
                      templates.find((t) => t.id === e.template_id)?.criteria ||
                      []
                    ).map((c: any) => (
                      <div key={c.key}>
                        <dt>
                          {c.label} · {c.weight}%
                        </dt>
                        <dd>
                          {e.not_evaluable
                            ? "Non valutabile"
                            : e.scores[c.key] || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {e.status === "bozza" && canWrite && (
                    <form
                      action={saveEvaluation}
                      className="stack"
                      style={{ gap: 12, marginTop: 20 }}
                    >
                      <input type="hidden" name="id" value={e.id} />
                      <input
                        type="hidden"
                        name="employee_id"
                        value={e.employee_id}
                      />
                      <input
                        type="hidden"
                        name="template_id"
                        value={e.template_id}
                      />
                      <input
                        type="hidden"
                        name="period"
                        value={e.period.slice(0, 7)}
                      />
                      <input
                        type="hidden"
                        name="return_to"
                        value="/valutazioni"
                      />
                      {(
                        templates.find((t) => t.id === e.template_id)
                          ?.criteria || []
                      ).map((c: any) => (
                        <Field label={`${c.label} · ${c.weight}%`} key={c.key}>
                          <select
                            name={`score_${c.key}`}
                            defaultValue={e.scores[c.key] || ""}
                          >
                            <option value="">Da compilare</option>
                            {[1, 2, 3, 4, 5].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ))}
                      <Field label="Commento conclusivo">
                        <textarea name="comment" defaultValue={e.comment} />
                      </Field>
                      <label className="inline-checkbox">
                        <input
                          type="checkbox"
                          name="not_evaluable"
                          defaultChecked={e.not_evaluable}
                        />
                        Non valutabile
                      </label>
                      <input
                        name="reason"
                        placeholder="Motivazione non valutabilità"
                        defaultValue={e.reason || ""}
                      />
                      <div className="row-actions">
                        <button
                          name="status"
                          value="bozza"
                          className="button button-secondary"
                        >
                          Salva bozza
                        </button>
                        <button
                          name="status"
                          value="inviata"
                          className="button"
                        >
                          Invia alla Direzione
                        </button>
                      </div>
                    </form>
                  )}
                  {profile?.role === "direzione" &&
                    e.status !== "convalidata" && (
                      <form
                        action={updateEvaluationStatus}
                        className="row-actions"
                        style={{ marginTop: 16 }}
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <input
                          type="hidden"
                          name="return_to"
                          value="/valutazioni"
                        />
                        <select name="status">
                          <option value="da_verificare">
                            Richiedi verifica
                          </option>
                          <option value="convalidata">
                            Convalida valutazione
                          </option>
                          <option value="bozza">Riapri bozza</option>
                        </select>
                        <Submit>Aggiorna stato</Submit>
                      </form>
                    )}
                  {profile?.role === "direzione" &&
                    e.status === "convalidata" && (
                      <form
                        action={rectifyEvaluation}
                        className="stack"
                        style={{ gap: 10, marginTop: 18 }}
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <input
                          type="hidden"
                          name="return_to"
                          value="/valutazioni"
                        />
                        <Field label="Rettifica tracciata">
                          <input
                            name="rectification_reason"
                            required
                            minLength={5}
                            placeholder="Motivazione della nuova revisione"
                          />
                        </Field>
                        <Submit>Crea nuova revisione</Submit>
                      </form>
                    )}
                </details>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Nessuna scheda per questo periodo"
            description="Inizia con una bozza. Le valutazioni convalidate conserveranno lo storico delle revisioni."
          />
        )}
      </Card>
      {canWrite && (
        <div style={{ marginTop: 24 }}>
          <Card
            title="Compila la scheda mensile"
            description="Consulta prima le osservazioni del periodo. I pesi sono definiti nella versione del modello."
          >
            {template ? (
              <form action={saveEvaluation} className="card-body" id="nuova">
                <input type="hidden" name="return_to" value="/valutazioni" />
                <div className="form-grid">
                  <Field label="Collaboratore">
                    <select
                      name="employee_id"
                      required
                      defaultValue={params.employee || ""}
                    >
                      <option value="">Seleziona un collaboratore</option>
                      {employeeOptions(employees)}
                    </select>
                  </Field>
                  <Field label="Mese di valutazione">
                    <input
                      name="period"
                      type="month"
                      defaultValue={period}
                      required
                    />
                  </Field>
                </div>
                <div style={{ marginTop: 18, marginBottom: 20 }}>
                  <Field label="Modello e versione">
                    <input
                      name="template_id"
                      type="hidden"
                      value={template.id}
                    />
                    <input
                      readOnly
                      value={`${template.name} · versione ${template.version}`}
                    />
                  </Field>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Per cambiare i criteri visualizzati:{" "}
                    {templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <a
                          key={t.id}
                          className="text-link"
                          style={{ marginRight: 12 }}
                          href={`?template=${t.id}#nuova`}
                        >
                          {t.name} v{t.version}
                        </a>
                      ))}
                  </p>
                </div>
                <div className="rating-grid">
                  {template.criteria.map((c: any) => (
                    <div key={c.key} style={{ display: "contents" }}>
                      <label htmlFor={`score_${c.key}`}>
                        {c.label} <span className="muted">· {c.weight}%</span>
                      </label>
                      <select
                        id={`score_${c.key}`}
                        name={`score_${c.key}`}
                        defaultValue=""
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {v} / 5
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <Field label="Osservazioni e motivazione professionale">
                  <textarea
                    name="comment"
                    maxLength={6000}
                    placeholder="Descrivi gli elementi concreti che motivano la valutazione. Per punteggi 1 o 2 è richiesta una motivazione dettagliata."
                  />
                </Field>
                <label className="inline-checkbox" style={{ marginTop: 18 }}>
                  <input type="checkbox" name="not_evaluable" />
                  Non valutabile: attività insufficiente per un giudizio
                  attendibile
                </label>
                <input
                  name="reason"
                  placeholder="Motiva la non valutabilità (se selezionata)"
                  style={{ width: "100%", marginTop: 10 }}
                />
                <div className="form-actions">
                  <button
                    type="submit"
                    name="status"
                    value="bozza"
                    className="button button-secondary"
                  >
                    Salva bozza
                  </button>
                  <button
                    type="submit"
                    name="status"
                    value="inviata"
                    className="button"
                  >
                    <ClipboardCheck size={16} />
                    Invia alla Direzione
                  </button>
                </div>
              </form>
            ) : (
              <div className="card-body">
                <Notice>
                  Non sono presenti modelli di valutazione. La Direzione deve
                  creare il primo modello in Impostazioni.
                </Notice>
              </div>
            )}
          </Card>
        </div>
      )}
      <Notice>
        Ferie, malattia, maternità e altre assenze tutelate non entrano nel
        calcolo del punteggio. Nessuna valutazione produce decisioni automatiche
        sul rapporto di lavoro.
      </Notice>
    </>
  );
}
