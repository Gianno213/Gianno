import { beforeEach, describe, expect, it, vi } from "vitest";
const { createClient, signInWithPassword, updateUser, signOut } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  }),
);
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { signIn, updatePassword } from "../../src/app/actions";
beforeEach(() => {
  vi.clearAllMocks();
  signInWithPassword.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  createClient.mockResolvedValue({
    auth: {
      signInWithPassword,
      updateUser,
      signOut,
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
      },
    },
  });
});
describe("Password preservata esattamente", () => {
  it("non elimina spazi significativi durante accesso", async () => {
    const f = new FormData();
    f.set("email", "demo@example.com");
    f.set("password", "  Password con spazi  ");
    await expect(signIn(f)).rejects.toThrow("/dashboard");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "  Password con spazi  ",
    });
  });
  it("mantiene spazi durante impostazione e conferma nuova password", async () => {
    const f = new FormData();
    f.set("password", "  Password con spazi  ");
    f.set("confirm_password", "  Password con spazi  ");
    await expect(updatePassword(f)).rejects.toThrow("/login?success=");
    expect(updateUser).toHaveBeenCalledWith({
      password: "  Password con spazi  ",
    });
  });
  it("rifiuta conferme diverse solo per spazi", async () => {
    const f = new FormData();
    f.set("password", "  Password con spazi  ");
    f.set("confirm_password", "Password con spazi");
    await expect(updatePassword(f)).rejects.toThrow("/auth/password?error=");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
