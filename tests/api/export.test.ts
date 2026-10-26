import { beforeEach, describe, expect, it, vi } from "vitest";
const { getUserContext } = vi.hoisted(() => ({ getUserContext: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getUserContext }));
import { GET } from "../../src/app/api/export/route";
const request = (type = "employees") =>
  new Request("https://people.example/api/export?type=" + type);
function database(
  rows: Record<string, unknown>[],
  cap = 250,
  failOffset: number | null = null,
  aal = "aal2",
) {
  const ranges: [number, number][] = [];
  const order = vi.fn();
  const from = vi.fn(() => {
    let start = 0,
      end = 999;
    const builder = {
      select: vi.fn(),
      order,
      eq: vi.fn(),
      range: vi.fn((a: number, b: number) => {
        start = a;
        end = b;
        ranges.push([a, b]);
        return builder;
      }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({
          data:
            failOffset === start
              ? null
              : rows.slice(start, Math.min(end + 1, start + cap)),
          error: failOffset === start ? { message: "network failure" } : null,
        }).then(resolve),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    order.mockReturnValue(builder);
    return builder;
  });
  return {
    from,
    ranges,
    order,
    rpc: vi.fn().mockResolvedValue({ error: null }),
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel: aal } }),
      },
    },
  };
}
function context(db: ReturnType<typeof database>, role = "responsabile") {
  return {
    configured: true,
    supabase: db,
    user: { id: "u1" },
    profile: { id: "u1", company_id: "c1", role, active: true },
  };
}
beforeEach(() => vi.clearAllMocks());
describe("CSV autorizzato e completo", () => {
  it("pagina oltre il limite server e conserva tutte le righe con ordinamento stabile", async () => {
    const rows = Array.from({ length: 1251 }, (_, i) => ({
      id: String(i),
      employee_code: "E" + i,
      first_name: "Demo",
      last_name: "Fittizio",
    }));
    const db = database(rows);
    getUserContext.mockResolvedValue(context(db));
    const response = await GET(request());
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.split("\r\n")).toHaveLength(1252);
    expect(csv).toContain('"E1250"');
    expect(db.ranges).toEqual([
      [0, 999],
      [250, 1249],
      [500, 1499],
      [750, 1749],
      [1000, 1999],
      [1250, 2249],
      [1251, 2250],
    ]);
    expect(db.order).toHaveBeenCalledWith("id");
  });
  it("rifiuta oltre 10000 righe senza scaricare tutto il database", async () => {
    const rows = Array.from({ length: 12000 }, (_, i) => ({ id: String(i) }));
    const db = database(rows, 1000);
    getUserContext.mockResolvedValue(context(db));
    expect((await GET(request())).status).toBe(400);
    expect(db.ranges.at(-1)).toEqual([10000, 10000]);
    expect(db.ranges).toHaveLength(11);
  });
  it("interrompe invece di esportare un file parziale quando una pagina fallisce", async () => {
    const db = database(
      Array.from({ length: 500 }, (_, i) => ({ id: String(i) })),
      250,
      250,
    );
    getUserContext.mockResolvedValue(context(db));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
  it.each(["payroll", "absences", "attendance_records"])(
    "nega al responsabile l’esportazione %s senza leggere il DB",
    async (type) => {
      const db = database([]);
      getUserContext.mockResolvedValue(context(db));
      expect((await GET(request(type))).status).toBe(403);
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it.each(["hr", "direzione"])(
    "richiede MFA per %s anche sui dati operativi",
    async (role) => {
      const db = database([], 250, null, "aal1");
      getUserContext.mockResolvedValue(context(db, role));
      expect((await GET(request())).status).toBe(403);
      expect(db.from).not.toHaveBeenCalled();
    },
  );
  it("neutralizza formule CSV anche dopo spazi e conserva escape delle virgolette", async () => {
    const risky = ["=1+1", "  +CMD", "\t=1+1", "\n=CMD", "@SUM(A1)", "-1+1"];
    const db = database(
      risky.map((v, i) => ({
        id: String(i),
        first_name: v,
        last_name: 'Nome "test"',
      })),
    );
    getUserContext.mockResolvedValue(context(db));
    const response = await GET(request());
    const csv = await response.text();
    for (const value of risky) expect(csv).toContain("\"'" + value + '"');
    expect(csv).toContain('"Nome ""test"""');
  });
  it("nega la consegna del CSV amministrativo se l’audit fallisce", async () => {
    const db = database([{ id: "e1" }]);
    db.rpc.mockResolvedValue({
      error: { message: "audit unavailable" },
    } as unknown as { error: null });
    getUserContext.mockResolvedValue(context(db, "hr"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });
  it("nega export anonimi", async () => {
    getUserContext.mockResolvedValue({
      supabase: null,
      user: null,
      profile: null,
    });
    expect((await GET(request())).status).toBe(401);
  });
});
