import { getUserContext } from "@/lib/auth";
import { fetchAll } from "@/lib/data/fetch-all";
export type Row = Record<string, any>;
export async function workspaceData(tables: string[]) {
  const ctx = await getUserContext();
  const data: Record<string, Row[]> = {};
  const errors: string[] = [];
  const resources: Record<string, string> = {
    payroll: "payroll",
    absences: "absences",
    attendance_records: "attendance",
    employee_private: "employee_private",
    contracts: "contracts",
    documents: "documents",
  };
  if (ctx.supabase)
    await Promise.all(
      tables.map(async (table) => {
        let rows: Row[] = [];
        let failed = false;
        const order =
          table === "employee_private"
            ? "employee_id"
            : table === "user_locations"
              ? "user_id"
              : "id";
        try {
          rows = await fetchAll<Row>((from, to) => {
            let query = ctx.supabase!.from(table).select("*").order(order);
            if (table === "user_locations") query = query.order("location_id");
            return query.range(from, to);
          });
        } catch (error) {
          errors.push(
            `${table}: ${error instanceof Error ? error.message : "Lettura non riuscita"}`,
          );
          failed = true;
        }
        data[table] = failed ? [] : rows;
        if (!failed && resources[table] && rows.length)
          for (const id of new Set(rows.map((row) => row.employee_id))) {
            const access = await ctx.supabase!.rpc("record_data_access", {
              employee: id,
              resource: resources[table],
            });
            if (access.error) {
              data[table] = [];
              errors.push(
                "Accesso riservato non registrabile: " + access.error.message,
              );
              break;
            }
          }
      }),
    );
  return { ...ctx, data, errors };
}
export function fullName(e: Row | undefined) {
  return e ? `${e.first_name} ${e.last_name}` : "Collaboratore";
}
export function employeeOptions(employees: Row[]) {
  return employees.map((e) => (
    <option key={e.id} value={e.id}>
      {fullName(e)} · {e.employee_code}
    </option>
  ));
}
export function latestEvaluations(evaluations: Row[]) {
  const latest = new Map<string, Row>();
  for (const e of evaluations) {
    const key = `${e.employee_id}-${e.period}`;
    if (
      !latest.has(key) ||
      Number(e.revision) > Number(latest.get(key)!.revision)
    )
      latest.set(key, e);
  }
  return [...latest.values()];
}
