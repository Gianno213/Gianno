import { beforeEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeAuthCallback,
  hasRecoveryFragment,
  INVALID_AUTH_LINK,
} from "@/lib/auth/callback";
const session = {
  access_token: "synthetic-access",
  refresh_token: "synthetic-refresh",
};
let auth: Record<string, ReturnType<typeof vi.fn>>;
let clearUrl = vi.fn<() => void>();
let factory = vi.fn<() => SupabaseClient>();
beforeEach(() => {
  auth = {
    setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    exchangeCodeForSession: vi
      .fn()
      .mockResolvedValue({ data: { session }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "synthetic-user" } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  clearUrl = vi.fn<() => void>();
  factory = vi.fn(() => ({ auth }) as unknown as SupabaseClient);
});
const complete = (suffix: string) =>
  completeAuthCallback({
    url: "https://gianno-people-demo.onrender.com/auth/callback" + suffix,
    clearUrl,
    createClient: factory,
  });
describe("Callback standard ConfirmationURL e percorsi esistenti", () => {
  it("acquisisce token del frammento prima di navigare, sincronizza cookie tramite il client SSR e verifica utente", async () => {
    expect(
      await complete(
        "#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery",
      ),
    ).toBe("/auth/password");
    expect(clearUrl).toHaveBeenCalledOnce();
    expect(clearUrl.mock.invocationCallOrder[0]).toBeLessThan(
      factory.mock.invocationCallOrder[0],
    );
    expect(auth.setSession).toHaveBeenCalledWith(session);
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
  it("mantiene PKCE con verifier gestito dal SDK", async () => {
    expect(await complete("?code=synthetic-code&next=/auth/password")).toBe(
      "/auth/password",
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("synthetic-code");
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it.each(["recovery", "invite"])("mantiene token_hash %s", async (type) => {
    expect(await complete("?token_hash=synthetic-hash&type=" + type)).toBe(
      "/auth/password",
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "synthetic-hash",
      type,
    });
  });
  it("mantiene conferma email e ignora destinazioni esterne", async () => {
    expect(
      await complete(
        "?token_hash=synthetic-hash&type=email&next=https://evil.example",
      ),
    ).toBe("/dashboard");
  });
  it.each([
    "?next=//evil.example",
    "?next=/auth/password",
    "?code=a&token_hash=b&type=recovery",
    "#access_token=a&type=recovery",
    "#refresh_token=b&type=recovery",
    "#access_token=a&refresh_token=b&type=signup",
    "?token_hash=a&type=unsupported",
  ])(
    "rifiuta credenziali mancanti, miste o tipo non ammesso %s",
    async (suffix) => {
      await expect(complete(suffix)).rejects.toThrow(INVALID_AUTH_LINK);
      expect(factory).not.toHaveBeenCalled();
      expect(clearUrl).toHaveBeenCalledOnce();
    },
  );
  it("non trasforma una sessione precedente in prova di recupero", async () => {
    await expect(complete("")).rejects.toThrow(INVALID_AUTH_LINK);
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("PKCE senza verifier o link riutilizzato fallisce senza degradare ad implicit", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: new Error("synthetic-secret-error"),
    });
    await expect(complete("?code=used&next=/auth/password")).rejects.toThrow(
      INVALID_AUTH_LINK,
    );
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it("rifiuta token non validi e non espone dettagli del provider", async () => {
    auth.setSession.mockResolvedValue({
      data: { session: null },
      error: new Error("synthetic-sensitive-message"),
    });
    await expect(
      complete("#access_token=invalid&refresh_token=invalid&type=recovery"),
    ).rejects.toThrow(INVALID_AUTH_LINK);
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("cancella localmente una nuova sessione se getUser non la verifica", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("synthetic-sensitive-message"),
    });
    await expect(
      complete("#access_token=a&refresh_token=b&type=recovery"),
    ).rejects.toThrow(INVALID_AUTH_LINK);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("gestisce errori scaduto/access_denied senza riflettere descrizioni", async () => {
    await expect(
      complete(
        "#error=access_denied&error_description=synthetic-sensitive-message",
      ),
    ).rejects.toThrow(INVALID_AUTH_LINK);
    expect(factory).not.toHaveBeenCalled();
  });
  it("non stampa token o diagnostica del provider", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      factory.mockImplementation(() => {
        throw new Error("synthetic-sensitive-diagnostic");
      });
      await expect(complete("?code=synthetic-sensitive-code")).rejects.toThrow(
        INVALID_AUTH_LINK,
      );
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
      warn.mockRestore();
    }
  });
  it("riconosce il frammento arrivato al Site URL e non cattura navigazioni normali", () => {
    expect(
      hasRecoveryFragment("#type=recovery&access_token=a&refresh_token=b"),
    ).toBe(true);
    expect(hasRecoveryFragment("#error=access_denied")).toBe(true);
    expect(hasRecoveryFragment("#nuova")).toBe(false);
    expect(hasRecoveryFragment("#type=signup&access_token=a")).toBe(false);
  });
});
