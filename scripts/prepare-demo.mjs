/** Manual demo setup only. DB credentials are confined to the GitHub job, never the web app. */
import pg from "pg";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
const companyName = "GIANNO PEOPLE — DEMO";
export function validateDemoConfiguration(env) {
  if (env.GIANNO_DEMO_CONFIRM !== "DEMO")
    throw new Error("Conferma DEMO richiesta.");
  let uri = env.DEMO_DATABASE_URL || "";
  if (uri.includes("[YOUR-PASSWORD]")) {
    if (!env.DEMO_DATABASE_PASSWORD)
      throw new Error("Password database richiesta.");
    uri = uri.replace(
      "[YOUR-PASSWORD]",
      encodeURIComponent(env.DEMO_DATABASE_PASSWORD),
    );
  }
  const connection = new URL(uri);
  if (!["postgres:", "postgresql:"].includes(connection.protocol))
    throw new Error("Connessione PostgreSQL richiesta.");
  const local =
    ["localhost", "127.0.0.1"].includes(connection.hostname) &&
    env.GIANNO_LOCAL_DEMO_TEST === "1";
  if (
    !local &&
    (!connection.hostname.endsWith(".pooler.supabase.com") ||
      connection.port !== "5432")
  )
    throw new Error("Usare il Session pooler Supabase sulla porta 5432.");
  const users = [
    ["direzione", env.DEMO_DIRECTION_ID],
    ["hr", env.DEMO_HR_ID],
    ["responsabile", env.DEMO_MANAGER_ID],
  ].filter(([, id]) => id);
  if (!users.some(([role]) => role === "direzione"))
    throw new Error("UUID Direzione richiesto.");
  if (
    users.some(
      ([, id]) =>
        !String(id).match(
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
        ),
    )
  )
    throw new Error("UUID utente non valido.");
  if (new Set(users.map(([, id]) => id)).size !== users.length)
    throw new Error("Usare account distinti per i ruoli.");
  // Force TLS verification; never honor weaker sslmode options supplied in a URI.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"])
    connection.searchParams.delete(key);
  return {
    connectionString: connection.toString(),
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(env.DEMO_DATABASE_CA ? { ca: env.DEMO_DATABASE_CA } : {}),
        },
    users,
  };
}
export async function prepareDemo(env = process.env) {
  const { users, ...configuration } = validateDemoConfiguration(env);
  const client = new pg.Client(configuration);
  await client.connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtext('gianno-demo-setup'))",
    );
    for (const [, userId] of users) {
      const user = await client.query("select id from auth.users where id=$1", [
        userId,
      ]);
      if (!user.rowCount)
        throw new Error("Creare prima gli account in Supabase Authentication.");
    }
    const existing = await client.query(
      "select to_regclass('public.companies') as name",
    );
    if (existing.rows[0].name) {
      const companies = await client.query("select name from public.companies");
      if (
        companies.rows.some((c) => c.name !== companyName) ||
        companies.rowCount > 1
      )
        throw new Error("Database non dimostrativo: operazione interrotta.");
    } else {
      const other = await client.query(
        "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name<>'spatial_ref_sys'",
      );
      if (other.rowCount)
        throw new Error(
          "Il progetto contiene altre tabelle: usare un nuovo progetto demo vuoto.",
        );
    }
    await client.query(
      "create schema if not exists gianno_demo_setup; revoke all on schema gianno_demo_setup from public,anon,authenticated",
    );
    await client.query(
      "create table if not exists gianno_demo_setup.migrations(name text primary key,sha256 text not null); revoke all on gianno_demo_setup.migrations from public,anon,authenticated",
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      const sql = await readFile("supabase/migrations/" + file, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query(
        "select sha256 from gianno_demo_setup.migrations where name=$1",
        [file],
      );
      if (applied.rowCount) {
        if (applied.rows[0].sha256 !== hash)
          throw new Error(
            "Una migrazione applicata risulta modificata: revisione necessaria.",
          );
        continue;
      }
      await client.query(sql);
      await client.query(
        "insert into gianno_demo_setup.migrations(name,sha256) values($1,$2)",
        [file, hash],
      );
    }
    let companies = await client.query(
      "select id from public.companies where name=$1",
      [companyName],
    );
    if (!companies.rowCount)
      companies = await client.query(
        "insert into public.companies(name) values($1) returning id",
        [companyName],
      );
    const companyId = companies.rows[0].id;
    for (const [role, id] of users) {
      const old = await client.query(
        "select company_id,role from public.profiles where id=$1",
        [id],
      );
      if (
        old.rowCount &&
        (old.rows[0].company_id !== companyId || old.rows[0].role !== role)
      )
        throw new Error(
          "Account già associato a un altro contesto: nessuna autorizzazione sovrascritta.",
        );
      await client.query(
        "insert into public.profiles(id,company_id,full_name,role,evaluations_access) values($1,$2,$3,$4,$5) on conflict(id) do nothing",
        [
          id,
          companyId,
          role === "direzione"
            ? "Direzione Demo"
            : role === "hr"
              ? "Amministrazione Demo"
              : "Responsabile Demo",
          role,
          role !== "responsabile",
        ],
      );
    }
    const locations = [];
    for (const name of ["DEMO — Centro", "DEMO — Porto"]) {
      await client.query(
        "insert into public.locations(company_id,name,address) values($1,$2,$3) on conflict(company_id,name) do nothing",
        [companyId, name, "Indirizzo dimostrativo"],
      );
      locations.push(
        (
          await client.query(
            "select id from public.locations where company_id=$1 and name=$2",
            [companyId, name],
          )
        ).rows[0].id,
      );
    }
    const manager = users.find(([role]) => role === "responsabile");
    if (manager)
      await client.query(
        "insert into public.user_locations(user_id,location_id) values($1,$2) on conflict do nothing",
        [manager[1], locations[0]],
      );
    const criteria = [
      {
        key: "servizio",
        label: "Qualità del servizio e attenzione al cliente",
        weight: 25,
      },
      {
        key: "procedure",
        label: "Rispetto delle procedure e standard aziendali",
        weight: 25,
      },
      {
        key: "squadra",
        label: "Collaborazione e lavoro di squadra",
        weight: 20,
      },
      {
        key: "puntualita",
        label: "Puntualità negli impegni lavorativi documentati",
        weight: 15,
      },
      { key: "autonomia", label: "Autonomia e iniziativa", weight: 15 },
    ];
    await client.query(
      "insert into public.evaluation_templates(company_id,name,version,criteria) values($1,$2,1,$3) on conflict(company_id,name,version) do nothing",
      [companyId, "Modello dimostrativo Gianno", JSON.stringify(criteria)],
    );
    const staff = [
      ["DEMO-001", "Elena", "Esempio", "Barista", locations[0]],
      ["DEMO-002", "Marco", "Dimostrativo", "Addetto sala", locations[0]],
      ["DEMO-003", "Giulia", "Test", "Cuoca", locations[1]],
    ];
    for (const [code, first, last, job, location] of staff)
      await client.query(
        "insert into public.employees(company_id,location_id,employee_code,first_name,last_name,job_title,hired_on) values($1,$2,$3,$4,$5,$6,'2024-01-15') on conflict(company_id,employee_code) do nothing",
        [companyId, location, code, first, last, job],
      );
    // Preserve all subsequent trial edits: repeated setup only adds missing foundation records.
    await client.query("notify pgrst, 'reload schema'");
    await client.query("commit");
    console.log(
      "Ambiente DEMO preparato: schema, account abilitati, due sedi, tre collaboratori fittizi e modello di valutazione. Nessuna password impostata o stampata.",
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
if (process.argv[1]?.endsWith("/prepare-demo.mjs"))
  prepareDemo().catch((error) => {
    console.error(
      "Preparazione DEMO interrotta. " +
        (error.code ? "Codice: " + error.code + ". " : "") +
        "Verificare progetto vuoto, UUID, connessione Session pooler e certificato TLS. Nessun valore riservato viene mostrato.",
    );
    process.exitCode = 1;
  });
