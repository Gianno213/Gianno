import { italianYear } from "@/domain/dates";
import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { fetchAll } from "@/lib/data/fetch-all";
import {
  renderAnnualReport,
  type AnnualReportInput,
} from "@/domain/annual-report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      employeeId,
    )
  )
    return NextResponse.json(
      { error: "Dipendente non valido." },
      { status: 400 },
    );
  const rawYear =
    request.nextUrl.searchParams.get("year") ?? String(italianYear());
  if (!/^20\d{2}$/.test(rawYear))
    return NextResponse.json({ error: "Anno non valido." }, { status: 400 });
  const year = Number(rawYear);
  const start = `${year}-01-01`,
    end = `${year}-12-31`;
  const ctx = await getUserContext();
  if (!ctx.user || !ctx.supabase)
    return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
  if (!ctx.profile?.active || ctx.profile.role !== "direzione")
    return NextResponse.json(
      { error: "Accesso riservato alla Direzione." },
      { status: 403 },
    );
  const assurance =
    await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2")
    return NextResponse.json(
      { error: "Verifica MFA richiesta." },
      { status: 403 },
    );
  const db = ctx.supabase;
  const employeeResult = await db
    .from("employees")
    .select(
      "id,first_name,last_name,employee_code,job_title,hired_on,location_id",
    )
    .eq("id", employeeId)
    .single();
  if (employeeResult.error || !employeeResult.data)
    return NextResponse.json(
      { error: "Dipendente non trovato o non autorizzato." },
      { status: 404 },
    );
  const includeSalary =
    request.nextUrl.searchParams.get("include_salary") === "1";
  const includeAdministrative =
    request.nextUrl.searchParams.get("include_administrative") === "1";
  try {
    // Every collection is ordered by a unique key and exhausted, not silently capped at PostgREST's row limit.
    const [location, evaluations, diary, goals, training, plan] =
      await Promise.all([
        db
          .from("locations")
          .select("name")
          .eq("id", employeeResult.data.location_id)
          .single(),
        fetchAll((from, to) =>
          db
            .from("evaluations")
            .select(
              "period,weighted_score,not_evaluable,reason,comment,scores,revision,evaluation_templates(criteria)",
            )
            .eq("employee_id", employeeId)
            .eq("status", "convalidata")
            .gte("period", start)
            .lte("period", end)
            .order("period")
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          db
            .from("diary_entries")
            .select(
              "id,event_on,category,description,action_taken,verification_status",
            )
            .eq("employee_id", employeeId)
            .gte("event_on", start)
            .lte("event_on", end)
            .order("event_on")
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          db
            .from("goals")
            .select("description,status,due_on,outcome")
            .eq("employee_id", employeeId)
            .gte("assigned_on", start)
            .lte("assigned_on", end)
            .order("assigned_on")
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          db
            .from("training_records")
            .select("title,completed_on,hours")
            .eq("employee_id", employeeId)
            .gte("completed_on", start)
            .lte("completed_on", end)
            .order("id")
            .range(from, to),
        ),
        db
          .from("annual_plans")
          .select("observations")
          .eq("employee_id", employeeId)
          .eq("year", year)
          .maybeSingle(),
      ]);
    if (location.error || plan.error)
      throw new Error("Lettura del fascicolo non riuscita.");
    const comments = diary.length
      ? await fetchAll((from, to) =>
          db
            .from("diary_comments")
            .select(
              "entry_id,body,kind,created_at,author_id,diary_entries!inner(employee_id,event_on)",
            )
            .eq("diary_entries.employee_id", employeeId)
            .gte("diary_entries.event_on", start)
            .lte("diary_entries.event_on", end)
            .order("created_at")
            .order("id")
            .range(from, to),
        )
      : [];
    const input: AnnualReportInput = {
      year,
      employee: employeeResult.data,
      location: location.data?.name ?? "Non disponibile",
      evaluations: evaluations.map((row) => {
        const related = row.evaluation_templates;
        const template = Array.isArray(related) ? related[0] : related;
        return { ...row, criteria: template?.criteria ?? [] };
      }),
      diary: diary.map((entry) => ({
        ...entry,
        diary_comments: comments.filter(
          (comment) => comment.entry_id === entry.id,
        ),
      })),
      goals,
      training,
      plan: plan.data?.observations ?? null,
    };
    if (includeSalary) {
      input.salary = await fetchAll((from, to) =>
        db
          .from("payroll")
          .select(
            "year,month,kind,net_amount,status,extraordinary_amount,ordinary_confirmed",
          )
          .eq("employee_id", employeeId)
          .lte("year", year)
          .eq("status", "verificata")
          .order("id")
          .range(from, to),
      );
    }
    if (includeAdministrative) {
      const [contracts, absences] = await Promise.all([
        fetchAll((from, to) =>
          db
            .from("contracts")
            .select("contract_type,ccnl_level,weekly_hours,starts_on,ends_on")
            .eq("employee_id", employeeId)
            .lte("starts_on", end)
            .or(`ends_on.is.null,ends_on.gte.${start}`)
            .order("id")
            .range(from, to),
        ),
        fetchAll((from, to) =>
          db
            .from("absences")
            .select("kind,starts_on,ends_on,hours")
            .eq("employee_id", employeeId)
            .lte("starts_on", end)
            .gte("ends_on", start)
            .order("id")
            .range(from, to),
        ),
      ]);
      input.administrative = { contracts, absences };
    }
    const audit = await db.rpc("record_data_access", {
      employee: employeeId,
      resource: "annual_report",
    });
    if (audit.error)
      throw new Error(
        "Registrazione dell’accesso non riuscita: esportazione interrotta.",
      );
    const bytes = await renderAnnualReport(input);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gianno-fascicolo-${year}-${employeeId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Impossibile generare il report. Verificare autorizzazioni, migrazioni e disponibilità del database.",
      },
      { status: 500 },
    );
  }
}
