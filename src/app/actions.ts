"use server";
import { italianToday } from "@/domain/dates";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePayrollText } from "@/domain/payroll";
import { requiredNumber } from "@/lib/validation";

const id = z.string().uuid();
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const checkbox = (f: FormData, k: string) =>
  ["on", "true", "1"].includes(text(f, k));
const date = z.iso.date();
const nullableDate = (f: FormData, k: string) =>
  text(f, k) ? date.parse(text(f, k)) : null;
const safePath = (f: FormData, fallback: string) => {
  const p = text(f, "return_to");
  if (
    !p.startsWith("/") ||
    p.startsWith("//") ||
    p.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(p)
  )
    return fallback;
  const url = new URL(p, "https://gianno.invalid");
  return url.pathname + url.search + url.hash;
};
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
function message(e: unknown) {
  return e instanceof z.ZodError
    ? "Controlla i campi: " +
        e.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")
    : e instanceof Error
      ? e.message
      : "Operazione non riuscita.";
}
async function run(f: FormData, path: string, fn: () => Promise<void>) {
  let error: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    error = message(e);
  }
  revalidatePath("/", "layout");
  const destination = safePath(f, path);
  redirect(
    destination +
      (destination.includes("?") ? "&" : "?") +
      (error
        ? "error=" + encodeURIComponent(error)
        : "success=" + encodeURIComponent("Operazione salvata.")),
  );
}
export async function signIn(f: FormData) {
  const email = z.email().safeParse(text(f, "email"));
  if (!email.success) redirect("/login?error=Email%20non%20valida.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: String(f.get("password") ?? ""),
  });
  if (error)
    redirect(
      "/login?error=Credenziali%20non%20valide%20o%20account%20non%20disponibile.",
    );
  redirect("/dashboard");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
