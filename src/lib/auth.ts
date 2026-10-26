import { redirect } from "next/navigation";
import { createClient, isConfigured } from "./supabase/server";
export type Profile = {
  id: string;
  company_id: string;
  role: "direzione" | "hr" | "responsabile";
  full_name: string;
  active: boolean;
};
export async function getUserContext() {
  if (!isConfigured())
    return {
      configured: false as const,
      supabase: null,
      user: null,
      profile: null,
    };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { configured: true as const, supabase, user: null, profile: null };
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return {
    configured: true as const,
    supabase,
    user,
    profile: data as Profile | null,
  };
}
export async function requireAuth(privileged = false) {
  const context = await getUserContext();
  if (!context.configured || !context.supabase || !context.user)
    redirect("/login");
  if (!context.profile?.active)
    redirect(
      "/login?error=Account%20non%20abilitato.%20Contatta%20la%20Direzione.",
    );
  if (privileged && context.profile.role === "responsabile")
    throw new Error("Operazione non autorizzata.");
  if (context.profile.role !== "responsabile") {
    const { data, error } =
      await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== "aal2") redirect("/auth/mfa");
  }
  return {
    ...context,
    supabase: context.supabase,
    user: context.user,
    profile: context.profile,
  };
}
