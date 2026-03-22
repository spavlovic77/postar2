import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditInvitationAccepted, auditSignIn } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { origin } = new URL(request.url);
  const supabase = getSupabaseAdmin();

  // Fetch invitation
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (!invitation) {
    return NextResponse.redirect(`${origin}/invite/${token}?error=invalid`);
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/invite/${token}?error=expired`);
  }

  // Find the user by email
  const { data: { users } } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const user = users?.find((u) => u.email === invitation.email);

  if (!user || !user.email_confirmed_at) {
    // Not an existing confirmed user — redirect to normal invite page
    return NextResponse.redirect(`${origin}/invite/${token}`);
  }

  // Generate a magic link session for the user
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

  if (linkError || !linkData.properties?.hashed_token) {
    console.error("Failed to generate magic link:", linkError);
    return NextResponse.redirect(`${origin}/invite/${token}?error=session`);
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
    return NextResponse.redirect(`${origin}/invite/${token}?error=session`);
  }

  // Upsert profile FIRST (memberships FK depends on it)
  await supabase.rpc("upsert_profile", {
    user_id: user.id,
    user_full_name:
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    user_avatar_url: user.user_metadata?.avatar_url ?? null,
    user_phone: null,
  });

  // Accept the invitation — create memberships
  if (invitation.roles?.includes("super_admin")) {
    await supabase
      .from("profiles")
      .update({ is_super_admin: true })
      .eq("id", user.id);
  } else {
    const companyIds: string[] = invitation.company_ids ?? [];
    for (const companyId of companyIds) {
      // Check if membership already exists
      const { data: existing } = await supabase
        .from("company_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .single();

      if (existing) {
        // Update existing membership
        const { error: updateError } = await supabase
          .from("company_memberships")
          .update({
            roles: (invitation.roles ?? []).filter((r: string) => r !== "super_admin") as any,
            is_genesis: invitation.is_genesis ?? false,
            status: "active",
            invited_by: invitation.invited_by,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error(`Failed to update membership for company ${companyId}:`, updateError);
        }
      } else {
        // Insert new membership
        const { error: insertError } = await supabase
          .from("company_memberships")
          .insert({
            user_id: user.id,
            company_id: companyId,
            roles: (invitation.roles ?? []).filter((r: string) => r !== "super_admin") as any,
            is_genesis: invitation.is_genesis ?? false,
            status: "active",
            invited_by: invitation.invited_by,
          });

        if (insertError) {
          console.error(`Failed to create membership for company ${companyId}:`, insertError);
        }
      }
    }
  }

  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  auditSignIn({
    userId: user.id,
    email: user.email ?? "",
    method: "magic_link",
    request,
  });

  const companyIds: string[] = invitation.company_ids ?? [];
  for (const cid of companyIds) {
    auditInvitationAccepted({
      userId: user.id,
      email: user.email ?? "",
      roles: (invitation.roles ?? []).filter((r: string) => r !== "super_admin") as any,
      companyId: cid,
      request,
    });
  }

  return NextResponse.redirect(`${origin}/`);
}
