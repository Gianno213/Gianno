import { test, expect } from "@playwright/test";

test.skip(
  process.env.GIANNO_AUTH_BROWSER === "1",
  "This suite validates the unconfigured environment separately.",
);

test("configurazione esplicita, navigazione accesso e nessun overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Le persone, al centro." }),
  ).toBeVisible();
  await expect(
    page.getByText("Applica le migrazioni", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Vai all’accesso" }).click();
  await expect(
    page.getByRole("heading", { name: "Bentornato." }),
  ).toBeVisible();
  await expect(
    page.getByText("Supabase non è ancora configurato.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("le aree protette respingono accessi senza sessione", async ({
  page,
  request,
}) => {
  await page.goto("/dipendenti");
  await expect(page).toHaveURL(/\/login/);
  for (const path of [
    "/api/export?type=payroll",
    "/api/reports/00000000-0000-4000-8000-000000000001",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
