import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditSignIn } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=invalid_link`);
  }

  const admin = getSupabaseAdmin();

  // Look up the magic link
  const { data: link } = await admin
    .from("magic_links")
    .select("*")
    .eq("token", token)
    .single();

  if (!link) {
    return NextResponse.redirect(`${origin}/?error=invalid_link`);
  }

  if (link.consumed_at) {
    return NextResponse.redirect(`${origin}/?error=link_used`);
  }

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/?error=link_expired`);
  }

  // Get the user's email
  const { data: { user: targetUser }, error: userError } = await admin.auth.admin.getUserById(link.user_id);
  if (userError || !targetUser?.email) {
    return NextResponse.redirect(`${origin}/?error=user_not_found`);
  }

  // Generate a Supabase magic link to create a session
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    console.error("Failed to generate magic link:", linkError);
    return NextResponse.redirect(`${origin}/?error=session_failed`);
  }

  // Create session via cookie
  const cookieStore = await cookies();
  const userClient = createServerClient(
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

  const { error: verifyError } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    console.error("Failed to create session:", verifyError);
    return NextResponse.redirect(`${origin}/?error=session_failed`);
  }

  // Mark link as consumed
  await admin
    .from("magic_links")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", link.id);

  // Audit
  auditSignIn({
    userId: targetUser.id,
    email: targetUser.email,
    method: "magic_link",
  });

  // Redirect to the original destination
  const redirectUrl = link.redirect_to.startsWith("/")
    ? `${origin}${link.redirect_to}`
    : link.redirect_to;
  return NextResponse.redirect(redirectUrl);
}