export async function createLocation(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/sedi", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Solo la Direzione può gestire le sedi.");
    const { error } = await c.supabase.from("locations").insert({
      company_id: c.profile.company_id,
      name: z.string().min(2).max(150).parse(text(f, "name")),
      address: text(f, "address"),
    });
    check(error);
  });
}
export async function createEmployee(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const payload = {
      company_id: c.profile.company_id,
      location_id: id.parse(text(f, "location_id")),
      employee_code: z.string().min(1).max(50).parse(text(f, "employee_code")),
      first_name: z.string().min(1).max(100).parse(text(f, "first_name")),
      last_name: z.string().min(1).max(100).parse(text(f, "last_name")),
      job_title: z.string().min(1).max(150).parse(text(f, "job_title")),
      hired_on: date.parse(text(f, "hired_on")),
      status: z
        .enum(["attivo", "cessato", "sospeso"])
        .parse(text(f, "status") || "attivo"),
    };
    const { error } = await c.supabase.from("employees").insert(payload);
    check(error);
  });
}
export async function updateEmployee(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const { error } = await c.supabase
      .from("employees")
      .update({
        first_name: z.string().min(1).max(100).parse(text(f, "first_name")),
        last_name: z.string().min(1).max(100).parse(text(f, "last_name")),
        job_title: z.string().min(1).max(150).parse(text(f, "job_title")),
        location_id: id.parse(text(f, "location_id")),
        status: z
          .enum(["attivo", "cessato", "sospeso"])
          .parse(text(f, "status")),
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
export async function savePrivateDetails(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const { error } = await c.supabase.from("employee_private").upsert({
      employee_id: id.parse(text(f, "employee_id")),
      birth_date: nullableDate(f, "birth_date"),
      email: text(f, "email") ? z.email().parse(text(f, "email")) : null,
      phone: optional(f, "phone"),
    });
    check(error);
  });
}
export async function saveContract(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const { error } = await c.supabase.from("contracts").insert({
      employee_id: id.parse(text(f, "employee_id")),
      contract_type: z.string().min(2).max(150).parse(text(f, "contract_type")),
      ccnl_level: optional(f, "ccnl_level"),
      weekly_hours: requiredNumber(text(f, "weekly_hours"), 60),
      starts_on: date.parse(text(f, "starts_on")),
      ends_on: nullableDate(f, "ends_on"),
      notes: optional(f, "notes"),
    });
    check(error);
  });
}
export async function saveDiary(f: FormData) {
  const c = await requireAuth();
  await run(f, "/diario", async () => {
    const data = {
      event_on: date.parse(text(f, "event_on")),
      category: z
        .enum([
          "positivo",
          "criticita",
          "osservazione",
          "miglioramento",
          "formazione",
        ])
        .parse(text(f, "category")),
      description: z.string().min(5).max(6000).parse(text(f, "description")),
      action_taken: optional(f, "action_taken"),
    };
    let result;
    if (text(f, "id"))
      result = await c.supabase
        .from("diary_entries")
        .update(data)
        .eq("id", id.parse(text(f, "id")))
        .select("id")
        .single();
    else {
      const employeeId = id.parse(text(f, "employee_id"));
      const { data: employee, error: employeeError } = await c.supabase
        .from("employees")
        .select("location_id")
        .eq("id", employeeId)
        .single();
      check(employeeError);
      if (!employee) throw new Error("Collaboratore non autorizzato.");
      result = await c.supabase.from("diary_entries").insert({
        ...data,
        employee_id: employeeId,
        location_id: employee.location_id,
        author_id: c.user.id,
      });
    }
    check(result.error);
  });
}
export async function commentDiary(f: FormData) {
  const c = await requireAuth();
  await run(f, "/diario", async () => {
    const { error } = await c.supabase.from("diary_comments").insert({
      entry_id: id.parse(text(f, "entry_id")),
      author_id: c.user.id,
      body: z.string().min(1).max(6000).parse(text(f, "body")),
      kind: z
        .enum(["commento", "rettifica", "osservazione_dipendente"])
        .parse(text(f, "kind") || "commento"),
    });
    check(error);
  });
}
export async function verifyDiary(f: FormData) {
  const c = await requireAuth();
  await run(f, "/diario", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Verifica riservata alla Direzione.");
    const { error } = await c.supabase
      .from("diary_entries")
      .update({
        verification_status: z
          .enum(["da_verificare", "verificata", "chiarimento_richiesto"])
          .parse(text(f, "verification_status")),
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
export async function saveEvaluation(f: FormData) {
  const c = await requireAuth();
  await run(f, "/valutazioni", async () => {
    let scores: Record<string, number> = {};
    if (text(f, "scores"))
      scores = z
        .record(z.string(), z.number().int().min(1).max(5))
        .parse(JSON.parse(text(f, "scores")));
    else
      for (const [k, v] of f.entries())
        if (k.startsWith("score_") && v !== "")
          scores[k.slice(6)] = z.coerce.number().int().min(1).max(5).parse(v);
    const data = {
      scores,
      comment: text(f, "comment"),
      status: z.enum(["bozza", "inviata"]).parse(text(f, "status") || "bozza"),
      not_evaluable: checkbox(f, "not_evaluable"),
      reason: optional(f, "reason"),
    };
    let result;
    if (text(f, "id"))
      result = await c.supabase
        .from("evaluations")
        .update(data)
        .eq("id", id.parse(text(f, "id")))
        .select("id")
        .single();
    else {
      const period = text(f, "period");
      const payload = {
        ...data,
        employee_id: id.parse(text(f, "employee_id")),
        template_id: id.parse(text(f, "template_id")),
        reviewer_id: c.user.id,
        period: date.parse(period.length === 7 ? period + "-01" : period),
      };
      result = await c.supabase.from("evaluations").insert(payload);
    }
    check(result.error);
  });
}
export async function updateEvaluationStatus(f: FormData) {
  const c = await requireAuth();
  await run(f, "/valutazioni", async () => {
    const { error } = await c.supabase
      .from("evaluations")
      .update({
        status: z
          .enum(["bozza", "inviata", "da_verificare", "convalidata"])
          .parse(text(f, "status")),
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
export async function rectifyEvaluation(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/valutazioni", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Rettifica riservata alla Direzione.");
    const { data: old, error } = await c.supabase
      .from("evaluations")
      .select("*")
      .eq("id", id.parse(text(f, "id")))
      .single();
    check(error);
    if (!old) throw new Error("Valutazione non trovata.");
    const { error: insertError } = await c.supabase.from("evaluations").insert({
      employee_id: old.employee_id,
      reviewer_id: c.user.id,
      period: old.period,
      template_id: old.template_id,
      scores: old.scores,
      comment: old.comment,
      not_evaluable: old.not_evaluable,
      reason: old.reason,
      status: "bozza",
      revision: old.revision + 1,
      supersedes_id: old.id,
      rectification_reason: z
        .string()
        .min(5)
        .max(6000)
        .parse(text(f, "rectification_reason")),
    });
    check(insertError);
  });
}
export async function createGoal(f: FormData) {
  const c = await requireAuth();
  await run(f, "/obiettivi", async () => {
    const { error } = await c.supabase.from("goals").insert({
      employee_id: id.parse(text(f, "employee_id")),
      owner_id: c.user.id,
      description: z.string().min(5).max(6000).parse(text(f, "description")),
      due_on: nullableDate(f, "due_on"),
      status: "da_iniziare",
      comments: optional(f, "comments"),
    });
    check(error);
  });
}
export async function updateGoal(f: FormData) {
  const c = await requireAuth();
  await run(f, "/obiettivi", async () => {
    const { error } = await c.supabase
      .from("goals")
      .update({
        status: z
          .enum(["da_iniziare", "in_corso", "completato", "da_rivedere"])
          .parse(text(f, "status")),
        comments: optional(f, "comments"),
        outcome: optional(f, "outcome"),
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
export async function saveTraining(f: FormData) {
  const c = await requireAuth();
  await run(f, "/obiettivi", async () => {
    const { error } = await c.supabase.from("training_records").insert({
      employee_id: id.parse(text(f, "employee_id")),
      title: z.string().min(2).max(300).parse(text(f, "title")),
      completed_on: nullableDate(f, "completed_on"),
      hours: requiredNumber(text(f, "hours"), 10000),
      notes: optional(f, "notes"),
    });
    check(error);
  });
}
export async function saveAbsence(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/assenze", async () => {
    const { error } = await c.supabase.from("absences").insert({
      employee_id: id.parse(text(f, "employee_id")),
      kind: z
        .enum([
          "ferie",
          "permesso",
          "malattia",
          "assenza_tutelata",
          "da_verificare",
          "ritardo",
          "altro",
        ])
        .parse(text(f, "kind")),
      starts_on: date.parse(text(f, "starts_on")),
      ends_on: date.parse(text(f, "ends_on")),
      hours: requiredNumber(text(f, "hours"), 100000),
      notes: optional(f, "notes"),
    });
    check(error);
  });
}
export async function saveAttendance(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/assenze", async () => {
    const { error } = await c.supabase.from("attendance_records").insert({
      employee_id: id.parse(text(f, "employee_id")),
      work_date: date.parse(text(f, "work_date")),
      hours: requiredNumber(text(f, "hours"), 24),
      source: "manuale",
    });
    check(error);
  });
}
async function storeDocument(
  c: Awaited<ReturnType<typeof requireAuth>>,
  f: FormData,
  kind: string,
) {
  const file = f.get("file");
  if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024)
    throw new Error("Seleziona un PDF fino a 15 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Il file non è un PDF valido.");
  const employeeId = id.parse(text(f, "employee_id"));
  const documentId = randomUUID();
  const path = employeeId + "/" + documentId + ".pdf";
  const { error } = await c.supabase.from("documents").insert({
    id: documentId,
    employee_id: employeeId,
    kind,
    filename: file.name.slice(0, 255),
    storage_path: path,
    sha256: createHash("sha256").update(data).digest("hex"),
    uploaded_by: c.user.id,
  });
  check(error);
  const { error: uploadError } = await c.supabase.storage
    .from("personnel")
    .upload(path, data, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    const { error: cleanupError } = await c.supabase
      .from("documents")
      .delete()
      .eq("id", documentId);
    throw new Error(
      cleanupError
        ? "Caricamento interrotto e metadati non rimossi. Contatta la Direzione: " +
            documentId
        : "Caricamento PDF non riuscito. Nessun duplicato conservato; riprova.",
    );
  }
  return { data, documentId, employeeId };
}
export async function uploadDocument(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/documenti", async () => {
    await storeDocument(
      c,
      f,
      z.enum(["contratto", "altro"]).parse(text(f, "kind") || "altro"),
    );
  });
}
export async function uploadPayroll(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/retribuzioni", async () => {
    const { data, documentId, employeeId } = await storeDocument(
      c,
      f,
      "busta_paga",
    );
    let extraction:
      ReturnType<typeof parsePayrollText> | { warnings: string[] };
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(data) });
      try {
        const result = await parser.getText();
        extraction = parsePayrollText(result.text);
      } finally {
        await parser.destroy();
      }
    } catch {
      extraction = {
        warnings: [
          "Estrazione non disponibile. Verifica manualmente il PDF originale.",
        ],
      };
    }
    const identified = extraction as {
      employeeCode?: string | null;
      employeeName?: string | null;
      warnings: string[];
    };
    const { data: employee } = await c.supabase
      .from("employees")
      .select("employee_code,first_name,last_name")
      .eq("id", employeeId)
      .single();
    if (
      identified.employeeCode &&
      employee &&
      identified.employeeCode.toLowerCase() !==
        employee.employee_code.toLowerCase()
    )
      identified.warnings.push(
        "Il codice dipendente estratto non corrisponde al collaboratore selezionato. Verifica l’associazione prima della conferma.",
      );
    const extracted = extraction as {
      year?: number | null;
      month?: number | null;
      kind?: string;
      netAmount?: number | null;
    };
    const { error } = await c.supabase.from("payroll").insert({
      employee_id: employeeId,
      document_id: documentId,
      year: extracted.year ?? null,
      month: extracted.month ?? null,
      kind: extracted.kind || "ordinaria",
      net_amount: extracted.netAmount ?? null,
      status: "bozza",
      ordinary_confirmed: false,
      extraction,
    });
    check(error);
  });
}
export async function confirmPayroll(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/retribuzioni", async () => {
    if (!checkbox(f, "confirmed"))
      throw new Error(
        "Conferma di aver confrontato i dati con il PDF originale.",
      );
    const { error } = await c.supabase
      .from("payroll")
      .update({
        year: z.coerce
          .number()
          .int()
          .min(2000)
          .max(2200)
          .parse(text(f, "year")),
        month: z.coerce.number().int().min(1).max(12).parse(text(f, "month")),
        kind: z
          .enum(["ordinaria", "tredicesima", "quattordicesima"])
          .parse(text(f, "kind")),
        net_amount: requiredNumber(text(f, "net_amount"), 10000000),
        extraordinary_amount: text(f, "extraordinary_amount")
          ? z.coerce.number().min(0).parse(text(f, "extraordinary_amount"))
          : null,
        ordinary_confirmed: checkbox(f, "ordinary_confirmed"),
        status: "verificata",
        correction_reason: optional(f, "correction_reason"),
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
export async function saveAnnualPlan(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/report", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Operazione riservata alla Direzione.");
    const { error } = await c.supabase.from("annual_plans").upsert(
      {
        employee_id: id.parse(text(f, "employee_id")),
        year: z.coerce
          .number()
          .int()
          .min(2000)
          .max(2200)
          .parse(text(f, "year")),
        observations: z
          .string()
          .min(5)
          .max(20000)
          .parse(text(f, "observations")),
        author_id: c.user.id,
      },
      { onConflict: "employee_id,year" },
    );
    check(error);
  });
}
export async function saveTemplate(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Operazione riservata alla Direzione.");
    const criteria = z
      .array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          weight: z.number().positive().max(100),
        }),
      )
      .min(1)
      .parse(JSON.parse(text(f, "criteria")));
    if (criteria.reduce((a, b) => a + b.weight, 0) !== 100)
      throw new Error("I pesi devono totalizzare 100.");
    const { error } = await c.supabase.from("evaluation_templates").insert({
      company_id: c.profile.company_id,
      name: z.string().min(2).parse(text(f, "name")),
      job_title: optional(f, "job_title"),
      version: z.coerce.number().int().positive().parse(text(f, "version")),
      criteria,
    });
    check(error);
  });
}
export async function saveProfile(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Operazione riservata alla Direzione.");
    const userId = id.parse(text(f, "id"));
    const data = {
      id: userId,
      company_id: c.profile.company_id,
      full_name: z.string().min(2).max(200).parse(text(f, "full_name")),
      role: z.enum(["direzione", "hr", "responsabile"]).parse(text(f, "role")),
      active: checkbox(f, "active"),
      evaluations_access: checkbox(f, "evaluations_access"),
    };
    if (userId === c.user.id && (!data.active || data.role !== "direzione"))
      throw new Error("Non puoi revocare il tuo stesso accesso Direzione.");
    const { error } = await c.supabase.from("profiles").upsert(data);
    check(error);
  });
}
export async function assignLocation(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Operazione riservata alla Direzione.");
    const userId = id.parse(text(f, "user_id")),
      locationId = id.parse(text(f, "location_id"));
    const { error } = checkbox(f, "remove")
      ? await c.supabase
          .from("user_locations")
          .delete()
          .eq("user_id", userId)
          .eq("location_id", locationId)
      : await c.supabase
          .from("user_locations")
          .upsert({ user_id: userId, location_id: locationId });
    check(error);
  });
}
export async function saveDataRequest(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    const { error } = await c.supabase.from("data_requests").insert({
      employee_id: id.parse(text(f, "employee_id")),
      kind: z
        .enum(["accesso", "rettifica", "cancellazione"])
        .parse(text(f, "kind")),
      description: z.string().min(5).max(6000).parse(text(f, "description")),
    });
    check(error);
  });
}
export async function savePrivateEmployee(f: FormData) {
  return savePrivateDetails(f);
}
export async function createTemplate(f: FormData) {
  return saveTemplate(f);
}
export async function saveDiaryComment(f: FormData) {
  return commentDiary(f);
}
export async function createTraining(f: FormData) {
  return saveTraining(f);
}
export async function saveCompany(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    if (c.profile.role !== "direzione")
      throw new Error("Operazione riservata alla Direzione.");
    const { error } = await c.supabase
      .from("companies")
      .update({
        name: z.string().min(2).max(200).parse(text(f, "name")),
        retention_months: z.coerce
          .number()
          .int()
          .min(12)
          .max(120)
          .parse(text(f, "retention_months")),
      })
      .eq("id", c.profile.company_id)
      .select("id")
      .single();
    check(error);
  });
}
async function csvRows(f: FormData) {
  const file = f.get("file");
  if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024)
    throw new Error("Seleziona un CSV UTF-8 fino a 2 MB.");
  const Papa = (await import("papaparse")).default;
  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length)
    throw new Error("CSV non valido: " + parsed.errors[0].message);
  if (!parsed.data.length || parsed.data.length > 2000)
    throw new Error("Importa da 1 a 2000 righe per volta.");
  return parsed.data;
}
export async function importEmployees(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const rows = await csvRows(f);
    const data = rows.map((row, i) => {
      try {
        return {
          company_id: c.profile.company_id,
          location_id: id.parse(row.location_id),
          employee_code: z.string().min(1).max(50).parse(row.employee_code),
          first_name: z.string().min(1).max(100).parse(row.first_name),
          last_name: z.string().min(1).max(100).parse(row.last_name),
          job_title: z.string().min(1).max(150).parse(row.job_title),
          hired_on: date.parse(row.hired_on),
          status: z
            .enum(["attivo", "cessato", "sospeso"])
            .parse(row.status || "attivo"),
        };
      } catch {
        throw new Error(
          "Riga " +
            (i + 2) +
            ": dati non validi. Usa le intestazioni indicate e date YYYY-MM-DD.",
        );
      }
    });
    const { error } = await c.supabase.from("employees").insert(data);
    check(error);
  });
}
export async function importAttendance(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/assenze", async () => {
    const rows = await csvRows(f);
    const data = rows.map((row, i) => {
      try {
        return {
          employee_id: id.parse(row.employee_id),
          work_date: date.parse(row.work_date),
          hours: requiredNumber(row.hours, 24),
          source: z
            .string()
            .min(1)
            .max(100)
            .parse(row.source || "import_csv"),
        };
      } catch {
        throw new Error(
          "Riga " +
            (i + 2) +
            ": employee_id, work_date, hours o source non validi.",
        );
      }
    });
    const { error } = await c.supabase.from("attendance_records").insert(data);
    check(error);
  });
}
export async function requestPasswordReset(f: FormData) {
  const email = z.email().safeParse(text(f, "email"));
  if (!email.success) redirect("/login?error=Email%20non%20valida.");
  const supabase = await createClient();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!site)
    redirect(
      "/login?error=Recupero%20non%20configurato.%20Contatta%20la%20Direzione.",
    );
  let callback: URL;
  try {
    callback = new URL("/auth/callback?next=/auth/password", site);
    if (
      callback.protocol !== "https:" &&
      !(
        callback.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(callback.hostname)
      )
    )
      throw new Error("Invalid origin");
  } catch {
    redirect(
      "/login?error=Recupero%20non%20configurato.%20Contatta%20la%20Direzione.",
    );
  }
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: callback.toString(),
  });
  redirect(
    "/login?success=" +
      encodeURIComponent(
        "Se l’account esiste, riceverai le istruzioni per il recupero.",
      ),
  );
}
export async function updatePassword(f: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance)
    redirect(
      "/auth/password?error=Sessione%20non%20verificabile.%20Richiedi%20un%20nuovo%20link.",
    );
  if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2")
    redirect("/auth/mfa?next=/auth/password");
  const parsed = z
    .string()
    .min(12)
    .max(128)
    .safeParse(String(f.get("password") ?? ""));
  if (
    !parsed.success ||
    String(f.get("password") ?? "") !== String(f.get("confirm_password") ?? "")
  )
    redirect(
      "/auth/password?error=Usa%20almeno%2012%20caratteri%20e%20conferma%20la%20password.",
    );
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error)
    redirect(
      "/auth/password?error=Impossibile%20aggiornare%20la%20password.%20Verifica%20MFA%20o%20richiedi%20un%20nuovo%20link.",
    );
  await supabase.auth.signOut();
  redirect("/login?success=Password%20aggiornata.%20Accedi%20nuovamente.");
}
export async function createAttendance(f: FormData) {
  return saveAttendance(f);
}
export async function recoverPayrollDraft(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/retribuzioni", async () => {
    const documentId = id.parse(text(f, "document_id"));
    const { data: document, error } = await c.supabase
      .from("documents")
      .select("id,employee_id,storage_path")
      .eq("id", documentId)
      .eq("kind", "busta_paga")
      .single();
    check(error);
    if (!document) throw new Error("Documento non disponibile.");
    const { error: auditError } = await c.supabase.rpc(
      "record_sensitive_access",
      { document: documentId },
    );
    check(auditError);
    const { data: pdf, error: downloadError } = await c.supabase.storage
      .from("personnel")
      .download(document.storage_path);
    check(downloadError);
    if (!pdf) throw new Error("File originale non disponibile.");
    const { error: insertError } = await c.supabase.from("payroll").insert({
      employee_id: document.employee_id,
      document_id: documentId,
      year: null,
      month: null,
      kind: "ordinaria",
      net_amount: null,
      status: "bozza",
      extraction: {
        warnings: [
          "Verifica ripresa manualmente. Inserisci i dati dal PDF originale.",
        ],
        requiresConfirmation: true,
      },
    });
    check(insertError);
  });
}
export async function uploadEmployeePhoto(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/dipendenti", async () => {
    const employeeId = id.parse(text(f, "employee_id"));
    const file = f.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new Error("Seleziona una foto JPEG, PNG o WebP fino a 5 MB.");
    const original = Buffer.from(await file.arrayBuffer());
    const isPng = original
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg =
      original[0] === 255 && original[1] === 216 && original[2] === 255;
    const isWebp =
      original.subarray(0, 4).toString() === "RIFF" &&
      original.subarray(8, 12).toString() === "WEBP";
    if (!isPng && !isJpeg && !isWebp)
      throw new Error(
        "Formato foto non supportato. SVG e altri formati non sono ammessi.",
      );
    const sharp = (await import("sharp")).default;
    const image = await sharp(original, { limitInputPixels: 25000000 })
      .rotate()
      .resize(640, 640, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const path = employeeId + "/" + randomUUID() + ".webp";
    const { data: prior, error } = await c.supabase
      .from("employees")
      .select("photo_path")
      .eq("id", employeeId)
      .single();
    check(error);
    if (!prior) throw new Error("Dipendente non disponibile.");
    const { error: updateError } = await c.supabase
      .from("employees")
      .update({ photo_path: path })
      .eq("id", employeeId)
      .select("id")
      .single();
    check(updateError);
    const { error: uploadError } = await c.supabase.storage
      .from("employee-photos")
      .upload(path, image, { contentType: "image/webp", upsert: false });
    if (uploadError) {
      await c.supabase
        .from("employees")
        .update({ photo_path: prior.photo_path })
        .eq("id", employeeId);
      throw new Error("Caricamento foto non riuscito.");
    }
  });
}
export async function updateDataRequest(f: FormData) {
  const c = await requireAuth(true);
  await run(f, "/impostazioni", async () => {
    const status = z
      .enum(["aperta", "in_corso", "chiusa"])
      .parse(text(f, "status"));
    const { error } = await c.supabase
      .from("data_requests")
      .update({
        status,
        resolved_on: status === "chiusa" ? italianToday() : null,
      })
      .eq("id", id.parse(text(f, "id")))
      .select("id")
      .single();
    check(error);
  });
}
