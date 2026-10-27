import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  createClient: vi.fn(),
  reset: vi.fn(),
  getUser: vi.fn(),
  assurance: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.createClient }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { requestPasswordReset, updatePassword } from "@/app/actions";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gianno-people-demo.onrender.com");
  vi.stubEnv("RENDER_EXTERNAL_URL", "");
  mock.createClient.mockResolvedValue({
    auth: {
      resetPasswordForEmail: mock.reset,
      getUser: mock.getUser,
      mfa: { getAuthenticatorAssuranceLevel: mock.assurance },
      updateUser: mock.updateUser,
      signOut: mock.signOut,
    },
  });
  mock.reset.mockResolvedValue({ error: null });
  mock.getUser.mockResolvedValue({
    data: { user: { id: "synthetic-user" } },
    error: null,
  });
  mock.assurance.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  mock.updateUser.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
const form = () => {
  const f = new FormData();
  f.set("password", "Synthetic-safe-password-123");
  f.set("confirm_password", "Synthetic-safe-password-123");
  return f;
};
describe("Richiesta e completamento sicuri del recupero", () => {
  it("usa redirect dello stesso sito adatto a ConfirmationURL, non richiede token_hash", async () => {
    const f = new FormData();
    f.set("email", "demo@example.test");
    await expect(requestPasswordReset(f)).rejects.toThrow("/login?success=");
    expect(mock.reset).toHaveBeenCalledWith("demo@example.test", {
      redirectTo:
        "https://gianno-people-demo.onrender.com/auth/callback?next=/auth/password",
    });
  });
  it("non rivela se un account esiste o errori di invio del provider", async () => {
    mock.reset.mockResolvedValue({
      error: { message: "synthetic-sensitive-provider-error" },
    });
    const f = new FormData();
    f.set("email", "demo@example.test");
    await expect(requestPasswordReset(f)).rejects.toThrow("/login?success=");
  });
  it("usa anche l’origine HTTPS fornita da Render se Site URL manca", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv(
      "RENDER_EXTERNAL_URL",
      "https://gianno-people-demo.onrender.com",
    );
    const f = new FormData();
    f.set("email", "demo@example.test");
    await expect(requestPasswordReset(f)).rejects.toThrow("/login?success=");
    expect(mock.reset).toHaveBeenCalledWith("demo@example.test", {
      redirectTo: expect.stringContaining(
        "https://gianno-people-demo.onrender.com/auth/callback",
      ),
    });
  });
  it("rifiuta configurazioni di origine non sicure", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://external.example");
    const f = new FormData();
    f.set("email", "demo@example.test");
    await expect(requestPasswordReset(f)).rejects.toThrow("/login?error=");
    expect(mock.reset).not.toHaveBeenCalled();
  });
  it("rifiuta modifiche senza utente verificato", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    await expect(updatePassword(form())).rejects.toThrow("/login");
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it("un POST diretto non aggira il fattore MFA già registrato", async () => {
    mock.assurance.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    await expect(updatePassword(form())).rejects.toThrow(
      "/auth/mfa?next=/auth/password",
    );
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it("con MFA verificata modifica e termina la sessione prima del nuovo accesso", async () => {
    mock.assurance.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    await expect(updatePassword(form())).rejects.toThrow("/login?success=");
    expect(mock.updateUser).toHaveBeenCalledWith({
      password: "Synthetic-safe-password-123",
    });
    expect(mock.signOut).toHaveBeenCalledOnce();
  });
  it("mantiene il controllo di sicurezza del provider e non annuncia successo se rifiuta", async () => {
    mock.updateUser.mockResolvedValue({
      error: { message: "reauthentication required" },
    });
    await expect(updatePassword(form())).rejects.toThrow(
      "/auth/password?error=",
    );
    expect(mock.signOut).not.toHaveBeenCalled();
  });
});
