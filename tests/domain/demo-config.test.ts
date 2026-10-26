import { describe, it, expect } from "vitest";
import { validateDemoConfiguration } from "../../scripts/prepare-demo.mjs";
const valid = {
  GIANNO_DEMO_CONFIRM: "DEMO",
  DEMO_DATABASE_URL:
    "postgresql://postgres.project:example-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require",
  DEMO_DIRECTION_ID: "00000000-0000-4000-8000-000000000001",
};
describe("preparazione demo da interfaccia GitHub", () => {
  it("richiede conferma esplicita e account Direzione valido", () => {
    expect(() =>
      validateDemoConfiguration({ ...valid, GIANNO_DEMO_CONFIRM: "" }),
    ).toThrow();
    expect(() =>
      validateDemoConfiguration({ ...valid, DEMO_DIRECTION_ID: "bad" }),
    ).toThrow();
  });
  it("rifiuta endpoint esterni arbitrari e pooler transazionali", () => {
    expect(() =>
      validateDemoConfiguration({
        ...valid,
        DEMO_DATABASE_URL: "postgres://a:b@example.com:5432/postgres",
      }),
    ).toThrow();
    expect(() =>
      validateDemoConfiguration({
        ...valid,
        DEMO_DATABASE_URL: valid.DEMO_DATABASE_URL.replace(":5432", ":6543"),
      }),
    ).toThrow();
  });
  it("impone verifica TLS anche se la stringa suggerisce require senza verifica", () => {
    const configuration = validateDemoConfiguration(valid);
    expect(configuration.ssl).toEqual({ rejectUnauthorized: true });
    expect(configuration.connectionString).not.toContain("sslmode");
  });
  it("non permette accesso locale senza modalità di test esplicita", () => {
    const local = {
      ...valid,
      DEMO_DATABASE_URL: "postgres://a:b@127.0.0.1:5432/postgres",
    };
    expect(() => validateDemoConfiguration(local)).toThrow();
    expect(
      validateDemoConfiguration({ ...local, GIANNO_LOCAL_DEMO_TEST: "1" }).ssl,
    ).toBe(false);
  });
  it("non attribuisce due ruoli allo stesso account", () => {
    expect(() =>
      validateDemoConfiguration({
        ...valid,
        DEMO_HR_ID: valid.DEMO_DIRECTION_ID,
      }),
    ).toThrow();
  });
});
