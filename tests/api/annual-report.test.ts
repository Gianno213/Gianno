import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getUserContext } = vi.hoisted(() => ({ getUserContext: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getUserContext }));
import { GET } from "../../src/app/api/reports/[employeeId]/route";
const employeeId = "11111111-1111-4111-8111-111111111111";
const request = (suffix = "") =>
  new NextRequest(
    `https://people.example/api/reports/${employeeId}?year=2026${suffix}`,
  );
const params = { params: Promise.resolve({ employeeId }) };
function database(aal = "aal2", auditError = false) {
  const from = vi.fn((table: string) => {
    const values: Record<string, unknown> = {
      employees: {
        id: employeeId,
        first_name: "Elena",
        last_name: "Demo",
        employee_code: "D1",
        job_title: "Sala",
        hired_on: "2020-01-01",
        location_id: "l1",
      },
      locations: { name: "Roma demo" },
      annual_plans: null,
    };
    const result = { data: table in values ? values[table] : [], error: null };
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      range: vi.fn(),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    for (const name of [
      "select",
      "eq",
      "single",
      "maybeSingle",
      "gte",
      "lte",
      "order",
      "or",
      "range",
    ] as const)
      builder[name].mockReturnValue(builder);
    return builder;
  });
  return {
    from,
    rpc: vi
      .fn()
      .mockResolvedValue({ error: auditError ? { message: "denied" } : null }),
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel: aal }, error: null }),
      },
    },
  };
}
function context(role = "direzione", db = database(), active = true) {
  return {
    configured: true,
    supabase: db,
    user: { id: "u1" },
    profile: {
      id: "u1",
      company_id: "c1",
      role,
      active,
      full_name: "Utente demo",
    },
  };
}
beforeEach(() => getUserContext.mockReset());
describe("Confini autorizzativi esportazione annuale", () => {
  it("nega accessi anonimi anche con richiesta esplicita di retribuzioni", async () => {
    getUserContext.mockResolvedValue({
      configured: true,
      user: null,
      supabase: database(),
      profile: null,
    });
    const response = await GET(request("&include_salary=1"), params);
    expect(response.status).toBe(401);
  });
  it.each(["responsabile", "hr"])(
    "nega report direzionali al ruolo %s senza interrogare i dati",
    async (role) => {
      const db = database();
      getUserContext.mockResolvedValue(context(role, db));
      expect(
        (
          await GET(
            request("&include_salary=1&include_administrative=1"),
            params,
          )
        ).status,
      ).toBe(403);
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it("richiede MFA anche per Direzione e nega utenti disattivati", async () => {
    const db = database("aal1");
    getUserContext.mockResolvedValue(context("direzione", db));
    expect((await GET(request(), params)).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
    getUserContext.mockResolvedValue(context("direzione", database(), false));
    expect((await GET(request(), params)).status).toBe(403);
  });
  it("non legge tabelle retributive o amministrative nel fascicolo standard", async () => {
    const db = database();
    getUserContext.mockResolvedValue(context("direzione", db));
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(db.from.mock.calls.flat()).not.toContain("payroll");
    expect(db.from.mock.calls.flat()).not.toContain("absences");
    expect(db.from.mock.calls.flat()).not.toContain("contracts");
    expect(db.rpc).toHaveBeenCalledWith("record_data_access", {
      employee: employeeId,
      resource: "annual_report",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("legge sezioni riservate solo con inclusione esplicita e identità autorizzata", async () => {
    const db = database();
    getUserContext.mockResolvedValue(context("direzione", db));
    expect(
      (await GET(request("&include_salary=1&include_administrative=1"), params))
        .status,
    ).toBe(200);
    expect(db.from.mock.calls.flat()).toContain("payroll");
    expect(db.from.mock.calls.flat()).toContain("absences");
  });
  it("interrompe il download se non riesce a tracciare l’accesso", async () => {
    getUserContext.mockResolvedValue(
      context("direzione", database("aal2", true)),
    );
    const response = await GET(request(), params);
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
  });
  it("rifiuta identificatori e anni non validi prima di leggere i dati", async () => {
    expect(
      (
        await GET(
          new NextRequest("https://people.example/api?year=invalid"),
          params,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await GET(request(), {
          params: Promise.resolve({ employeeId: "invalid" }),
        })
      ).status,
    ).toBe(400);
    expect(getUserContext).not.toHaveBeenCalled();
  });
});
