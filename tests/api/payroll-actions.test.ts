import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireAuth, redirect, update } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(url);
  }),
  update: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  confirmPayroll,
  saveAttendance,
  saveContract,
  saveAbsence,
  saveTraining,
} from "../../src/app/actions";
function context() {
  return {
    supabase: { from: vi.fn(() => ({ update, insert: update })) },
    profile: { role: "hr", active: true },
    user: { id: "11111111-1111-4111-8111-111111111111" },
  };
}
function payrollForm(net?: string) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    id: "11111111-1111-4111-8111-111111111111",
    year: "2026",
    month: "3",
    kind: "ordinaria",
    confirmed: "on",
  }))
    f.set(k, v);
  if (net !== undefined) f.set("net_amount", net);
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(context());
  update.mockReturnValue({
    eq: () => ({ select: () => ({ single: async () => ({ error: null }) }) }),
  });
});
describe("Validazione operativa dati numerici", () => {
  it.each([undefined, "", "   "])(
    "rifiuta netto mancante/vuoto %s senza aggiornare dati",
    async (amount) => {
      await expect(confirmPayroll(payrollForm(amount))).rejects.toThrow(
        "error=",
      );
      expect(update).not.toHaveBeenCalled();
      expect(requireAuth).toHaveBeenCalledWith(true);
    },
  );
  it("accetta un netto zero dichiarato esplicitamente", async () => {
    await expect(confirmPayroll(payrollForm("0"))).rejects.toThrow("success=");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ net_amount: 0, status: "verificata" }),
    );
  });
  it("richiede comunque la conferma manuale anche con netto valido", async () => {
    const f = payrollForm("1500");
    f.delete("confirmed");
    await expect(confirmPayroll(f)).rejects.toThrow("error=");
    expect(update).not.toHaveBeenCalled();
  });
  it.each([saveAttendance, saveAbsence, saveTraining, saveContract])(
    "non interpreta ore vuote come zero",
    async (action) => {
      const f = new FormData();
      for (const [k, v] of Object.entries({
        employee_id: "11111111-1111-4111-8111-111111111111",
        work_date: "2026-03-01",
        starts_on: "2026-03-01",
        ends_on: "2026-03-02",
        kind: "ferie",
        title: "Formazione sala",
        contract_type: "Indeterminato",
        hours: "",
        weekly_hours: "",
      }))
        f.set(k, v);
      await expect(action(f)).rejects.toThrow("error=");
      expect(update).not.toHaveBeenCalled();
    },
  );
});
