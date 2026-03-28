import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditSignIn } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // Prevent open redirect — only allow relative paths
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Upsert profile after successful login
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = getSupabaseAdmin();
        await admin.rpc("upsert_profile", {
          user_id: user.id,
          user_full_name:
            user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
          user_avatar_url: user.user_metadata?.avatar_url ?? null,
          user_phone: null,
        });

        const provider = user.app_metadata?.provider as string;
        auditSignIn({
          userId: user.id,
          email: user.email ?? "",
          method: provider === "apple" ? "apple" : "google",
          request,
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
