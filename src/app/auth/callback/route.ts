import { NextResponse } from "next/server";
import { createClient, isConfigured } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isConfigured())
    return NextResponse.redirect(new URL("/login", url.origin));
  const destination = new URL(
    url.searchParams.get("next") === "/auth/password"
      ? "/auth/password"
      : "/dashboard",
    url.origin,
  );
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(destination);
  }
  const token = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (token && (type === "invite" || type === "recovery" || type === "email")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });
    if (!error)
      return NextResponse.redirect(
        type === "invite" || type === "recovery"
          ? new URL("/auth/password", url.origin)
          : destination,
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=Collegamento%20non%20valido%20o%20scaduto.",
      url.origin,
    ),
  );
}
