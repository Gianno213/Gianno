import { TemplateForm } from "@/components/template-form";
import {
  saveProfile,
  assignLocation,
  createTemplate,
  saveCompany,
  saveDataRequest,
} from "@/app/actions";
import { workspaceData, fullName, employeeOptions } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Feedback,
  Notice,
  Badge,
  date,
} from "@/components/ui";
import { redirect } from "next/navigation";
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "companies",
    "profiles",
    "locations",
    "user_locations",
    "evaluation_templates",
    "audit_log",
    "employees",
    "data_requests",
  ]);
  if (profile?.role === "responsabile") redirect("/dashboard");
  const direction = profile?.role === "direzione",
    company = data.companies?.[0];
  return (
    <>
      <PageHeader
        eyebrow="REGOLE CHIARE, DATI PROTETTI"
        title="Impostazioni"
        description="Autorizzazioni, modelli di valutazione e tutela delle informazioni."
      />
      <Feedback params={params} />
      <Notice>
        Gli account vengono creati in Supabase Auth con invito aziendale.
        Abilitali qui con il relativo UUID. La chiave service-role non è mai
        necessaria nel browser o nell’app.
      </Notice>
      {direction && (
        <>
          <div className="grid-two">
            <Card title="Utenti e ruoli">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Utente</th>
                      <th>Ruolo</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.profiles?.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.full_name}
                          <br />
                          <small className="muted">{p.id}</small>
                        </td>
                        <td>{p.role}</td>
                        <td>
                          <Badge tone={p.active ? "success" : "neutral"}>
                            {p.active ? "Attivo" : "Disabilitato"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary className="detail-summary">
                  Abilita o modifica un utente
                </summary>
                <form
                  action={saveProfile}
                  className="details-form stack"
                  style={{ gap: 15 }}
                >
                  <input name="return_to" type="hidden" value="/impostazioni" />
                  <Field label="UUID dell’utente Supabase Auth">
                    <input
                      name="id"
                      required
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </Field>
                  <Field label="Nome visualizzato">
                    <input name="full_name" required />
                  </Field>
                  <Field label="Ruolo">
                    <select name="role">
                      <option value="responsabile">
                        Responsabile di punto vendita
                      </option>
                      <option value="hr">HR / Amministrazione</option>
                      <option value="direzione">Direzione</option>
                    </select>
                  </Field>
                  <label className="inline-checkbox">
                    <input name="active" type="checkbox" defaultChecked />
                    Account abilitato
                  </label>
                  <label className="inline-checkbox">
                    <input name="evaluations_access" type="checkbox" />
                    HR autorizzato alla consultazione delle valutazioni
                  </label>
                  <Submit>Salva autorizzazione</Submit>
                </form>
              </details>
            </Card>
            <Card title="Autorizzazioni alle sedi">
              <div className="card-body">
                <p className="muted" style={{ marginBottom: 20 }}>
                  Un responsabile può gestire più sedi. La revoca si applica
                  immediatamente alle nuove richieste.
                </p>
                <form
                  action={assignLocation}
                  className="stack"
                  style={{ gap: 15 }}
                >
                  <input name="return_to" type="hidden" value="/impostazioni" />
                  <Field label="Utente">
                    <select name="user_id" required>
                      <option value="">Seleziona utente</option>
                      {data.profiles?.map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.full_name} · {p.role}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sede">
                    <select name="location_id" required>
                      <option value="">Seleziona sede</option>
                      {data.locations?.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="inline-checkbox">
                    <input name="remove" type="checkbox" />
                    Revoca questa assegnazione
                  </label>
                  <Submit>Aggiorna assegnazione</Submit>
                </form>
                <div className="divider" />
                {data.user_locations?.map((a, i) => (
                  <p className="muted" style={{ marginTop: 9 }} key={i}>
                    {data.profiles?.find((p) => p.id === a.user_id)?.full_name}{" "}
                    →{" "}
                    {data.locations?.find((l) => l.id === a.location_id)?.name}
                  </p>
                ))}
              </div>
            </Card>
          </div>
          <div className="grid-two">
            <Card
              title="Modelli di valutazione"
              description="Ogni modifica crea una nuova versione: lo storico resta invariato."
            >
              <div className="card-body">
                {data.evaluation_templates?.map((t) => (
                  <div className="location-row" key={t.id}>
                    <div>
                      <strong>
                        {t.name} · v{t.version}
                      </strong>
                      <Badge>{t.job_title || "Tutte le mansioni"}</Badge>
                    </div>
                    {t.criteria.map((c: any) => (
                      <p className="muted" key={c.key}>
                        {c.label} · {c.weight}%
                      </p>
                    ))}
                  </div>
                ))}
                <details>
                  <summary className="detail-summary">
                    Crea una nuova versione del modello
                  </summary>
                  <TemplateForm
                    nextVersion={
                      Math.max(
                        0,
                        ...(data.evaluation_templates || []).map((t) =>
                          Number(t.version),
                        ),
                      ) + 1
                    }
                  />
                </details>
              </div>
            </Card>
            <Card title="Conservazione dei dati">
              <form
                action={saveCompany}
                className="card-body stack"
                style={{ gap: 18 }}
              >
                <input name="return_to" type="hidden" value="/impostazioni" />
                <Field label="Ragione sociale">
                  <input
                    name="name"
                    defaultValue={company?.name || ""}
                    required
                  />
                </Field>
                <Field
                  label="Periodo di conservazione · mesi"
                  hint="La scadenza è una regola di revisione. La cancellazione richiede la procedura controllata descritta nella documentazione."
                >
                  <input
                    name="retention_months"
                    type="number"
                    min="12"
                    max="120"
                    defaultValue={company?.retention_months || 60}
                    required
                  />
                </Field>
                <Submit>Salva politica</Submit>
              </form>
              <div className="card-body">
                <ul className="privacy-list">
                  <li>
                    <strong>Autenticazione a due fattori</strong>
                    <p>
                      Obbligatoria per Direzione e HR, verificata anche sulle
                      risorse sensibili.
                    </p>
                  </li>
                  <li>
                    <strong>Documenti privati</strong>
                    <p>
                      Originali immutabili e download temporanei autorizzati.
                    </p>
                  </li>
                  <li>
                    <strong>Uscita di un utente</strong>
                    <p>
                      Disabilita il profilo, revoca le sedi e revoca le sessioni
                      in Supabase Auth.
                    </p>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </>
      )}
      <div className="grid-two">
        <Card title="Richieste sui dati personali">
          <form
            action={saveDataRequest}
            className="card-body stack"
            style={{ gap: 15 }}
          >
            <input name="return_to" type="hidden" value="/impostazioni" />
            <Field label="Collaboratore">
              <select name="employee_id" required>
                <option value="">Seleziona</option>
                {employeeOptions(data.employees || [])}
              </select>
            </Field>
            <Field label="Richiesta">
              <select name="kind">
                <option value="accesso">Accesso ai dati</option>
                <option value="rettifica">Rettifica</option>
                <option value="cancellazione">Cancellazione</option>
              </select>
            </Field>
            <Field label="Descrizione pertinente">
              <textarea name="description" required minLength={5} />
            </Field>
            <Submit>Registra richiesta</Submit>
          </form>
          {data.data_requests?.map((r) => (
            <div className="location-row" key={r.id}>
              <div>
                <span>
                  {fullName(
                    data.employees?.find((e) => e.id === r.employee_id),
                  )}{" "}
                  · {r.kind}
                </span>
                <Badge>{r.status}</Badge>
              </div>
              <p className="muted">{r.description}</p>
            </div>
          ))}
        </Card>
        <Card
          title="Registro di audit"
          description="Ultimi eventi: autore, risorsa e azione. I contenuti riservati sono separati."
        >
          {direction ? (
            data.audit_log?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Risorsa</th>
                      <th>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(data.audit_log || [])]
                      .sort((a, b) =>
                        b.occurred_at.localeCompare(a.occurred_at),
                      )
                      .slice(0, 30)
                      .map((a) => (
                        <tr key={a.id}>
                          <td>{date(a.occurred_at)}</td>
                          <td>
                            {a.table_name}
                            <br />
                            <small className="muted">
                              {a.actor_id?.slice(0, 8) || "Sistema"}
                            </small>
                          </td>
                          <td>{a.action}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Nessun evento disponibile" />
            )
          ) : (
            <Empty
              title="Registro riservato alla Direzione"
              description="Le tue operazioni amministrative vengono comunque tracciate."
            />
          )}
        </Card>
      </div>
    </>
  );
}
