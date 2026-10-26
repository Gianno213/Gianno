import { italianYear } from "@/domain/dates";
import { TrendChart } from "@/components/trend-chart";
import { uploadPayroll, confirmPayroll } from "@/app/actions";
import { workspaceData, fullName, employeeOptions } from "@/components/data";
import { salaryStatistics } from "@/domain/payroll";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Feedback,
  Notice,
  money,
  Stat,
  SearchForm,
  Badge,
} from "@/components/ui";
import { redirect } from "next/navigation";
import { Download, Upload, LockKeyhole } from "lucide-react";
export default async function Payroll({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile, errors } = await workspaceData([
    "employees",
    "payroll",
  ]);
  if (profile?.role === "responsabile") redirect("/dashboard");
  const employees = data.employees || [];
  const selected =
    employees.find((e) => e.id === params.employee) || employees[0];
  const rows = (data.payroll || []).filter(
    (p) => p.employee_id === selected?.id,
  );
  const year = Number(params.year) || italianYear();
  const stats = salaryStatistics(rows as any, year);
  return (
    <>
      <PageHeader
        eyebrow="AREA RISERVATA · DIREZIONE E HR"
        title="Retribuzioni"
        description="Netti verificati, documenti originali e lettura trasparente dei dati."
      >
        <a
          className="button button-secondary"
          href={`/api/export?type=payroll${selected ? `&employee_id=${selected.id}` : ""}`}
        >
          <Download size={15} />
          Esporta CSV
        </a>
      </PageHeader>
      <Feedback params={params} />
      {errors.length > 0 && <Notice tone="danger">{errors.join(" · ")}</Notice>}
      <Card>
        <SearchForm placeholder="Cerca…">
          <select name="employee" defaultValue={selected?.id || ""}>
            <option value="">Seleziona collaboratore</option>
            {employeeOptions(employees)}
          </select>
          <input
            type="number"
            name="year"
            defaultValue={year}
            min="2000"
            max="2200"
          />
        </SearchForm>
        <div className="card-body" style={{ paddingTop: 20 }}>
          <p className="eyebrow">
            {selected ? fullName(selected) : "NESSUN COLLABORATORE"}
          </p>
          <div className="stats" style={{ marginBottom: 0 }}>
            <Stat
              label="Ultimo netto disponibile"
              value={money(stats.latest)}
              detail="Mensilità ordinaria verificata"
            />
            <Stat
              label="Media ultimi 3 mesi disponibili"
              value={money(stats.last3.average)}
              detail={`${stats.last3.count} mesi effettivi · aggiuntive escluse`}
            />
            <Stat
              label="Media ultimi 6 mesi disponibili"
              value={money(stats.last6.average)}
              detail={`${stats.last6.count} mesi effettivi · aggiuntive escluse`}
            />
            <Stat
              label="Media ultimi 12 mesi disponibili"
              value={money(stats.last12.average)}
              detail={`${stats.last12.count} mesi effettivi · aggiuntive escluse`}
            />
          </div>
          <p className="muted" style={{ marginTop: 17 }}>
            Totale netto registrato {year}:{" "}
            <strong>{money(stats.annualTotal)}</strong> · di cui mensilità
            aggiuntive: <strong>{money(stats.annualAdditional)}</strong>.
          </p>
          {stats.last12.unseparatedCount > 0 && (
            <Notice>
              {stats.last12.unseparatedCount} mensilità non consentono una
              separazione affidabile degli straordinari. Le medie includono gli
              importi non separati: verifica il dettaglio dei cedolini.
            </Notice>
          )}
        </div>
      </Card>
      <div className="grid-main" style={{ marginTop: 24 }}>
        <Card
          title="Andamento del netto"
          description={`Mensilità ordinarie verificate · ${year}`}
        >
          {stats.monthly.length ? (
            <>
              <TrendChart
                currency
                data={Array.from({ length: 12 }, (_, i) => ({
                  label: new Date(year, i, 1).toLocaleDateString("it-IT", {
                    month: "short",
                  }),
                  value:
                    stats.monthly.find((m) => m.month === i + 1)?.net ?? null,
                }))}
              />
              <p className="chart-caption">
                I mesi mancanti non sono zeri e non concorrono alle medie.
              </p>
            </>
          ) : (
            <Empty
              title="In attesa del primo netto verificato"
              description="Carica un cedolino, controlla i dati estratti e conferma per aggiornare le statistiche."
            />
          )}
        </Card>
        <Card
          title="Carica una busta paga"
          description="Estrazione locale del testo. Nessun invio a fornitori AI."
        >
          <form
            action={uploadPayroll}
            className="card-body stack"
            style={{ gap: 16 }}
          >
            <input
              type="hidden"
              name="return_to"
              value={
                selected
                  ? `/retribuzioni?employee=${selected.id}`
                  : "/retribuzioni"
              }
            />
            <Field label="Collaboratore">
              <input
                type="hidden"
                name="employee_id"
                value={selected?.id || ""}
              />
              <input
                readOnly
                value={
                  selected
                    ? fullName(selected)
                    : "Seleziona un collaboratore nei filtri"
                }
              />
            </Field>
            <Field label="Cedolino PDF · massimo 15 MB">
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
            </Field>
            <p className="muted">
              Il PDF resta privato. Se il documento è una scansione, inserisci
              manualmente i dati dopo averlo letto: l’OCR locale è un’estensione
              facoltativa.
            </p>
            <Submit>
              <Upload size={15} />
              Carica ed estrai dati
            </Submit>
          </form>
        </Card>
      </div>
      <Card
        title="Verifica e storico cedolini"
        description="La registrazione del netto richiede sempre conferma umana."
      >
        {rows.length ? (
          <div className="timeline">
            {rows
              .sort(
                (a, b) =>
                  (b.year || 0) - (a.year || 0) ||
                  (b.month || 0) - (a.month || 0),
              )
              .map((p) => (
                <article key={p.id} className="timeline-item">
                  <div className="timeline-top">
                    <h3>
                      {p.month
                        ? String(p.month).padStart(2, "0")
                        : "Mese da verificare"}{" "}
                      / {p.year || "Anno da verificare"} · {p.kind}
                    </h3>
                    <div className="row-actions">
                      <strong>{money(p.net_amount)}</strong>
                      <Badge
                        tone={p.status === "verificata" ? "success" : "warning"}
                      >
                        {p.status === "verificata"
                          ? "Verificata"
                          : "Da confermare"}
                      </Badge>
                      <a
                        className="text-link"
                        href={`/api/documents/${p.document_id}`}
                      >
                        PDF originale ↗
                      </a>
                    </div>
                  </div>
                  {(p.extraction?.employeeCode ||
                    p.extraction?.employeeName) && (
                    <p className="muted" style={{ margin: "10px 0" }}>
                      Identità riconosciuta nel PDF:{" "}
                      {p.extraction.employeeName || "nome non riconosciuto"} ·
                      matricola{" "}
                      {p.extraction.employeeCode || "non riconosciuta"}.
                      Confronta con{" "}
                      {selected
                        ? fullName(selected)
                        : "il collaboratore selezionato"}
                      .
                    </p>
                  )}
                  {p.extraction?.warnings?.length > 0 && (
                    <Notice>{p.extraction.warnings.join(" ")}</Notice>
                  )}
                  <details open={p.status === "bozza"}>
                    <summary className="text-link">
                      {p.status === "bozza"
                        ? "Controlla e conferma i dati"
                        : "Rettifica con storico"}
                    </summary>
                    <form action={confirmPayroll} style={{ marginTop: 18 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        type="hidden"
                        name="return_to"
                        value={
                          selected
                            ? `/retribuzioni?employee=${selected.id}`
                            : "/retribuzioni"
                        }
                      />
                      <div className="form-grid">
                        <Field label="Anno di competenza">
                          <input
                            name="year"
                            type="number"
                            min="2000"
                            max="2200"
                            defaultValue={p.year ?? ""}
                            required
                          />
                        </Field>
                        <Field label="Mese di competenza">
                          <input
                            name="month"
                            type="number"
                            min="1"
                            max="12"
                            defaultValue={p.month ?? ""}
                            required
                          />
                        </Field>
                        <Field label="Mensilità">
                          <select name="kind" defaultValue={p.kind}>
                            <option value="ordinaria">Ordinaria</option>
                            <option value="tredicesima">Tredicesima</option>
                            <option value="quattordicesima">
                              Quattordicesima
                            </option>
                          </select>
                        </Field>
                        <Field label="NETTO A PAGARE · euro">
                          <input
                            name="net_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={p.net_amount ?? ""}
                            required
                          />
                        </Field>
                        <Field label="Straordinari netti separati · se attendibili">
                          <input
                            name="extraordinary_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={p.extraordinary_amount ?? ""}
                          />
                        </Field>
                        <Field label="Motivazione rettifica">
                          <input
                            name="correction_reason"
                            required={p.status === "verificata"}
                            minLength={
                              p.status === "verificata" ? 5 : undefined
                            }
                          />
                        </Field>
                      </div>
                      <label
                        className="inline-checkbox"
                        style={{ marginTop: 15 }}
                      >
                        <input
                          type="checkbox"
                          name="ordinary_confirmed"
                          defaultChecked={p.ordinary_confirmed}
                        />
                        Confermo che il netto ordinario non include straordinari
                        da separare
                      </label>
                      <label
                        className="inline-checkbox"
                        style={{ marginTop: 12 }}
                      >
                        <input type="checkbox" name="confirmed" required />
                        Ho verificato dipendente, periodo, mensilità e netto
                        confrontandoli con il PDF originale
                      </label>
                      <div className="form-actions">
                        <Submit>
                          {p.status === "verificata"
                            ? "Registra rettifica"
                            : "Conferma e registra netto"}
                        </Submit>
                      </div>
                    </form>
                  </details>
                </article>
              ))}
          </div>
        ) : (
          <Empty
            title="Nessun cedolino disponibile"
            description="I mesi senza busta paga resteranno distinti dai mesi con netto verificato."
          />
        )}
      </Card>
    </>
  );
}
