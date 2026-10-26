import Link from "next/link";
import { Plus, Download, Upload } from "lucide-react";
import { createEmployee, importEmployees } from "@/app/actions";
import { workspaceData, fullName } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  SearchForm,
  Badge,
  EmployeeName,
  Field,
  Submit,
  Feedback,
  statusLabel,
} from "@/components/ui";
export default async function Employees({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData(["employees", "locations"]);
  const locations = data.locations || [];
  let employees = (data.employees || []).filter(
    (e) =>
      (!params.q ||
        fullName(e).toLowerCase().includes(params.q.toLowerCase())) &&
      (!params.location || e.location_id === params.location) &&
      (!params.status || e.status === params.status) &&
      (!params.job || e.job_title === params.job),
  );
  employees.sort((a, b) =>
    params.sort === "nome"
      ? a.first_name.localeCompare(b.first_name)
      : a.last_name.localeCompare(b.last_name),
  );
  const page = Math.max(1, Number(params.page) || 1),
    size = 20,
    count = employees.length;
  const jobs = [
    ...new Set((data.employees || []).map((e) => String(e.job_title))),
  ];
  return (
    <>
      <PageHeader
        eyebrow="LE PERSONE DEL GRUPPO"
        title="Dipendenti"
        description="Ogni collaboratore, un fascicolo. Tutte le informazioni che servono, al posto giusto."
      >
        <a
          className="button button-secondary"
          href="/api/export?type=employees"
        >
          <Download size={15} />
          Esporta CSV
        </a>
        {profile?.role !== "responsabile" && (
          <Link href="#nuovo" className="button">
            <Plus size={15} />
            Nuovo dipendente
          </Link>
        )}
      </PageHeader>
      <Feedback params={params} />
      <Card>
        <SearchForm defaultValue={params.q}>
          <select name="location" defaultValue={params.location || ""}>
            <option value="">Tutti i punti vendita</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select name="job" defaultValue={params.job || ""}>
            <option value="">Tutte le mansioni</option>
            {jobs.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
          <select name="status" defaultValue={params.status || ""}>
            <option value="">Tutti gli stati</option>
            <option value="attivo">Attivo</option>
            <option value="cessato">Cessato</option>
            <option value="sospeso">Sospeso</option>
          </select>
          <select name="sort" defaultValue={params.sort || "cognome"}>
            <option value="cognome">Cognome A–Z</option>
            <option value="nome">Nome A–Z</option>
          </select>
        </SearchForm>
        {employees.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Collaboratore</th>
                    <th>Punto vendita</th>
                    <th>Mansione</th>
                    <th>Stato</th>
                    <th>Fascicolo</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice((page - 1) * size, page * size).map((e) => (
                    <tr key={e.id}>
                      <td>
                        <EmployeeName
                          id={e.id}
                          name={fullName(e)}
                          subtitle={e.employee_code}
                        />
                      </td>
                      <td>
                        {locations.find((l) => l.id === e.location_id)?.name}
                      </td>
                      <td>{e.job_title}</td>
                      <td>
                        <Badge
                          tone={e.status === "attivo" ? "success" : "neutral"}
                        >
                          {statusLabel(e.status)}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/dipendenti/${e.id}`}
                        >
                          Apri fascicolo ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {count} collaboratori · pagina {page}
              </span>
              <div className="row-actions">
                {page > 1 && (
                  <Link
                    href={`?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  >
                    ← Precedente
                  </Link>
                )}
                {page * size < count && (
                  <Link
                    href={`?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                  >
                    Successiva →
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="Nessun collaboratore trovato"
            description="Inserisci il primo dipendente oppure modifica i filtri di ricerca."
          />
        )}
      </Card>
      {profile?.role !== "responsabile" && (
        <div className="grid-two" style={{ marginTop: 24 }}>
          <Card
            title="Nuovo collaboratore"
            description="L’anagrafica operativa è separata dai contatti riservati."
          >
            <form action={createEmployee} className="card-body" id="nuovo">
              <input type="hidden" name="return_to" value="/dipendenti" />
              <div className="form-grid">
                <Field label="Nome">
                  <input name="first_name" required maxLength={80} />
                </Field>
                <Field label="Cognome">
                  <input name="last_name" required maxLength={80} />
                </Field>
                <Field label="Codice interno">
                  <input name="employee_code" required maxLength={40} />
                </Field>
                <Field label="Mansione">
                  <input name="job_title" required maxLength={120} />
                </Field>
                <Field label="Punto vendita">
                  <select name="location_id" required>
                    <option value="">Seleziona la sede</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Data di assunzione">
                  <input name="hired_on" type="date" required />
                </Field>
                <Field label="Stato">
                  <select name="status">
                    <option value="attivo">Attivo</option>
                    <option value="sospeso">Sospeso amministrativamente</option>
                    <option value="cessato">Cessato</option>
                  </select>
                </Field>
              </div>
              <div className="form-actions">
                <Submit>Crea fascicolo</Submit>
              </div>
            </form>
          </Card>
          <Card
            title="Importazione iniziale CSV"
            description="Importa più collaboratori con codici interni univoci."
          >
            <form action={importEmployees} className="card-body">
              <input type="hidden" name="return_to" value="/dipendenti" />
              <p
                className="muted"
                style={{ marginBottom: 18, lineHeight: 1.9 }}
              >
                Colonne richieste:{" "}
                <code>
                  employee_code,first_name,last_name,job_title,location_id,hired_on
                </code>
                . Esporta i fogli Excel in CSV UTF-8. Usa gli identificativi
                delle sedi disponibili nella sezione Punti vendita.
              </p>
              <Field label="File CSV">
                <input
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                />
              </Field>
              <div className="form-actions">
                <Submit>
                  <Upload size={15} />
                  Importa collaboratori
                </Submit>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
