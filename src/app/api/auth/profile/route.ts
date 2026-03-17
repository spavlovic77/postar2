import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  await admin.rpc("upsert_profile", {
    user_id: user.id,
    user_full_name:
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    user_avatar_url: user.user_metadata?.avatar_url ?? null,
  });

  return NextResponse.json({ ok: true });
}
