/** Real GoTrue ConfirmationURL without SMTP. Local synthetic users only; never print links/tokens. */
import { readFile } from "node:fs/promises";
import { randomBytes, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
const status = JSON.parse(
  await readFile(
    process.env.GIANNO_LOCAL_STATUS || "/tmp/gianno-supabase-status.json",
    "utf8",
  ),
);
const app = process.env.GIANNO_RECOVERY_APP || "http://127.0.0.1:3000";
for (const target of [status.API_URL, app])
  if (!["127.0.0.1", "localhost"].includes(new URL(target).hostname))
    throw new Error("Local test endpoints required.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const anon = () => createClient(status.API_URL, status.ANON_KEY, options);
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
let phase = "initialization",
  browser,
  userId;
try {
  phase = "create synthetic account";
  const email = "recovery-" + randomBytes(8).toString("hex") + "@example.test";
  const original = randomBytes(20).toString("base64url") + "aA1!";
  const created = await admin.auth.admin.createUser({
    email,
    password: original,
    email_confirm: true,
  });
  assert.ok(!created.error && created.data.user);
  userId = created.data.user.id;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  async function link(redirect) {
    const r = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect },
    });
    assert.ok(!r.error && r.data.properties);
    const properties = r.data.properties;
    // The bare GoTrue container emits /verify; expose it through the local Kong Auth prefix.
    // The email token, redirect, and real verification endpoint remain unchanged.
    const action = new URL(properties.action_link);
    if (action.pathname === "/verify") {
      action.pathname = "/auth/v1/verify";
      action.host = new URL(status.API_URL).host;
    }
    return { ...properties, action_link: action.toString() };
  }
  async function complete(url, password, mfa) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page
      .getByRole("heading", { name: "Imposta la password", exact: true })
      .waitFor();
    assert.ok(
      new URL(page.url()).pathname === "/auth/password" &&
        !new URL(page.url()).hash &&
        !new URL(page.url()).searchParams.has("token_hash"),
    );
    if (mfa) {
      await page
        .getByRole("link", { name: "Verifica MFA e continua" })
        .waitFor();
      assert.ok((await page.locator("input[name=password]").count()) === 0);
      await page.getByRole("link", { name: "Verifica MFA e continua" }).click();
      await page
        .getByRole("button", { name: "Configura o verifica MFA" })
        .click();
      await page.locator("input[name=code]").waitFor();
      if (Math.floor(Date.now() / 30000) <= mfa.step)
        await page.waitForTimeout((mfa.step + 1) * 30000 - Date.now() + 500);
      await page.locator("input[name=code]").fill(totp(mfa.secret));
      await page.getByRole("button", { name: "Verifica e accedi" }).click();
      await page.waitForURL((u) => u.pathname === "/auth/password");
    }
    await page.locator("input[name=password]").fill(password);
    await page.locator("input[name=confirm_password]").fill(password);
    await page
      .getByRole("button", { name: "Salva password", exact: true })
      .click();
    await page.waitForURL(
      (u) => u.pathname === "/login" && u.searchParams.has("success"),
    );
    assert.ok(
      !(await context.cookies()).some((c) =>
        /sb-.*-auth-token(?:\.\d+)?$/.test(c.name),
      ),
    );
    const loggedIn = anon();
    const login = await loggedIn.auth.signInWithPassword({ email, password });
    assert.ok(!login.error && login.data.user?.id === userId);
    await context.close();
    return loggedIn;
  }
  phase = "standard ConfirmationURL with recovery fragment";
  const standard = await link(app + "/auth/callback?next=/auth/password");
  const first = randomBytes(20).toString("base64url") + "aA1!";
  await complete(standard.action_link, first);
  assert.ok(
    (await anon().auth.signInWithPassword({ email, password: original })).error,
  );
  console.log(
    "PASS: genuine ConfirmationURL, browser cookie session, password update, sign-out and new login.",
  );
  phase = "single use link";
  const usedContext = await browser.newContext();
  const usedPage = await usedContext.newPage();
  await usedPage.goto(standard.action_link);
  await usedPage
    .getByRole("heading", { name: "Collegamento non utilizzabile" })
    .waitFor();
  assert.ok(!new URL(usedPage.url()).hash);
  await usedContext.close();
  console.log(
    "PASS: consumed link fails closed and sensitive fragment is removed.",
  );
  phase = "existing token_hash support";
  const hashed = await link(app + "/auth/callback");
  await complete(
    app +
      "/auth/callback?token_hash=" +
      encodeURIComponent(hashed.hashed_token) +
      "&type=recovery",
    randomBytes(20).toString("base64url") + "aA1!",
  );
  console.log("PASS: token_hash recovery remains functional.");
  phase = "Site URL root fallback";
  const fallback = await link(app + "/");
  const account = await complete(
    fallback.action_link,
    randomBytes(20).toString("base64url") + "aA1!",
  );
  console.log(
    "PASS: standard link landing at Site URL root reaches password form.",
  );
  phase = "existing TOTP protection during recovery";
  const enrolled = await account.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Synthetic recovery factor",
  });
  assert.ok(!enrolled.error && enrolled.data);
  const secret = enrolled.data.totp.secret;
  const step = Math.floor(Date.now() / 30000);
  const verified = await account.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(secret),
  });
  assert.ok(!verified.error);
  const mfaLink = await link(app + "/auth/callback?next=/auth/password");
  const recovered = await complete(
    mfaLink.action_link,
    randomBytes(20).toString("base64url") + "aA1!",
    { secret, step },
  );
  const factors = await recovered.auth.mfa.listFactors();
  assert.ok(
    !factors.error &&
      factors.data.totp.some(
        (f) => f.id === enrolled.data.id && f.status === "verified",
      ),
  );
  console.log(
    "PASS: existing TOTP required before password update; factor retained after recovery.",
  );
} catch {
  console.error(
    "FAIL: local password recovery verification at phase " +
      phase +
      ". Credentials and URLs withheld.",
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
