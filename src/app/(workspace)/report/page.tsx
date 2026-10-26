import { latestApprovedEvaluations } from "@/domain/evaluations";
import { italianYear } from "@/domain/dates";
import { saveAnnualPlan } from "@/app/actions";
import {
  workspaceData,
  fullName,
  employeeOptions,
  latestEvaluations,
} from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Feedback,
  Notice,
  SearchForm,
  Stat,
  Badge,
  date,
} from "@/components/ui";
import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "employees",
    "locations",
    "evaluations",
    "diary_entries",
    "goals",
    "training_records",
    "annual_plans",
  ]);
  if (profile?.role !== "direzione") redirect("/dashboard");
  const employees = data.employees || [],
    employee = employees.find((e) => e.id === params.employee) || employees[0];
  const year = Number(params.year) || italianYear();
  const evaluations = latestEvaluations(
    (data.evaluations || []).filter(
      (e) =>
        e.employee_id === employee?.id && e.period.startsWith(String(year)),
    ),
  );
  const approved = latestApprovedEvaluations(
    (data.evaluations || []).filter(
      (e) =>
        e.employee_id === employee?.id &&
        e.period.startsWith(String(year)) &&
        e.status === "convalidata",
    ),
  ).filter((e) => e.status === "convalidata" && !e.not_evaluable);
  const avg = approved.length
    ? approved.reduce((s, e) => s + Number(e.weighted_score), 0) /
      approved.length
    : null;
  const notes = (data.diary_entries || []).filter(
    (n) =>
      n.employee_id === employee?.id && n.event_on.startsWith(String(year)),
  );
  const goals = (data.goals || []).filter(
    (g) =>
      g.employee_id === employee?.id &&
      g.assigned_on.slice(0, 4) <= String(year),
  );
  return (
    <>
      <PageHeader
        eyebrow="UNO SGUARDO AL PERCORSO"
        title="Report annuali"
        description="Un fascicolo di confronto, costruito su osservazioni e valutazioni verificate."
      />
      <Feedback params={params} />
      <Card>
        <SearchForm>
          <select name="employee" defaultValue={employee?.id || ""}>
            <option value="">Seleziona collaboratore</option>
            {employeeOptions(employees)}
          </select>
          <input
            name="year"
            type="number"
            min="2000"
            max="2200"
            defaultValue={year}
          />
        </SearchForm>
      </Card>
      {employee ? (
        <>
          <div className="page-header" style={{ marginTop: 30 }}>
            <div>
              <p className="eyebrow">FASCICOLO {year}</p>
              <h1>{fullName(employee)}</h1>
              <p className="subtitle">
                {employee.job_title} ·{" "}
                {
                  data.locations?.find((l) => l.id === employee.location_id)
                    ?.name
                }{" "}
                · In azienda dal {date(employee.hired_on)}
              </p>
            </div>
          </div>
          <div className="stats">
            <Stat
              label="Media annuale convalidata"
              value={avg ? `${avg.toFixed(2)} / 5` : "—"}
              detail={`${approved.length} mesi effettivamente valutati`}
            />
            <Stat
              label="Osservazioni del periodo"
              value={notes.length}
              detail="Fatti documentati nel diario"
            />
            <Stat
              label="Obiettivi completati"
              value={goals.filter((g) => g.status === "completato").length}
              detail={`${goals.length} obiettivi assegnati entro l’anno`}
            />
            <Stat
              label="Percorsi formativi"
              value={
                (data.training_records || []).filter(
                  (t) =>
                    t.employee_id === employee.id &&
                    t.completed_on?.startsWith(String(year)),
                ).length
              }
              detail="Corsi e affiancamenti completati"
            />
          </div>
          <div className="grid-main">
            <div className="stack">
              <Card
                title="Le valutazioni dell’anno"
                description="Ultima revisione di ogni periodo. La media comprende solo le convalidate."
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mese</th>
                        <th>Punteggio</th>
                        <th>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }, (_, i) => {
                        const e = evaluations.find(
                          (e) =>
                            e.period ===
                            `${year}-${String(i + 1).padStart(2, "0")}-01`,
                        );
                        return (
                          <tr key={i}>
                            <td>
                              {new Date(year, i, 1).toLocaleDateString(
                                "it-IT",
                                { month: "long" },
                              )}
                            </td>
                            <td>
                              {e
                                ? e.not_evaluable
                                  ? "Non valutabile"
                                  : e.weighted_score
                                : "Non disponibile"}
                            </td>
                            <td>
                              {e ? (
                                <Badge
                                  tone={
                                    e.status === "convalidata"
                                      ? "success"
                                      : "neutral"
                                  }
                                >
                                  {e.status}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Osservazioni e piano per l’anno successivo">
                <form action={saveAnnualPlan} className="card-body">
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="year" value={year} />
                  <input
                    type="hidden"
                    name="return_to"
                    value={`/report?employee=${employee.id}&year=${year}`}
                  />
                  <Field label="Piano di miglioramento e sviluppo">
                    <textarea
                      name="observations"
                      rows={6}
                      required
                      minLength={5}
                      defaultValue={
                        data.annual_plans?.find(
                          (p) =>
                            p.employee_id === employee.id && p.year === year,
                        )?.observations || ""
                      }
                      placeholder="Definisci insieme al collaboratore priorità, attività e occasioni di verifica per il prossimo anno."
                    />
                  </Field>
                  <div className="form-actions">
                    <Submit>Salva piano annuale</Submit>
                  </div>
                </form>
              </Card>
            </div>
            <div className="stack">
              <Card
                title="Esporta fascicolo PDF"
                description="Grafica Gianno, dati autorizzati e sezioni selezionabili."
              >
                <form
                  action={`/api/reports/${employee.id}`}
                  method="get"
                  className="card-body stack"
                  style={{ gap: 18 }}
                >
                  <input type="hidden" name="year" value={year} />
                  <p className="muted" style={{ lineHeight: 1.9 }}>
                    Il report per il colloquio esclude per impostazione
                    predefinita assenze, contratti e retribuzioni. Aggiungi le
                    sezioni riservate solo se necessarie al destinatario.
                  </p>
                  <label className="inline-checkbox">
                    <input
                      name="include_administrative"
                      type="checkbox"
                      value="1"
                    />
                    Includi riepilogo amministrativo riservato
                  </label>
                  <label className="inline-checkbox">
                    <input name="include_salary" type="checkbox" value="1" />
                    Includi retribuzioni riservate
                  </label>
                  <Submit>
                    <FileDown size={16} />
                    Scarica report PDF
                  </Submit>
                </form>
              </Card>
              <Card title="Il diario nell’anno">
                {notes.length ? (
                  <div className="timeline">
                    {notes.slice(0, 5).map((n) => (
                      <div className="timeline-item" key={n.id}>
                        <Badge
                          tone={
                            n.category === "positivo" ? "success" : "neutral"
                          }
                        >
                          {n.category}
                        </Badge>
                        <p style={{ marginTop: 9 }}>{n.description}</p>
                        <small>{date(n.event_on)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Nessun episodio registrato"
                    description="Le note dell’anno contribuiranno al fascicolo."
                  />
                )}
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card>
          <Empty
            title="Seleziona il primo collaboratore"
            description="I report saranno disponibili dopo la creazione delle anagrafiche."
          />
        </Card>
      )}
    </>
  );
}
