import { italianToday } from "@/domain/dates";
import { saveDiary, saveDiaryComment, verifyDiary } from "@/app/actions";
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
  date,
} from "@/components/ui";
import { Plus } from "lucide-react";
const categories: Record<string, string> = {
  positivo: "Episodio positivo",
  criticita: "Criticità lavorativa",
  osservazione: "Osservazione",
  miglioramento: "Miglioramento",
  formazione: "Formazione e affiancamento",
};
export default async function Diary({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "employees",
    "locations",
    "diary_entries",
    "diary_comments",
  ]);
  const employees = data.employees || [];
  const notes = (data.diary_entries || [])
    .filter(
      (n) =>
        (!params.q ||
          n.description.toLowerCase().includes(params.q.toLowerCase()) ||
          fullName(employees.find((e) => e.id === n.employee_id))
            .toLowerCase()
            .includes(params.q.toLowerCase())) &&
        (!params.employee || n.employee_id === params.employee) &&
        (!params.category || n.category === params.category),
    )
    .sort((a, b) => b.event_on.localeCompare(a.event_on));
  const canWrite = profile?.role !== "hr";
  return (
    <>
      <PageHeader
        eyebrow="OSSERVARE PER CRESCERE"
        title="Diario delle persone"
        description="Episodi concreti, progressi e occasioni di confronto. Una nota alla volta."
      >
        {canWrite && (
          <a href="#nuova" className="button">
            <Plus size={15} />
            Nuova osservazione
          </a>
        )}
      </PageHeader>
      <Feedback params={params} />
      <div className="grid-main">
        <Card>
          <SearchForm
            placeholder="Cerca nelle osservazioni…"
            defaultValue={params.q}
          >
            <select name="employee" defaultValue={params.employee || ""}>
              <option value="">Tutti i collaboratori</option>
              {employeeOptions(employees)}
            </select>
            <select name="category" defaultValue={params.category || ""}>
              <option value="">Tutte le categorie</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </SearchForm>
          {notes.length ? (
            <div className="timeline">
              {notes.map((n) => (
                <article className="timeline-item" key={n.id}>
                  <div className="timeline-top">
                    <EmployeeName
                      id={n.employee_id}
                      name={fullName(
                        employees.find((e) => e.id === n.employee_id),
                      )}
                    />
                    <Badge
                      tone={
                        n.category === "positivo"
                          ? "success"
                          : n.category === "criticita"
                            ? "terra"
                            : "neutral"
                      }
                    >
                      {categories[n.category]}
                    </Badge>
                  </div>
                  <p>{n.description}</p>
                  {n.action_taken && (
                    <p>
                      <strong>Azione intrapresa: </strong>
                      {n.action_taken}
                    </p>
                  )}
                  <small>
                    {date(n.event_on)} · Autore{" "}
                    {n.author_id === profile?.id
                      ? profile?.full_name
                      : n.author_id.slice(0, 8)}{" "}
                    · {n.verification_status.replaceAll("_", " ")}
                  </small>
                  {(data.diary_comments || [])
                    .filter((c) => c.entry_id === n.id)
                    .map((c) => (
                      <div
                        className="notice"
                        key={c.id}
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        <p>
                          <strong>{c.kind.replaceAll("_", " ")}</strong>
                          <br />
                          {c.body}
                        </p>
                      </div>
                    ))}
                  <details style={{ marginTop: 12 }}>
                    <summary className="text-link">
                      Commenti, verifica e rettifiche
                    </summary>
                    <form
                      action={saveDiaryComment}
                      className="stack"
                      style={{ gap: 10, marginTop: 12 }}
                    >
                      <input type="hidden" name="entry_id" value={n.id} />
                      <input type="hidden" name="return_to" value="/diario" />
                      <select name="kind">
                        <option value="commento">
                          Commento / richiesta di chiarimento
                        </option>
                        {profile?.role === "direzione" && (
                          <>
                            <option value="rettifica">
                              Rettifica autorizzata
                            </option>
                            <option value="osservazione_dipendente">
                              Osservazione del dipendente
                            </option>
                          </>
                        )}
                      </select>
                      <textarea
                        name="body"
                        required
                        placeholder="Scrivi un commento pertinente ai fatti…"
                      />
                      <Submit>Aggiungi commento</Submit>
                    </form>
                    {profile?.role === "direzione" && (
                      <form
                        action={verifyDiary}
                        className="row-actions"
                        style={{ marginTop: 12 }}
                      >
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="return_to" value="/diario" />
                        <select
                          name="verification_status"
                          defaultValue={n.verification_status}
                        >
                          <option value="da_verificare">Da verificare</option>
                          <option value="verificata">Verificata</option>
                          <option value="chiarimento_richiesto">
                            Chiarimento richiesto
                          </option>
                        </select>
                        <Submit>Aggiorna verifica</Submit>
                      </form>
                    )}
                    {canWrite &&
                      (n.author_id === profile?.id ||
                        profile?.role === "direzione") && (
                        <form
                          action={saveDiary}
                          className="stack"
                          style={{ gap: 10, marginTop: 18 }}
                        >
                          <input type="hidden" name="id" value={n.id} />
                          <input
                            type="hidden"
                            name="employee_id"
                            value={n.employee_id}
                          />
                          <input
                            type="hidden"
                            name="location_id"
                            value={n.location_id}
                          />
                          <input
                            type="hidden"
                            name="event_on"
                            value={n.event_on}
                          />
                          <input
                            type="hidden"
                            name="category"
                            value={n.category}
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value="/diario"
                          />
                          <Field label="Rettifica del testo (storico conservato)">
                            <textarea
                              name="description"
                              defaultValue={n.description}
                              required
                              minLength={5}
                            />
                          </Field>
                          <input
                            name="action_taken"
                            defaultValue={n.action_taken || ""}
                            placeholder="Azione intrapresa"
                          />
                          <Submit>Salva rettifica</Submit>
                        </form>
                      )}
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Dai valore a un episodio"
              description="Registra fatti osservabili e pertinenti al lavoro. Le note non generano punteggi automatici."
            />
          )}
        </Card>
        <div className="stack">
          {canWrite && (
            <Card
              title="Nuova osservazione"
              description="Pochi dettagli, utili per il prossimo confronto."
            >
              <form
                action={saveDiary}
                className="card-body stack"
                style={{ gap: 16 }}
                id="nuova"
              >
                <input type="hidden" name="return_to" value="/diario" />
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
                <Field label="Data dell’episodio">
                  <input
                    name="event_on"
                    type="date"
                    required
                    defaultValue={italianToday()}
                  />
                </Field>
                <Field label="Categoria">
                  <select name="category">
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Che cosa è successo?"
                  hint="Descrivi fatti lavorativi, senza giudizi offensivi o informazioni sanitarie."
                >
                  <textarea
                    name="description"
                    required
                    minLength={5}
                    maxLength={6000}
                    placeholder="Es. Ha gestito con autonomia un reclamo, risolvendo positivamente la situazione."
                  />
                </Field>
                <Field label="Azione intrapresa · facoltativo">
                  <textarea name="action_taken" maxLength={3000} />
                </Field>
                <Submit>Salva osservazione</Submit>
              </form>
            </Card>
          )}
          <Card title="Una nota utile è una nota concreta">
            <div className="card-body">
              <p className="muted" style={{ lineHeight: 1.9 }}>
                Descrivi il contesto, il comportamento osservato e l’eventuale
                azione intrapresa. Il diario offre elementi per il dialogo: non
                attribuisce voti e non automatizza decisioni sulle persone.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
