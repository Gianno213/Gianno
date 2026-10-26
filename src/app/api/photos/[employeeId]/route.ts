import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/auth";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const { supabase, user, profile } = await getUserContext();
  if (!supabase || !user || !profile?.active)
    return new NextResponse(null, { status: 401 });
  if (profile.role !== "responsabile") {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2")
      return new NextResponse(null, { status: 403 });
  }
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).employeeId);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { data, error } = await supabase
    .from("employees")
    .select("photo_path")
    .eq("id", parsed.data)
    .single();
  if (error || !data?.photo_path)
    return new NextResponse(null, { status: 404 });
  const { data: photo, error: signError } = await supabase.storage
    .from("employee-photos")
    .createSignedUrl(data.photo_path, 60);
  if (signError || !photo) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(photo.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
