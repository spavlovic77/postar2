import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Get the authenticated user
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch invitation
  const { data: invitation, error: inviteError } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (inviteError || !invitation) {
    return NextResponse.json(
      { error: "Invalid or already used invitation" },
      { status: 400 }
    );
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation expired" }, { status: 400 });
  }

  // Check email matches
  if (user.email !== invitation.email) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // Upsert profile FIRST (memberships FK depends on it)
  await supabase.rpc("upsert_profile", {
    user_id: user.id,
    user_full_name: null,
    user_avatar_url: null,
    user_phone: null,
  });

  // Handle super_admin role
  if (invitation.role === "super_admin") {
    const { error } = await supabase
      .from("profiles")
      .update({ is_super_admin: true })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to set super_admin:", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  } else {
    // Handle company_admin / accountant — create memberships for each company
    const companyIds: string[] = invitation.company_ids ?? [];

    for (const companyId of companyIds) {
      const { error } = await supabase
        .from("company_memberships")
        .upsert(
          {
            user_id: user.id,
            company_id: companyId,
            role: invitation.role,
            is_genesis: invitation.is_genesis ?? false,
            status: "active",
            invited_by: invitation.invited_by,
          },
          { onConflict: "user_id,company_id" }
        );

      if (error) {
        console.error(`Failed to create membership for company ${companyId}:`, error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
    }
  }

  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ message: "Invitation accepted" }, { status: 200 });
}
