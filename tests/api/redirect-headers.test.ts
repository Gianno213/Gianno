import { validateHeaderValue } from "node:http";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  reset: vi.fn(),
  insert: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail: mock.reset } }),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: mock.requireAuth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    // The previous mock only threw the URL; Node must validate the actual header too.
    validateHeaderValue("x-action-redirect", url + ";push");
    throw new Error(url);
  },
}));
import { requestPasswordReset, createLocation } from "@/app/actions";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gianno-people-demo.onrender.com");
  mock.reset.mockResolvedValue({ error: null });
  mock.insert.mockResolvedValue({ error: null });
  mock.requireAuth.mockResolvedValue({
    profile: { role: "direzione", company_id: "synthetic-company" },
    supabase: { from: () => ({ insert: mock.insert }) },
  });
});
afterEach(() => vi.unstubAllEnvs());
async function redirectOf(action: () => Promise<void>) {
  try {
    await action();
    throw new Error("Redirect mancante");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    const url = (error as Error).message;
    expect(url.startsWith("/")).toBe(true);
    expect(url).toMatch(/^[\x21-\x7e]+$/);
    expect(() =>
      validateHeaderValue("x-action-redirect", url + ";push"),
    ).not.toThrow();
    return new URL(url, "https://gianno.invalid");
  }
}
function locationForm(path: string) {
  const f = new FormData();
  f.set("name", "Sede dimostrativa");
  f.set("return_to", path);
  return f;
}
describe("Redirect utilizzabili negli header HTTP delle Server Actions", () => {
  it("riproduce ERR_INVALID_CHAR con un apostrofo tipografico non codificato", () => {
    expect(() =>
      validateHeaderValue(
        "x-action-redirect",
        "/login?success=Se%20l’account%20esiste;push",
      ),
    ).toThrow(expect.objectContaining({ code: "ERR_INVALID_CHAR" }));
  });
  it("codifica il messaggio completo del recupero mantenendo il testo italiano", async () => {
    const f = new FormData();
    f.set("email", "demo@example.test");
    const url = await redirectOf(() => requestPasswordReset(f));
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("success")).toBe(
      "Se l’account esiste, riceverai le istruzioni per il recupero.",
    );
    expect(url.search).toContain("%E2%80%99");
  });
  it("codifica messaggi dinamici di errore con accenti, apostrofi e ritorni a capo", async () => {
    const message = "L’operazione è già registrata.\r\nRiprova più tardi.";
    mock.insert.mockResolvedValue({ error: { message } });
    const url = await redirectOf(() => createLocation(locationForm("/sedi")));
    expect(url.searchParams.get("error")).toBe(message);
  });
  it("normalizza Unicode e spazi nei percorsi di ritorno senza doppia codifica", async () => {
    const url = await redirectOf(() =>
      createLocation(locationForm("/sedi?nome=Caffè d’oggi&gia=%2F")),
    );
    expect(url.searchParams.get("nome")).toBe("Caffè d’oggi");
    expect(url.searchParams.get("gia")).toBe("/");
    expect(url.searchParams.get("success")).toBe("Operazione salvata.");
  });
  it.each([
    "/sedi\r\nInjected: value",
    "/sedi\u0000x",
    "https://outside.example",
    "//outside.example",
    "/\\outside.example",
  ])("usa il percorso previsto se return_to non è valido", async (path) => {
    const url = await redirectOf(() => createLocation(locationForm(path)));
    expect(url.pathname).toBe("/sedi");
    expect(url.origin).toBe("https://gianno.invalid");
  });
});
