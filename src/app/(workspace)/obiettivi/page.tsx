import { createGoal, updateGoal, createTraining } from "@/app/actions";
import { workspaceData, fullName, employeeOptions } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Badge,
  EmployeeName,
  Feedback,
  date,
} from "@/components/ui";
import { Target, Plus } from "lucide-react";
const states = {
  da_iniziare: "Da iniziare",
  in_corso: "In corso",
  completato: "Completato",
  da_rivedere: "Da rivedere",
};
export default async function Goals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "employees",
    "goals",
    "training_records",
  ]);
  const employees = data.employees || [],
    goals = (data.goals || []).filter(
      (g) => !params.employee || g.employee_id === params.employee,
    );
  return (
    <>
      <PageHeader
        eyebrow="PASSO DOPO PASSO"
        title="Obiettivi e formazione"
        description="Percorsi concreti per sviluppare competenze e autonomia."
      />
      <Feedback params={params} />
      <div className="grid-main">
        <div className="stack">
          <Card
            title="Percorsi individuali"
            description="Obiettivi assegnati, progressi e verifiche."
          >
            {goals.length ? (
              <div className="timeline">
                {goals.map((g) => (
                  <article className="timeline-item" key={g.id}>
                    <div className="timeline-top">
                      <EmployeeName
                        id={g.employee_id}
                        name={fullName(
                          employees.find((e) => e.id === g.employee_id),
                        )}
                      />
                      <Badge
                        tone={
                          g.status === "completato"
                            ? "success"
                            : g.status === "da_rivedere"
                              ? "terra"
                              : "neutral"
                        }
                      >
                        {states[g.status as keyof typeof states]}
                      </Badge>
                    </div>
                    <h3 style={{ marginTop: 12 }}>{g.description}</h3>
                    <small>
                      Assegnato il {date(g.assigned_on)} · Verifica{" "}
                      {date(g.due_on)}
                    </small>
                    {g.comments && <p>{g.comments}</p>}
                    {g.outcome && (
                      <p>
                        <strong>Esito: </strong>
                        {g.outcome}
                      </p>
                    )}
                    {profile?.role !== "hr" && (
                      <details style={{ marginTop: 12 }}>
                        <summary className="text-link">
                          Aggiorna avanzamento
                        </summary>
                        <form
                          action={updateGoal}
                          className="stack"
                          style={{ gap: 12, marginTop: 12 }}
                        >
                          <input type="hidden" name="id" value={g.id} />
                          <input
                            type="hidden"
                            name="return_to"
                            value="/obiettivi"
                          />
                          <Field label="Stato">
                            <select name="status" defaultValue={g.status}>
                              {Object.entries(states).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Commenti">
                            <textarea
                              name="comments"
                              defaultValue={g.comments || ""}
                            />
                          </Field>
                          <Field label="Esito finale">
                            <textarea
                              name="outcome"
                              defaultValue={g.outcome || ""}
                            />
                          </Field>
                          <Submit>Salva avanzamento</Submit>
                        </form>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Il prossimo passo, insieme"
                description="Assegna un obiettivo concreto e definisci quando confrontarti sui risultati."
              />
            )}
          </Card>
          <Card title="Formazione registrata">
            {data.training_records?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Collaboratore</th>
                      <th>Percorso</th>
                      <th>Completamento</th>
                      <th>Ore</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.training_records.map((t) => (
                      <tr key={t.id}>
                        <td>
                          {fullName(
                            employees.find((e) => e.id === t.employee_id),
                          )}
                        </td>
                        <td>{t.title}</td>
                        <td>{date(t.completed_on)}</td>
                        <td>{t.hours ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Nessun percorso registrato"
                description="Registra corsi e affiancamenti effettuati dai collaboratori."
              />
            )}
          </Card>
        </div>
        {profile?.role !== "hr" && (
          <div className="stack">
            <Card title="Assegna un obiettivo">
              <form
                action={createGoal}
                className="card-body stack"
                style={{ gap: 15 }}
              >
                <input type="hidden" name="return_to" value="/obiettivi" />
                <Field label="Collaboratore">
                  <select
                    name="employee_id"
                    required
                    defaultValue={params.employee || ""}
                  >
                    <option value="">Seleziona</option>
                    {employeeOptions(employees)}
                  </select>
                </Field>
                <Field label="Obiettivo concreto">
                  <textarea
                    name="description"
                    required
                    minLength={5}
                    placeholder="Es. Gestire in autonomia la procedura di apertura del locale."
                  />
                </Field>
                <Field label="Data di verifica">
                  <input name="due_on" type="date" />
                </Field>
                <Field label="Commenti iniziali">
                  <textarea name="comments" />
                </Field>
                <Submit>
                  <Target size={15} />
                  Assegna obiettivo
                </Submit>
              </form>
            </Card>
            <Card title="Registra formazione">
              <form
                action={createTraining}
                className="card-body stack"
                style={{ gap: 15 }}
              >
                <input type="hidden" name="return_to" value="/obiettivi" />
                <Field label="Collaboratore">
                  <select name="employee_id" required>
                    <option value="">Seleziona</option>
                    {employeeOptions(employees)}
                  </select>
                </Field>
                <Field label="Titolo del percorso">
                  <input name="title" required />
                </Field>
                <div className="form-grid">
                  <Field label="Data completamento">
                    <input type="date" name="completed_on" />
                  </Field>
                  <Field label="Ore">
                    <input type="number" name="hours" min="0" step="0.25" />
                  </Field>
                </div>
                <Field label="Note">
                  <textarea name="notes" />
                </Field>
                <Submit>
                  <Plus size={15} />
                  Registra formazione
                </Submit>
              </form>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
