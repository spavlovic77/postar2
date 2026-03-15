import type { SupabaseClient } from "@supabase/supabase-js";

interface CreateInvitationParams {
  email: string;
  role: "super_admin" | "company_admin" | "accountant";
  companyIds: string[];
  isGenesis?: boolean;
  invitedBy?: string | null;
}

/**
 * Creates an invitation and returns the token.
 * Returns null if an active genesis membership already exists for this email
 * on all the requested companies.
 */
export async function createInvitation(
  supabase: SupabaseClient,
  params: CreateInvitationParams
): Promise<{ token: string; alreadyExists: boolean } | null> {
  const { email, role, companyIds, isGenesis = false, invitedBy = null } = params;

  // If genesis invite, check if email already has active genesis membership on all companies
  if (isGenesis && companyIds.length > 0) {
    // Look up user by email in auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingUser = authUsers?.users?.find((u) => u.email === email);

    if (existingUser) {
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", existingUser.id)
        .eq("is_genesis", true)
        .eq("status", "active")
        .in("company_id", companyIds);

      // If already genesis on all requested companies, skip
      if (memberships && memberships.length === companyIds.length) {
        return { token: "", alreadyExists: true };
      }
    }
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email,
      role,
      company_ids: companyIds,
      is_genesis: isGenesis,
      invited_by: invitedBy,
    })
    .select("token")
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return { token: data.token, alreadyExists: false };
}

export function getInviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/invite/${token}`;
}
