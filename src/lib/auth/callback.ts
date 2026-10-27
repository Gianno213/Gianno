import type { SupabaseClient } from "@supabase/supabase-js";

export const INVALID_AUTH_LINK =
  "Collegamento non valido o scaduto. Richiedi una nuova email di recupero e aprila nello stesso browser della richiesta.";
type CallbackOptions = {
  url: string;
  clearUrl: () => void;
  createClient: () => Pick<SupabaseClient, "auth">;
};
/** Consume credentials once, in memory; never include provider errors or tokens in messages/logs. */
export async function completeAuthCallback({
  url,
  clearUrl,
  createClient,
}: CallbackOptions): Promise<string> {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  // Must precede client construction: the SDK's automatic URL detection must not race this handler.
  clearUrl();
  if (
    query.has("error") ||
    fragment.has("error") ||
    query.has("error_code") ||
    fragment.has("error_code")
  )
    throw new Error(INVALID_AUTH_LINK);
  const code = query.get("code");
  const hash = query.get("token_hash");
  const access = fragment.get("access_token");
  const refresh = fragment.get("refresh_token");
  const type = fragment.get("type") || query.get("type");
  const hasImplicit = Boolean(access || refresh);
  if (Number(Boolean(code)) + Number(Boolean(hash)) + Number(hasImplicit) !== 1)
    throw new Error(INVALID_AUTH_LINK);
  if (
    hasImplicit &&
    (!access || !refresh || !["recovery", "invite"].includes(type || ""))
  )
    throw new Error(INVALID_AUTH_LINK);
  if (hash && !["recovery", "invite", "email"].includes(type || ""))
    throw new Error(INVALID_AUTH_LINK);
  let auth: SupabaseClient["auth"] | undefined;
  let established = false;
  try {
    auth = createClient().auth;
    let result;
    if (hasImplicit)
      result = await auth.setSession({
        access_token: access!,
        refresh_token: refresh!,
      });
    else if (code) result = await auth.exchangeCodeForSession(code);
    else
      result = await auth.verifyOtp({
        token_hash: hash!,
        type: type as "recovery" | "invite" | "email",
      });
    if (result.error || !result.data.session)
      throw new Error(INVALID_AUTH_LINK);
    established = true;
    // A decoded JWT or getSession alone is not proof of a valid, current identity.
    const verified = await auth.getUser();
    if (verified.error || !verified.data.user)
      throw new Error(INVALID_AUTH_LINK);
    return type === "recovery" ||
      type === "invite" ||
      query.get("next") === "/auth/password"
      ? "/auth/password"
      : "/dashboard";
  } catch {
    if (established && auth) {
      try {
        await auth.signOut({ scope: "local" });
      } catch {
        /* Fail closed without exposing provider diagnostics. */
      }
    }
    throw new Error(INVALID_AUTH_LINK);
  }
}

/** Standard ConfirmationURL can fall back to Site URL when redirect configuration is missing. */
export function hasRecoveryFragment(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    (["recovery", "invite"].includes(params.get("type") || "") &&
      (params.has("access_token") || params.has("refresh_token"))) ||
    params.has("error") ||
    params.has("error_code")
  );
}
