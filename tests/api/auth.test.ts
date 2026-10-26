import { beforeEach, describe, expect, it, vi } from "vitest";
const { createClient, isConfigured, redirect } = vi.hoisted(() => ({
  createClient: vi.fn(),
  isConfigured: vi.fn(() => true),
  redirect: vi.fn((path: string) => {
    throw new Error("redirect:" + path);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, isConfigured }));
vi.mock("next/navigation", () => ({ redirect }));
import { requireAuth } from "../../src/lib/auth";
function database(role = "responsabile", active = true, aal = "aal1") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel: aal } }),
      },
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: "u1",
              company_id: "c1",
              full_name: "Demo",
              role,
              active,
            },
          }),
        }),
      }),
    })),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  isConfigured.mockReturnValue(true);
});
describe("Autorizzazione server effettiva", () => {
  it("nega operazioni amministrative al responsabile anche con sessione valida", async () => {
    createClient.mockResolvedValue(database());
    await expect(requireAuth(true)).rejects.toThrow("non autorizzata");
  });
  it("permette al responsabile di usare le operazioni non amministrative", async () => {
    createClient.mockResolvedValue(database());
    await expect(requireAuth()).resolves.toMatchObject({
      profile: { role: "responsabile" },
    });
  });
  it.each(["direzione", "hr"])(
    "richiede MFA prima di operazioni del ruolo %s",
    async (role) => {
      createClient.mockResolvedValue(database(role));
      await expect(requireAuth(true)).rejects.toThrow("redirect:/auth/mfa");
    },
  );
  it("nega un profilo disattivato prima di ogni operazione", async () => {
    createClient.mockResolvedValue(database("responsabile", false));
    await expect(requireAuth()).rejects.toThrow("redirect:/login");
  });
  it("permette HR autenticato con MFA", async () => {
    createClient.mockResolvedValue(database("hr", true, "aal2"));
    await expect(requireAuth(true)).resolves.toMatchObject({
      profile: { role: "hr" },
    });
  });
});
