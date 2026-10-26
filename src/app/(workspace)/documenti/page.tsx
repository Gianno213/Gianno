import { uploadDocument, recoverPayrollDraft } from "@/app/actions";
import { workspaceData, fullName, employeeOptions } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Feedback,
  Notice,
  date,
  SearchForm,
  EmployeeName,
  Badge,
} from "@/components/ui";
import { redirect } from "next/navigation";
import { Download, Upload, LockKeyhole } from "lucide-react";
export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile, errors } = await workspaceData([
    "employees",
    "documents",
    "payroll",
  ]);
  if (profile?.role === "responsabile")
    return (
      <>
        <PageHeader title="Documenti riservati" />
        <Notice>
          Contratti e documenti amministrativi sono accessibili esclusivamente a
          Direzione e HR.
        </Notice>
      </>
    );
  const employees = data.employees || [];
  const docs = (data.documents || []).filter(
    (d) =>
      (!params.employee || d.employee_id === params.employee) &&
      (!params.q || d.filename.toLowerCase().includes(params.q.toLowerCase())),
  );
  return (
    <>
      <PageHeader
        eyebrow="ARCHIVIO PRIVATO"
        title="Documenti e contratti"
        description="Originali protetti, download autorizzati e accessi tracciati."
      />
      <Feedback params={params} />
      {errors.length > 0 && <Notice tone="danger">{errors.join(" · ")}</Notice>}
      <div className="grid-main">
        <Card>
          <SearchForm placeholder="Cerca documento…" defaultValue={params.q}>
            <select name="employee" defaultValue={params.employee || ""}>
              <option value="">Tutti i collaboratori</option>
              {employeeOptions(employees)}
            </select>
          </SearchForm>
          {docs.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Collaboratore</th>
                    <th>Caricato il</th>
                    <th>Accesso</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.filename}</strong>
                        <br />
                        <Badge>{d.kind.replace("_", " ")}</Badge>
                      </td>
                      <td>
                        <EmployeeName
                          id={d.employee_id}
                          name={fullName(
                            employees.find((e) => e.id === d.employee_id),
                          )}
                        />
                      </td>
                      <td>{date(d.created_at)}</td>
                      <td>
                        <a
                          className="text-link"
                          href={`/api/documents/${d.id}`}
                        >
                          <Download size={14} />
                          Scarica PDF
                        </a>
                        {d.kind === "busta_paga" &&
                          !data.payroll?.some(
                            (p) => p.document_id === d.id,
                          ) && (
                            <form
                              action={recoverPayrollDraft}
                              style={{ marginTop: 8 }}
                            >
                              <input
                                name="document_id"
                                value={d.id}
                                type="hidden"
                              />
                              <input
                                name="return_to"
                                value={`/retribuzioni?employee=${d.employee_id}`}
                                type="hidden"
                              />
                              <button className="button button-small">
                                Riprendi verifica
                              </button>
                            </form>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Un archivio ordinato, fin dall’inizio"
              description="Carica contratti e documenti PDF. Ogni originale rimane privato e non può essere sovrascritto."
            />
          )}
        </Card>
        <Card title="Aggiungi un documento">
          <form
            action={uploadDocument}
            className="card-body stack"
            style={{ gap: 16 }}
          >
            <input type="hidden" name="return_to" value="/documenti" />
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
            <Field label="Tipologia">
              <select name="kind">
                <option value="contratto">Contratto</option>
                <option value="altro">Altro documento amministrativo</option>
              </select>
            </Field>
            <Field label="File PDF · massimo 15 MB">
              <input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
            </Field>
            <Submit>
              <Upload size={15} />
              Archivia documento
            </Submit>
            <p className="muted">
              <LockKeyhole
                size={12}
                style={{ display: "inline", marginRight: 6 }}
              />
              I download usano link temporanei autorizzati. Per i cedolini
              utilizza la sezione Retribuzioni.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}
