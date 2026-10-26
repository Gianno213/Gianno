import { italianMonth } from "@/domain/dates";
import { saveAbsence, createAttendance, importAttendance } from "@/app/actions";
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
  Stat,
} from "@/components/ui";
import { redirect } from "next/navigation";
const types: Record<string, string> = {
  ferie: "Ferie",
  permesso: "Permesso",
  malattia: "Malattia (senza dettagli)",
  assenza_tutelata: "Altra assenza tutelata",
  da_verificare: "Assenza da verificare",
  ritardo: "Ritardo documentato",
  altro: "Altra assenza contrattuale",
};
export default async function Absences({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData([
    "employees",
    "absences",
    "attendance_records",
  ]);
  if (profile?.role === "responsabile") redirect("/dashboard");
  const employees = data.employees || [];
  const period = params.period || italianMonth();
  const year = Number(period.slice(0, 4)),
    month = Number(period.slice(5, 7));
  const rows = (data.absences || []).filter(
    (a) =>
      a.starts_on <= `${period}-31` &&
      a.ends_on >= `${period}-01` &&
      (!params.employee || a.employee_id === params.employee),
  );
  const days = new Date(year, month, 0).getDate(),
    offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  return (
    <>
      <PageHeader
        eyebrow="AMMINISTRAZIONE RISERVATA"
        title="Assenze e presenze"
        description="Dati amministrativi separati dalla valutazione delle persone."
      />
      <Feedback params={params} />
      <Notice>
        Le causali sanitarie o tutelate sono riservate a Direzione e HR. Non
        inserire diagnosi o dettagli medici. Questi dati non modificano i
        punteggi delle valutazioni.
      </Notice>
      <div className="stats">
        {["ferie", "permesso", "malattia", "ritardo"].map((kind) => (
          <Stat
            key={kind}
            label={types[kind]}
            value={`${rows.filter((a) => a.kind === kind).reduce((s, a) => s + Number(a.hours), 0)} h`}
            detail="Totale delle registrazioni nel periodo"
          />
        ))}
      </div>
      <Card title="Calendario amministrativo">
        <SearchForm>
          <input name="period" type="month" defaultValue={period} />
          <select name="employee" defaultValue={params.employee || ""}>
            <option value="">Tutti i collaboratori</option>
            {employeeOptions(employees)}
          </select>
        </SearchForm>
        <div className="card-body" style={{ paddingTop: 20 }}>
          <div className="calendar-grid">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
              <div key={d} className="calendar-label">
                {d}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div className="calendar-day" key={`empty${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = `${period}-${String(i + 1).padStart(2, "0")}`;
              return (
                <div className="calendar-day" key={day}>
                  {i + 1}
                  {rows
                    .filter((a) => a.starts_on <= day && a.ends_on >= day)
                    .map((a) => (
                      <small
                        key={a.id}
                        title={`${fullName(employees.find((e) => e.id === a.employee_id))} · ${types[a.kind]}`}
                      >
                        {fullName(
                          employees.find((e) => e.id === a.employee_id),
                        )}
                      </small>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <div className="grid-two" style={{ marginTop: 24 }}>
        <Card title="Registra un’assenza">
          <form action={saveAbsence} className="card-body">
            <input type="hidden" name="return_to" value="/assenze" />
            <div className="form-grid">
              <Field label="Collaboratore">
                <select name="employee_id" required>
                  <option value="">Seleziona</option>
                  {employeeOptions(employees)}
                </select>
              </Field>
              <Field label="Causale">
                <select name="kind">
                  {Object.entries(types).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dal">
                <input name="starts_on" type="date" required />
              </Field>
              <Field label="Al">
                <input name="ends_on" type="date" required />
              </Field>
              <Field label="Ore complessive nel periodo">
                <input
                  name="hours"
                  type="number"
                  min="0"
                  step="0.25"
                  required
                />
              </Field>
              <Field label="Nota amministrativa (senza dati medici)">
                <input name="notes" maxLength={2000} />
              </Field>
            </div>
            <div className="form-actions">
              <Submit>Registra assenza</Submit>
            </div>
          </form>
        </Card>
        <Card title="Registra una presenza">
          <form action={createAttendance} className="card-body">
            <input type="hidden" name="return_to" value="/assenze" />
            <div className="form-grid">
              <Field label="Collaboratore">
                <select name="employee_id" required>
                  <option value="">Seleziona</option>
                  {employeeOptions(employees)}
                </select>
              </Field>
              <Field label="Data">
                <input name="work_date" type="date" required />
              </Field>
              <Field label="Ore lavorate">
                <input
                  name="hours"
                  type="number"
                  min="0"
                  max="24"
                  step="0.25"
                  required
                />
              </Field>
            </div>
            <div className="form-actions">
              <Submit>Registra presenza</Submit>
            </div>
          </form>
          <details>
            <summary className="detail-summary">
              Importa presenze da CSV
            </summary>
            <form
              action={importAttendance}
              className="details-form stack"
              style={{ gap: 15 }}
            >
              <input type="hidden" name="return_to" value="/assenze" />
              <p className="muted">
                Colonne: <code>employee_id,work_date,hours,source</code>.
                Esporta Excel come CSV UTF-8.
              </p>
              <input name="file" type="file" accept=".csv,text/csv" required />
              <Submit>Importa presenze</Submit>
            </form>
          </details>
        </Card>
      </div>
      <Card title="Storico del periodo">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Collaboratore</th>
                  <th>Causale</th>
                  <th>Dal</th>
                  <th>Al</th>
                  <th>Ore</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => b.starts_on.localeCompare(a.starts_on))
                  .map((a) => (
                    <tr key={a.id}>
                      <td>
                        {fullName(
                          employees.find((e) => e.id === a.employee_id),
                        )}
                      </td>
                      <td>{types[a.kind]}</td>
                      <td>{date(a.starts_on)}</td>
                      <td>{date(a.ends_on)}</td>
                      <td>{a.hours}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nessuna assenza nel periodo"
            description="Le registrazioni amministrative del mese appariranno qui."
          />
        )}
      </Card>
      <div className="grid-two" style={{ marginTop: 24 }}>
        <Card
          title={`Riepilogo annuale · ${year}`}
          description="Ore delle registrazioni con decorrenza nell’anno selezionato."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Causale</th>
                  <th>Registrazioni</th>
                  <th>Ore</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(types).map(([kind, label]) => {
                  const annual = (data.absences || []).filter(
                    (a) =>
                      a.kind === kind &&
                      a.starts_on.startsWith(String(year)) &&
                      (!params.employee || a.employee_id === params.employee),
                  );
                  return (
                    <tr key={kind}>
                      <td>{label}</td>
                      <td>{annual.length}</td>
                      <td>
                        {annual.reduce((sum, a) => sum + Number(a.hours), 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <a
              className="text-link"
              href={`/api/export?type=absences${params.employee ? `&employee_id=${params.employee}` : ""}`}
            >
              Esporta registro assenze CSV ↗
            </a>
          </div>
        </Card>
        <Card
          title="Presenze del periodo"
          description="Dati registrati o importati, senza indicatori di rendimento."
        >
          {(data.attendance_records || []).filter(
            (a) =>
              a.work_date.startsWith(period) &&
              (!params.employee || a.employee_id === params.employee),
          ).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Collaboratore</th>
                    <th>Data</th>
                    <th>Ore</th>
                    <th>Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.attendance_records || [])
                    .filter(
                      (a) =>
                        a.work_date.startsWith(period) &&
                        (!params.employee || a.employee_id === params.employee),
                    )
                    .sort((a, b) => b.work_date.localeCompare(a.work_date))
                    .map((a) => (
                      <tr key={a.id}>
                        <td>
                          {fullName(
                            employees.find((e) => e.id === a.employee_id),
                          )}
                        </td>
                        <td>{date(a.work_date)}</td>
                        <td>{a.hours}</td>
                        <td>{a.source}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nessuna presenza registrata"
              description="Le presenze manuali e importate del mese appariranno qui."
            />
          )}
          <div className="card-body">
            <a
              className="text-link"
              href={`/api/export?type=attendance_records${params.employee ? `&employee_id=${params.employee}` : ""}`}
            >
              Esporta presenze CSV ↗
            </a>
          </div>
        </Card>
      </div>
    </>
  );
}
