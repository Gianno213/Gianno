import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

test.skip(
  process.env.GIANNO_AUTH_BROWSER !== "1",
  "Requires explicitly started local Supabase integration fixture.",
);
test.setTimeout(90000);
const accountFile = "/tmp/gianno-local-accounts.json";
type Account = {
  role: string;
  email: string;
  password: string;
  totpSecret?: string;
  totpVerifiedStep?: number;
};
async function fixture() {
  return JSON.parse(await readFile(accountFile, "utf8")) as {
    accounts: Account[];
    employees: { id: string; first_name: string; last_name: string }[];
  };
}
function otp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const off = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(off) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function login(page: Page, role: string) {
  const data = await fixture();
  const account = data.accounts.find((a) => a.role === role)!;
  await page.goto("/login");
  await page
    .locator("form")
    .filter({ has: page.locator("input[name=password]") })
    .locator("input[name=email]")
    .fill(account.email);
  await page.locator("input[name=password]").fill(account.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  if (role !== "responsabile") {
    await expect(page).toHaveURL(/\/auth\/mfa/);
    await page
      .getByRole("button", { name: "Configura o verifica MFA" })
      .click();
    await expect(page.locator("input[name=code]")).toBeVisible();
    const current = Math.floor(Date.now() / 30000);
    if (account.totpVerifiedStep && current <= account.totpVerifiedStep)
      await page.waitForTimeout(
        (account.totpVerifiedStep + 1) * 30000 - Date.now() + 500,
      );
    const step = Math.floor(Date.now() / 30000);
    await page.locator("input[name=code]").fill(otp(account.totpSecret!));
    await page.getByRole("button", { name: "Verifica e accedi" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    account.totpVerifiedStep = step;
    await writeFile(accountFile, JSON.stringify(data), { mode: 0o600 });
  } else await expect(page).toHaveURL(/\/dashboard/);
  return data;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("responsabile: sede assegnata, diario persistente e paghe negate", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = await login(page, "responsabile");
  await expect(
    page.getByRole("link", { name: "Retribuzioni", exact: true }),
  ).toHaveCount(0);
  await noOverflow(page);
  await page.goto("/dipendenti");
  await expect(page.getByText("Elena Rossi", { exact: true })).toBeVisible();
  await expect(page.getByText("Giulia Verdi", { exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.goto("/retribuzioni");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Retribuzioni", exact: true }),
  ).toHaveCount(0);
  const salaryExport = await page.request.get("/api/export?type=payroll");
  expect(salaryExport.status()).toBe(403);
  await page.goto("/diario");
  const note = `Collaudo browser: episodio lavorativo positivo ${Date.now()}`;
  const form = page.locator("form#nuova");
  await form
    .locator("select[name=employee_id]")
    .selectOption(data.employees[0].id);
  await form.locator("textarea[name=description]").fill(note);
  await form.getByRole("button", { name: "Salva osservazione" }).click();
  await expect(
    page.getByText("Operazione salvata.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(note, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(note, { exact: true }).first()).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("direzione: MFA, retribuzioni riservate e fascicolo PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = await login(page, "direzione");
  await noOverflow(page);
  await page.goto(`/retribuzioni?employee=${data.employees[0].id}`);
  await expect(
    page.getByRole("heading", { name: "Retribuzioni", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Elena Rossi", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
        }).format(1550),
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await noOverflow(page);
  const report = await page.request.get(
    `/api/reports/${data.employees[0].id}?year=2026`,
  );
  expect(report.status()).toBe(200);
  expect(report.headers()["content-type"]).toBe("application/pdf");
  expect((await report.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect(errors).toEqual([]);
});
