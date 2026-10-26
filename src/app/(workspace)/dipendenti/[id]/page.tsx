import { latestApprovedEvaluations } from "@/domain/evaluations";
import Link from "next/link";
import { notFound } from "next/navigation";
import { workspaceData, fullName, latestEvaluations } from "@/components/data";
import {
  saveContract,
  savePrivateEmployee,
  updateEmployee,
  uploadEmployeePhoto,
} from "@/app/actions";
import {
  PageHeader,
  Card,
  Empty,
  Avatar,
  Badge,
  Field,
  Submit,
  Feedback,
  date,
  statusLabel,
  Notice,
} from "@/components/ui";
const tabs = [
  ["panoramica", "Panoramica"],
  ["valutazioni", "Valutazioni"],
  ["diario", "Diario"],
  ["obiettivi", "Obiettivi e formazione"],
  ["assenze", "Assenze e presenze"],
  ["retribuzioni", "Retribuzioni"],
  ["documenti", "Documenti e contratti"],
  ["report", "Report annuale"],
];
export default async function Employee({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const ctx = await workspaceData([
    "employees",
    "locations",
    "evaluations",
    "diary_entries",
    "goals",
    "employment_history",
  ]);
  const employee = ctx.data.employees?.find((e) => e.id === id);
  if (!employee) notFound();
  const admin = ctx.profile?.role !== "responsabile";
  const tab = search.tab || "panoramica";
  let privateData: any = { data: {}, errors: [] };
  if (admin && (tab === "panoramica" || tab === "documenti"))
    privateData = await workspaceData(["employee_private", "contracts"]);
  const details = privateData.data.employee_private?.find(
    (p: any) => p.employee_id === id,
  );
  const contracts = (privateData.data.contracts || [])
    .filter((c: any) => c.employee_id === id)
    .sort((a: any, b: any) => b.starts_on.localeCompare(a.starts_on));
  const evaluations = latestEvaluations(
    (ctx.data.evaluations || []).filter((e) => e.employee_id === id),
  );
  const approved = latestApprovedEvaluations(
    (ctx.data.evaluations || []).filter(
      (e) => e.employee_id === id && e.status === "convalidata",
    ),
  ).filter((e) => e.status === "convalidata" && !e.not_evaluable);
  const avg = approved.length
    ? approved.reduce((s, e) => s + Number(e.weighted_score), 0) /
      approved.length
    : null;
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link href="/dipendenti">DIPENDENTI</Link> / FASCICOLO INDIVIDUALE
          </p>
          <div className="profile-heading" style={{ marginBottom: 0 }}>
            {employee.photo_path ? (
              <img
                className="avatar"
                src={`/api/photos/${id}`}
                alt={`Fotografia di ${fullName(employee)}`}
              />
            ) : (
              <Avatar name={fullName(employee)} />
            )}
            <div>
              <h1>{fullName(employee)}</h1>
              <p>
                {employee.job_title} ·{" "}
                {
                  ctx.data.locations?.find((l) => l.id === employee.location_id)
                    ?.name
                }
              </p>
            </div>
            <Badge tone={employee.status === "attivo" ? "success" : "neutral"}>
              {statusLabel(employee.status)}
            </Badge>
          </div>
        </div>
        <Link href={`/diario?employee=${id}#nuova`} className="button">
          Nuova osservazione
        </Link>
      </div>
      <Feedback params={search} />
      {privateData.errors.length > 0 && (
        <Notice tone="danger">{privateData.errors.join(" · ")}</Notice>
      )}
      <nav className="tabbar">
        {tabs
          .filter(
            ([key]) =>
              admin ||
              !["assenze", "retribuzioni", "documenti", "report"].includes(key),
          )
          .map(([key, label]) => (
            <Link
              key={key}
              href={`?tab=${key}`}
              className={tab === key ? "selected" : ""}
            >
              {label}
            </Link>
          ))}
      </nav>
      {tab === "panoramica" && (
        <>
          <div className="grid-main">
            <div className="stack">
              <Card title="Profilo professionale">
                <div className="card-body">
                  <dl className="key-values">
                    <div>
                      <dt>Codice interno</dt>
                      <dd>{employee.employee_code}</dd>
                    </div>
                    <div>
                      <dt>Mansione</dt>
                      <dd>{employee.job_title}</dd>
                    </div>
                    <div>
                      <dt>Assunzione</dt>
                      <dd>{date(employee.hired_on)}</dd>
                    </div>
                    <div>
                      <dt>Punto vendita</dt>
                      <dd>
                        {
                          ctx.data.locations?.find(
                            (l) => l.id === employee.location_id,
                          )?.name
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Valutazione media convalidata</dt>
                      <dd>
                        {avg ? `${avg.toFixed(2)} / 5` : "—"} ·{" "}
                        {approved.length} mesi
                      </dd>
                    </div>
                    <div>
                      <dt>Obiettivi aperti</dt>
                      <dd>
                        {
                          ctx.data.goals?.filter(
                            (g) =>
                              g.employee_id === id && g.status !== "completato",
                          ).length
                        }
                      </dd>
                    </div>
                  </dl>
                </div>
              </Card>
              {admin && (
                <Card title="Aggiorna anagrafica operativa">
                  <form action={updateEmployee} className="card-body">
                    <input name="id" value={id} type="hidden" />
                    <input
                      name="return_to"
                      value={`/dipendenti/${id}`}
                      type="hidden"
                    />
                    <div className="form-grid">
                      <Field label="Nome">
                        <input
                          name="first_name"
                          required
                          defaultValue={employee.first_name}
                        />
                      </Field>
                      <Field label="Cognome">
                        <input
                          name="last_name"
                          required
                          defaultValue={employee.last_name}
                        />
                      </Field>
                      <Field label="Mansione">
                        <input
                          name="job_title"
                          required
                          defaultValue={employee.job_title}
                        />
                      </Field>
                      <Field label="Sede">
                        <select
                          name="location_id"
                          defaultValue={employee.location_id}
                        >
                          {ctx.data.locations?.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Stato">
                        <select name="status" defaultValue={employee.status}>
                          <option value="attivo">Attivo</option>
                          <option value="sospeso">
                            Sospeso amministrativamente
                          </option>
                          <option value="cessato">Cessato</option>
                        </select>
                      </Field>
                    </div>
                    <div className="form-actions">
                      <Submit>Salva modifiche</Submit>
                    </div>
                  </form>
                  <details>
                    <summary className="detail-summary">
                      Aggiorna fotografia
                    </summary>
                    <form
                      action={uploadEmployeePhoto}
                      className="details-form stack"
                      style={{ gap: 15 }}
                    >
                      <input name="employee_id" type="hidden" value={id} />
                      <input
                        name="return_to"
                        type="hidden"
                        value={`/dipendenti/${id}`}
                      />
                      <Field label="Fotografia · JPG, PNG o WebP · massimo 5 MB">
                        <input
                          name="file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                        />
                      </Field>
                      <p className="muted">
                        La foto viene ridimensionata e i metadati vengono
                        rimossi.
                      </p>
                      <Submit>Salva fotografia</Submit>
                    </form>
                  </details>
                </Card>
              )}
              <Card title="Percorso lavorativo">
                {ctx.data.employment_history?.filter(
                  (h) => h.employee_id === id,
                ).length ? (
                  <div className="timeline">
                    {ctx.data.employment_history
                      .filter((h) => h.employee_id === id)
                      .map((h) => (
                        <div className="timeline-item" key={h.id}>
                          <h3>{h.job_title}</h3>
                          <p>
                            {
                              ctx.data.locations?.find(
                                (l) => l.id === h.location_id,
                              )?.name
                            }
                          </p>
                          <small>
                            {date(h.starts_on)} → {date(h.ends_on)}
                          </small>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Empty
                    title="Nessun trasferimento registrato"
                    description="Lo storico conserverà cambi di mansione e sede."
                  />
                )}
              </Card>
            </div>
            <Card title="Osservazioni recenti">
              {ctx.data.diary_entries?.filter((n) => n.employee_id === id)
                .length ? (
                <div className="timeline">
                  {ctx.data.diary_entries
                    .filter((n) => n.employee_id === id)
                    .sort((a, b) => b.event_on.localeCompare(a.event_on))
                    .slice(0, 4)
                    .map((n) => (
                      <div className="timeline-item" key={n.id}>
                        <Badge>{n.category}</Badge>
                        <p style={{ marginTop: 9 }}>{n.description}</p>
                        <small>{date(n.event_on)}</small>
                      </div>
                    ))}
                </div>
              ) : (
                <Empty
                  title="Il diario è ancora da scrivere"
                  description="Registra un episodio lavorativo significativo per accompagnare il prossimo confronto."
                />
              )}
            </Card>
          </div>
          {admin && (
            <div className="grid-two">
              <Card
                title="Contatti riservati"
                description="Accessibili soltanto a Direzione e HR."
              >
                <form action={savePrivateEmployee} className="card-body">
                  <input type="hidden" name="employee_id" value={id} />
                  <input
                    type="hidden"
                    name="return_to"
                    value={`/dipendenti/${id}`}
                  />
                  <div className="form-grid">
                    <Field label="Data di nascita">
                      <input
                        name="birth_date"
                        type="date"
                        defaultValue={details?.birth_date || ""}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        name="email"
                        type="email"
                        defaultValue={details?.email || ""}
                      />
                    </Field>
                    <Field label="Telefono">
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={details?.phone || ""}
                      />
                    </Field>
                  </div>
                  <div className="form-actions">
                    <Submit>Salva contatti</Submit>
                  </div>
                </form>
              </Card>
              <Card title="Contratto attuale">
                <div className="card-body">
                  {contracts[0] ? (
                    <dl className="key-values">
                      <div>
                        <dt>Tipologia</dt>
                        <dd>{contracts[0].contract_type}</dd>
                      </div>
                      <div>
                        <dt>Livello CCNL</dt>
                        <dd>{contracts[0].ccnl_level || "—"}</dd>
                      </div>
                      <div>
                        <dt>Ore settimanali</dt>
                        <dd>{contracts[0].weekly_hours}</dd>
                      </div>
                      <div>
                        <dt>Decorrenza</dt>
                        <dd>{date(contracts[0].starts_on)}</dd>
                      </div>
                      <div>
                        <dt>Scadenza</dt>
                        <dd>{date(contracts[0].ends_on)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted">Nessun contratto registrato.</p>
                  )}
                  <Link
                    href="?tab=documenti"
                    className="text-link"
                    style={{ marginTop: 20 }}
                  >
                    Gestisci contratti e documenti ↗
                  </Link>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
      {tab === "valutazioni" && (
        <Card title="Storico delle valutazioni">
          {evaluations.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Punteggio</th>
                    <th>Stato</th>
                    <th>Revisione</th>
                    <th>Commento</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations
                    .sort((a, b) => b.period.localeCompare(a.period))
                    .map((e) => (
                      <tr key={e.id}>
                        <td>{e.period.slice(0, 7)}</td>
                        <td>
                          {e.not_evaluable
                            ? "Non valutabile"
                            : e.weighted_score}
                        </td>
                        <td>{statusLabel(e.status)}</td>
                        <td>{e.revision}</td>
                        <td style={{ whiteSpace: "normal", maxWidth: 300 }}>
                          {e.comment || e.reason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Nessuna valutazione disponibile" />
          )}
          <div className="card-body">
            <Link href={`/valutazioni?employee=${id}`} className="text-link">
              Apri schede mensili ↗
            </Link>
          </div>
        </Card>
      )}
      {tab === "diario" && (
        <Card title="Diario lavorativo">
          <div className="card-body">
            <Link href={`/diario?employee=${id}`} className="button">
              Apri il diario di {employee.first_name}
            </Link>
          </div>
        </Card>
      )}
      {tab === "obiettivi" && (
        <Card title="Sviluppo professionale">
          <div className="card-body">
            <Link href={`/obiettivi?employee=${id}`} className="button">
              Consulta obiettivi e formazione
            </Link>
          </div>
        </Card>
      )}
      {admin && tab === "assenze" && (
        <Card title="Registro amministrativo riservato">
          <div className="card-body">
            <Link href={`/assenze?employee=${id}`} className="button">
              Consulta assenze e presenze
            </Link>
          </div>
        </Card>
      )}
      {admin && tab === "retribuzioni" && (
        <Card title="Riepilogo retributivo riservato">
          <div className="card-body">
            <Link href={`/retribuzioni?employee=${id}`} className="button">
              Consulta cedolini e statistiche
            </Link>
          </div>
        </Card>
      )}
      {admin && tab === "report" && (
        <Card title="Fascicolo annuale">
          <div className="card-body">
            <Link href={`/report?employee=${id}`} className="button">
              Prepara report annuale
            </Link>
          </div>
        </Card>
      )}
      {admin && tab === "documenti" && (
        <div className="grid-two">
          <Card title="Storico contrattuale">
            <div className="timeline">
              {contracts.map((c: any) => (
                <div className="timeline-item" key={c.id}>
                  <h3>
                    {c.contract_type} · livello {c.ccnl_level || "—"}
                  </h3>
                  <p>{c.weekly_hours} ore settimanali</p>
                  <small>
                    {date(c.starts_on)} →{" "}
                    {c.ends_on ? date(c.ends_on) : "Tempo indeterminato"}
                  </small>
                </div>
              ))}
            </div>
            <div className="card-body">
              <Link
                href={`/documenti?employee=${id}`}
                className="button button-secondary"
              >
                Apri archivio PDF
              </Link>
            </div>
          </Card>
          <Card title="Registra un contratto">
            <form action={saveContract} className="card-body">
              <input type="hidden" name="employee_id" value={id} />
              <input
                type="hidden"
                name="return_to"
                value={`/dipendenti/${id}?tab=documenti`}
              />
              <div className="form-grid">
                <Field label="Tipologia">
                  <input
                    name="contract_type"
                    required
                    placeholder="Tempo indeterminato"
                  />
                </Field>
                <Field label="Livello CCNL">
                  <input name="ccnl_level" />
                </Field>
                <Field label="Ore settimanali">
                  <input
                    name="weekly_hours"
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    required
                  />
                </Field>
                <Field label="Decorrenza">
                  <input name="starts_on" type="date" required />
                </Field>
                <Field label="Scadenza · se prevista">
                  <input name="ends_on" type="date" />
                </Field>
                <Field label="Note">
                  <input name="notes" />
                </Field>
              </div>
              <div className="form-actions">
                <Submit>Registra contratto</Submit>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
