import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { fetchAll } from "@/lib/data/fetch-all";

const columns: Record<string, string[]> = {
  employees: [
    "id",
    "employee_code",
    "first_name",
    "last_name",
    "job_title",
    "status",
    "location_id",
    "hired_on",
  ],
  evaluations: [
    "employee_id",
    "period",
    "weighted_score",
    "status",
    "revision",
    "comment",
  ],
  diary_entries: [
    "employee_id",
    "event_on",
    "category",
    "description",
    "verification_status",
  ],
  goals: ["employee_id", "description", "due_on", "status", "outcome"],
  attendance_records: ["employee_id", "work_date", "hours", "source"],
  absences: ["employee_id", "kind", "starts_on", "ends_on", "hours"],
  payroll: ["employee_id", "year", "month", "kind", "net_amount", "status"],
};
function cell(value: unknown) {
  let s = String(value ?? "");
  if (/^(?:\s*[=+@-]|[\t\r\n])/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export async function GET(request: Request) {
  const { supabase, user, profile } = await getUserContext();
  if (!supabase || !user)
    return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
  if (!profile?.active)
    return NextResponse.json({ error: "Account non attivo." }, { status: 403 });
  const url = new URL(request.url);
  const table =
    url.searchParams.get("type") ||
    url.searchParams.get("table") ||
    "employees";
  const fields = columns[table];
  if (!fields)
    return NextResponse.json(
      { error: "Tipo di esportazione non valido." },
      { status: 400 },
    );
  if (
    profile.role === "responsabile" &&
    ["payroll", "absences", "attendance_records"].includes(table)
  )
    return NextResponse.json(
      { error: "Accesso non autorizzato." },
      { status: 403 },
    );
  if (profile.role !== "responsabile") {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2")
      return NextResponse.json(
        { error: "Verifica MFA richiesta." },
        { status: 403 },
      );
  }
  const employee = url.searchParams.get("employee_id");
  let data: Record<string, unknown>[];
  try {
    data = await fetchAll<Record<string, unknown>>((from, to) => {
      let query = supabase
        .from(table)
        .select(fields.join(","))
        .order("id")
        .range(from, to);
      if (employee)
        query = query.eq(
          table === "employees" ? "id" : "employee_id",
          employee,
        );
      return query as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    }, 10001);
  } catch {
    return NextResponse.json(
      { error: "Esportazione non disponibile. Nessun file parziale generato." },
      { status: 500 },
    );
  }
  if ((data?.length || 0) > 10000)
    return NextResponse.json(
      { error: "Limita il filtro a meno di 10.000 righe." },
      { status: 400 },
    );
  if (profile.role !== "responsabile") {
    const ids = new Set(
      (data || []).map((row) => {
        const r = row as unknown as Record<string, unknown>;
        return String(table === "employees" ? r.id : r.employee_id);
      }),
    );
    for (const employeeId of ids) {
      const { error: auditError } = await supabase.rpc("record_data_access", {
        resource: "export",
        employee: employeeId,
      });
      if (auditError)
        return NextResponse.json(
          {
            error: "Impossibile registrare l’accesso. Esportazione interrotta.",
          },
          { status: 500 },
        );
    }
  }
  const lines = [
    fields.map(cell).join(";"),
    ...(data || []).map((row) =>
      fields
        .map((k) => cell((row as unknown as Record<string, unknown>)[k]))
        .join(";"),
    ),
  ];
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gianno-${table}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
