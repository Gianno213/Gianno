import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user, profile } = await getUserContext();
  if (!supabase || !user)
    return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
  if (!profile?.active || profile.role === "responsabile")
    return NextResponse.json(
      { error: "Accesso non autorizzato." },
      { status: 403 },
    );
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Documento non valido." },
      { status: 400 },
    );
  const { data: path, error } = await supabase.rpc("record_sensitive_access", {
    document: parsed.data,
  });
  if (error || !path)
    return NextResponse.json(
      { error: "Documento non disponibile o non autorizzato." },
      { status: 403 },
    );
  const { data, error: signError } = await supabase.storage
    .from("personnel")
    .createSignedUrl(path, 60, { download: true });
  if (signError || !data)
    return NextResponse.json(
      { error: "File non disponibile." },
      { status: 404 },
    );
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
