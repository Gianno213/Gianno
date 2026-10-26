import { latestApprovedEvaluations } from "@/domain/evaluations";
import { italianMonth } from "@/domain/dates";
import { TrendChart } from "@/components/trend-chart";
import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  Target,
  MessageSquare,
  Plus,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
import {
  PageHeader,
  Stat,
  Card,
  Empty,
  Badge,
  EmployeeName,
  Notice,
  date,
  money,
} from "@/components/ui";
import { workspaceData, fullName, latestEvaluations } from "@/components/data";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile, errors } = await workspaceData([
    "employees",
    "locations",
    "evaluations",
    "diary_entries",
    "goals",
    "contracts",
    "payroll",
    "absences",
  ]);
  const allEmployees = data.employees || [],
    allLocations = data.locations || [];
  const jobs = [...new Set(allEmployees.map((e) => String(e.job_title)))];
  const employees = allEmployees.filter(
    (e) =>
      (!params.location || e.location_id === params.location) &&
      (!params.job || e.job_title === params.job) &&
      (!params.employee || e.id === params.employee),
  );
  const ids = new Set(employees.map((e) => e.id));
  const locations = allLocations.filter(
      (l) => !params.location || l.id === params.location,
    ),
    evaluations = latestEvaluations(
      (data.evaluations || []).filter((e) => ids.has(e.employee_id)),
    ),
    notes = (data.diary_entries || []).filter((n) => ids.has(n.employee_id)),
    goals = (data.goals || []).filter((g) => ids.has(g.employee_id));
  const chosen =
    params.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)
      ? new Date(params.period + "-15T12:00:00Z")
      : new Date(italianMonth() + "-15T12:00:00Z");
  const now = chosen,
    period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const approved = latestApprovedEvaluations(
    (data.evaluations || []).filter(
      (e) => ids.has(e.employee_id) && e.status === "convalidata",
    ),
  ).filter(
    (e) =>
      e.status === "convalidata" &&
      !e.not_evaluable &&
      e.period.startsWith(String(now.getFullYear())),
  );
  const avg = approved.length
    ? approved.reduce((s, e) => s + Number(e.weighted_score), 0) /
      approved.length
    : null;
  const completed = new Set(
    evaluations
      .filter((e) => e.period === period && e.status !== "bozza")
      .map((e) => e.employee_id),
  );
  const pending = employees.filter(
    (e) => e.status === "attivo" && !completed.has(e.id),
  );
  const expiring = (data.contracts || []).filter(
    (c) =>
      ids.has(c.employee_id) &&
      c.ends_on &&
      new Date(c.ends_on) >= now &&
      new Date(c.ends_on).getTime() - now.getTime() < 60 * 86400000,
  );
  const annualNet = (data.payroll || [])
    .filter(
      (p) =>
        ids.has(p.employee_id) &&
        p.status === "verificata" &&
        Number(p.year) === now.getFullYear(),
    )
    .reduce((sum, p) => sum + Number(p.net_amount), 0);
  const administrativeHours = (data.absences || [])
    .filter(
      (a) =>
        ids.has(a.employee_id) && a.starts_on.startsWith(period.slice(0, 7)),
    )
    .reduce((sum, a) => sum + Number(a.hours), 0);
  return (
    <>
      <PageHeader
        eyebrow="PANORAMICA AZIENDALE"
        title={`Buongiorno, ${profile?.full_name?.split(" ")[0] || "benvenuto"}.`}
        description="Una visione d’insieme, per prenderti cura delle tue persone."
      >
        <Link href="/diario#nuova" className="button">
          <Plus size={15} />
          Nuova osservazione
        </Link>
      </PageHeader>
      {errors.length > 0 && (
        <Notice tone="danger">
          Impossibile leggere alcuni dati. Verifica la configurazione del
          database e i permessi: {errors.join(" · ")}
        </Notice>
      )}
      <Card className="dashboard-filters">
        <form method="get" className="filters">
          <select
            name="location"
            defaultValue={params.location || ""}
            aria-label="Punto vendita"
          >
            <option value="">Tutti i punti vendita</option>
            {allLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            name="job"
            defaultValue={params.job || ""}
            aria-label="Mansione"
          >
            <option value="">Tutte le mansioni</option>
            {jobs.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
          <select
            name="employee"
            defaultValue={params.employee || ""}
            aria-label="Collaboratore"
          >
            <option value="">Tutti i collaboratori</option>
            {allEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}
              </option>
            ))}
          </select>
          <input
            name="period"
            type="month"
            defaultValue={period.slice(0, 7)}
            aria-label="Periodo"
          />
          <button className="button button-secondary">Applica filtri</button>
        </form>
      </Card>
      <div className="welcome-panel">
        <div>
          <p className="eyebrow">CRESCERE, INSIEME</p>
          <h2>Ogni persona, una storia da valorizzare.</h2>
          <p>
            Osservazioni concrete e confronti costanti. Il tuo spazio per
            accompagnare la crescita del gruppo Gianno.
          </p>
        </div>
        <Leaf size={58} strokeWidth={1} className="welcome-icon" />
      </div>
      <div className="stats">
        <Stat
          label="Collaboratori attivi"
          value={employees.filter((e) => e.status === "attivo").length}
          detail={`${locations.length} punti vendita autorizzati`}
          icon={<Users size={17} />}
        />
        <Stat
          label="Valutazione media"
          value={avg ? `${avg.toFixed(2).replace(".", ",")} / 5` : "—"}
          detail={`${approved.length} valutazioni convalidate`}
          icon={<ClipboardCheck size={17} />}
        />
        <Stat
          label="Valutazioni da completare"
          value={pending.length}
          detail={`Collaboratori attivi · ${now.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`}
          icon={<MessageSquare size={17} />}
        />
        <Stat
          label="Obiettivi aperti"
          value={goals.filter((g) => g.status !== "completato").length}
          detail="Percorsi di crescita in corso"
          icon={<Target size={17} />}
        />
      </div>
      {profile?.role !== "responsabile" && (
        <div className="grid-two">
          <Stat
            label={`Netto registrato · ${now.getFullYear()}`}
            value={money(annualNet)}
            detail="Solo cedolini verificati · mensilità aggiuntive incluse · dati riservati"
          />
          <Stat
            label="Riepilogo amministrativo · ore di assenza"
            value={administrativeHours.toLocaleString("it-IT")}
            detail="Registrazioni iniziate nel mese selezionato · dati separati dalle valutazioni"
          />
        </div>
      )}
      <div className="grid-main">
        <Card
          title="Valutazioni, mese per mese"
          description="Media delle sole valutazioni convalidate, senza classifiche individuali."
        >
          {approved.length ? (
            <>
              <TrendChart
                data={Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(
                    now.getFullYear(),
                    now.getMonth() - 5 + i,
                    1,
                  );
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
                  const vals = approved.filter((v) => v.period === key);
                  return {
                    label: d.toLocaleDateString("it-IT", { month: "short" }),
                    value: vals.length
                      ? vals.reduce((s, v) => s + Number(v.weighted_score), 0) /
                        vals.length
                      : null,
                    count: vals.length,
                  };
                })}
              />
              <p className="chart-caption">
                I mesi privi di valutazioni non concorrono alla media.
              </p>
            </>
          ) : (
            <Empty
              title="Il percorso inizia dal primo confronto"
              description="Le valutazioni convalidate costruiranno nel tempo il quadro della crescita aziendale."
              action={
                <Link href="/valutazioni" className="text-link">
                  Vai alle valutazioni <ArrowUpRight size={13} />
                </Link>
              }
            />
          )}
        </Card>
        <Card
          title="Il mese nei punti vendita"
          description="Schede inviate sul totale dei collaboratori attivi."
        >
          {locations.length ? (
            locations.map((l) => {
              const team = employees.filter(
                (e) => e.location_id === l.id && e.status === "attivo",
              );
              const done = team.filter((e) => completed.has(e.id)).length;
              return (
                <div className="location-row" key={l.id}>
                  <div>
                    <strong>{l.name}</strong>
                    <span className="muted">
                      {done} / {team.length}
                    </span>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${team.length ? (done / team.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <Empty
              title="Aggiungi il primo punto vendita"
              description="Organizza i collaboratori per sede."
              action={
                <Link href="/sedi" className="text-link">
                  Gestisci le sedi <ArrowUpRight size={13} />
                </Link>
              }
            />
          )}
        </Card>
      </div>
      <div className="grid-main">
        <Card
          title="Il diario, di recente"
          description="Fatti, progressi e occasioni di confronto."
        >
          {notes.length ? (
            <div className="timeline">
              {notes
                .sort((a, b) => b.event_on.localeCompare(a.event_on))
                .slice(0, 4)
                .map((n) => (
                  <div className="timeline-item" key={n.id}>
                    <div className="timeline-top">
                      <EmployeeName
                        id={n.employee_id}
                        name={fullName(
                          employees.find((e) => e.id === n.employee_id),
                        )}
                      />
                      <Badge
                        tone={
                          n.verification_status === "verificata"
                            ? "success"
                            : "warning"
                        }
                      >
                        {n.verification_status === "verificata"
                          ? "Verificata"
                          : "Da verificare"}
                      </Badge>
                    </div>
                    <p>{n.description}</p>
                    <small>
                      {date(n.event_on)} ·{" "}
                      {locations.find((l) => l.id === n.location_id)?.name}
                    </small>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="Le piccole osservazioni contano"
              description="Registra un episodio lavorativo per preparare un confronto concreto."
              action={
                <Link href="/diario#nuova" className="text-link">
                  Scrivi la prima osservazione <ArrowUpRight size={13} />
                </Link>
              }
            />
          )}
        </Card>
        <div className="stack">
          <Card
            title="Valutazioni da completare"
            description={`Periodo ${period.slice(0, 7)} · promemoria operativo`}
          >
            {pending.length ? (
              <div className="card-body">
                {pending.slice(0, 8).map((e) => (
                  <div className="location-row" key={e.id}>
                    <EmployeeName id={e.id} name={fullName(e)} />
                    <Link
                      href={`/valutazioni?employee=${e.id}&period=${period.slice(0, 7)}#nuova`}
                      className="text-link"
                    >
                      Compila la scheda →
                    </Link>
                  </div>
                ))}
                {pending.length > 8 && (
                  <Link
                    className="text-link"
                    href={`/valutazioni?period=${period.slice(0, 7)}`}
                  >
                    Altre {pending.length - 8} schede da completare
                  </Link>
                )}
              </div>
            ) : (
              <Empty
                title="Le schede del mese sono state inviate"
                description="Nessuna valutazione in attesa di compilazione tra i collaboratori selezionati."
              />
            )}
          </Card>
          <Card title="Da tenere a mente">
            <div className="card-body">
              <div className="location-row">
                <div>
                  <span>Note da verificare</span>
                  <Badge tone="warning">
                    {
                      notes.filter(
                        (n) => n.verification_status !== "verificata",
                      ).length
                    }
                  </Badge>
                </div>
              </div>
              {profile?.role !== "responsabile" && (
                <div className="location-row">
                  <div>
                    <span>Contratti in scadenza · 60 giorni</span>
                    <Badge tone="terra">{expiring.length}</Badge>
                  </div>
                </div>
              )}
              <div className="location-row">
                <div>
                  <span>Obiettivi da rivedere</span>
                  <Badge>
                    {goals.filter((g) => g.status === "da_rivedere").length}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
          <Card title="Un approccio alle persone">
            <div className="card-body">
              <p className="muted" style={{ lineHeight: 1.9 }}>
                Le valutazioni accompagnano il dialogo. Le assenze legittime
                restano separate dal rendimento e nessun punteggio determina
                automaticamente decisioni sul rapporto di lavoro.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
