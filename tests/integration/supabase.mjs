/** Real local Supabase integration. Refuses remote endpoints; no credential values logged. */
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes, createHmac, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
const config = JSON.parse(
  await readFile(
    process.env.GIANNO_LOCAL_STATUS || "/tmp/gianno-supabase-status.json",
    "utf8",
  ),
);
const url = config.API_URL;
const parsed = new URL(url);
assert(
  ["127.0.0.1", "localhost"].includes(parsed.hostname),
  "Only isolated local Supabase is permitted",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, config.SERVICE_ROLE_KEY, options);
const anonymous = createClient(url, config.ANON_KEY, options);
const makeClient = () => createClient(url, config.ANON_KEY, options);
let checks = 0;
function passed(label) {
  checks++;
  console.log("PASS: " + label);
}
function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message}`);
  return result.data;
}
function otp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const off = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(off) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
const companyId = randomUUID();
ok(
  await admin.from("companies").insert({
    id: companyId,
    name: "Gianno collaudo fittizio " + companyId.slice(0, 5),
  }),
  "company",
);
const credentials = [];
for (const role of ["direzione", "hr", "responsabile"]) {
  const email = `${role}.${companyId.slice(0, 8)}@example.test`;
  const password = randomBytes(24).toString("base64url") + "aA1!";
  const { user } = ok(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    "create user",
  );
  ok(
    await admin.from("profiles").insert({
      id: user.id,
      company_id: companyId,
      full_name:
        role === "direzione"
          ? "Alice Direzione"
          : role === "hr"
            ? "Luca Amministrazione"
            : "Marco Responsabile",
      role,
      evaluations_access: role !== "responsabile",
    }),
    "profile",
  );
  const client = makeClient();
  ok(
    await client.auth.signInWithPassword({ email, password }),
    "password sign-in",
  );
  passed(role + " Auth password login");
  const account = { role, email, password, userId: user.id, client };
  if (role !== "responsabile") {
    const before = ok(
      await client.from("locations").select("id"),
      "pre MFA locations",
    );
    assert.equal(before.length, 0);
    passed(role + " without MFA cannot read administrative scope");
    const enrollment = ok(
      await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Collaudo locale " + Date.now(),
      }),
      "MFA enroll",
    );
    const challenge = ok(
      await client.auth.mfa.challenge({ factorId: enrollment.id }),
      "MFA challenge",
    );
    ok(
      await client.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.id,
        code: otp(enrollment.totp.secret),
      }),
      "MFA verify",
    );
    const level = ok(
      await client.auth.mfa.getAuthenticatorAssuranceLevel(),
      "MFA assurance",
    );
    assert.equal(level.currentLevel, "aal2");
    passed(role + " real TOTP verified aal2");
    account.totpSecret = enrollment.totp.secret;
  }
  credentials.push(account);
}
const direction = credentials.find((x) => x.role === "direzione").client;
const manager = credentials.find((x) => x.role === "responsabile").client;
const hr = credentials.find((x) => x.role === "hr").client;
const locations = ok(
  await direction
    .from("locations")
    .insert([
      { company_id: companyId, name: "Centro fittizio" },
      { company_id: companyId, name: "Porto fittizio" },
    ])
    .select(),
  "create locations",
);
ok(
  await direction
    .from("user_locations")
    .insert({ user_id: credentials[2].userId, location_id: locations[0].id }),
  "assign manager",
);
const employees = ok(
  await direction
    .from("employees")
    .insert(
      locations.map((l, i) => ({
        company_id: companyId,
        location_id: l.id,
        employee_code: "TEST-" + i,
        first_name: i ? "Giulia" : "Elena",
        last_name: i ? "Verdi" : "Rossi",
        job_title: i ? "Addetta sala" : "Barista",
        hired_on: "2025-01-15",
      })),
    )
    .select(),
  "create employees",
);
const managerEmployees = ok(
  await manager.from("employees").select("id"),
  "manager employees",
);
assert.equal(managerEmployees.length, 1);
assert.equal(managerEmployees[0].id, employees[0].id);
passed("Manager sees assigned site only");
assert.equal(
  ok(
    await manager.from("employees").select("id").eq("id", employees[1].id),
    "unauthorized employee",
  ).length,
  0,
);
passed("Manager direct out-of-site API read denied");
assert.equal(
  ok(await manager.from("payroll").select("*"), "manager salary").length,
  0,
);
assert.equal(
  ok(await manager.from("absences").select("*"), "manager absence").length,
  0,
);
passed("Manager cannot read salary or protected absence");
const anonymousRead = await anonymous.from("employees").select("id");
assert(anonymousRead.error || anonymousRead.data.length === 0);
passed("Anonymous cannot read employees");
const criteria = [
  { key: "service", label: "Qualità del servizio", weight: 25 },
  { key: "procedures", label: "Procedure", weight: 25 },
  { key: "teamwork", label: "Collaborazione", weight: 20 },
  { key: "punctuality", label: "Puntualità documentata", weight: 15 },
  { key: "initiative", label: "Autonomia", weight: 15 },
];
const [template] = ok(
  await direction
    .from("evaluation_templates")
    .insert({
      company_id: companyId,
      name: "Modello base fittizio",
      version: 1,
      criteria,
    })
    .select(),
  "template",
);
const [evaluation] = ok(
  await manager
    .from("evaluations")
    .insert({
      employee_id: employees[0].id,
      period: "2026-10-01",
      template_id: template.id,
      scores: {
        service: 5,
        procedures: 4,
        teamwork: 4,
        punctuality: 4,
        initiative: 4,
      },
      comment:
        "Buona autonomia durante il servizio e collaborazione documentata.",
      status: "inviata",
    })
    .select(),
  "manager evaluation",
);
assert.equal(Number(evaluation.weighted_score), 4.25);
passed("Monthly weighted score calculated by database");
ok(
  await direction
    .from("evaluations")
    .update({ status: "convalidata" })
    .eq("id", evaluation.id)
    .select()
    .single(),
  "approval",
);
const edit = await manager
  .from("evaluations")
  .update({ comment: "Tentativo modifica non consentito" })
  .eq("id", evaluation.id)
  .select();
assert(edit.error || edit.data.length === 0);
passed("Approved evaluation cannot be modified by manager");
const diary = ok(
  await manager
    .from("diary_entries")
    .insert({
      employee_id: employees[0].id,
      location_id: locations[0].id,
      event_on: "2026-10-20",
      category: "positivo",
      description:
        "Ha gestito con autonomia una richiesta complessa del cliente.",
    })
    .select()
    .single(),
  "diary",
);
passed("Manager diary insertion persists");
ok(
  await manager.from("goals").insert({
    employee_id: employees[0].id,
    description: "Completare affiancamento sulla cassa",
    due_on: "2026-11-30",
  }),
  "goal",
);
ok(
  await hr.from("absences").insert({
    employee_id: employees[0].id,
    kind: "malattia",
    starts_on: "2026-10-01",
    ends_on: "2026-10-02",
    hours: 16,
  }),
  "absence",
);
passed("HR administrative absence persists under MFA");
const pdf = await PDFDocument.create();
const page = pdf.addPage();
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText("CEDOLINO FITTIZIO - NON VALIDO", { x: 40, y: 740, font });
page.drawText("DIPENDENTE: Elena Rossi", { x: 40, y: 700, font });
page.drawText("MATRICOLA TEST-0", { x: 40, y: 670, font });
page.drawText("COMPETENZA: ottobre 2026", { x: 40, y: 640, font });
page.drawText("NETTO A PAGARE 1.500,00", { x: 40, y: 600, font });
const buffer = Buffer.from(await pdf.save());
const documentId = randomUUID(),
  storagePath = employees[0].id + "/" + documentId + ".pdf";
ok(
  await direction.from("documents").insert({
    id: documentId,
    employee_id: employees[0].id,
    kind: "busta_paga",
    filename: "cedolino-fittizio.pdf",
    storage_path: storagePath,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  }),
  "metadata",
);
ok(
  await direction.storage.from("personnel").upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: false,
  }),
  "private upload",
);
passed("Private PDF Storage upload with real RLS");
assert((await manager.storage.from("personnel").download(storagePath)).error);
passed("Manager cannot download any payroll PDF");
const publicUrl = anonymous.storage.from("personnel").getPublicUrl(storagePath)
  .data.publicUrl;
const publicResponse = await fetch(publicUrl);
assert.notEqual(publicResponse.status, 200);
passed("Private PDF public URL inaccessible");
ok(
  await direction.rpc("record_sensitive_access", { document: documentId }),
  "audit download",
);
const signed = ok(
  await direction.storage.from("personnel").createSignedUrl(storagePath, 30),
  "signed URL",
);
const download = await fetch(signed.signedUrl);
assert.equal(download.status, 200);
assert.equal(
  Buffer.compare(Buffer.from(await download.arrayBuffer()), buffer),
  0,
);
passed("Authorized short-lived signed PDF download matches original");
ok(
  await hr.from("payroll").insert({
    employee_id: employees[0].id,
    document_id: documentId,
    year: 2026,
    month: 10,
    kind: "ordinaria",
    net_amount: 1500,
    status: "verificata",
    ordinary_confirmed: true,
  }),
  "verified payroll",
);
passed("HR explicit verified payroll persistence");
const historyBefore = ok(
  await direction
    .from("revision_history")
    .select("id")
    .eq("table_name", "payroll"),
  "history before",
);
ok(
  await hr
    .from("payroll")
    .update({
      net_amount: 1550,
      correction_reason: "Rettifica verificata sul documento originale",
    })
    .eq("document_id", documentId),
  "salary correction",
);
const historyAfter = ok(
  await direction
    .from("revision_history")
    .select("id")
    .eq("table_name", "payroll"),
  "history after",
);
assert.equal(historyAfter.length, historyBefore.length + 1);
passed("Salary correction preserves prior version");
await writeFile(
  "/tmp/gianno-local-accounts.json",
  JSON.stringify({
    companyId,
    employees,
    locations,
    accounts: credentials.map(({ client, ...x }) => x),
  }),
  { mode: 0o600 },
);
console.log(
  `COMPLETE: ${checks} real local Supabase checks passed; only fictional data used.`,
);
