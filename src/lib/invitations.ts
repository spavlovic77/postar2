import type { SupabaseClient } from "@supabase/supabase-js";

interface CreateInvitationParams {
  email: string;
  role: "super_admin" | "company_admin" | "accountant";
  companyIds: string[];
  isGenesis?: boolean;
  invitedBy?: string | null;
}

interface InvitationResult {
  token: string;
  alreadyExists: boolean;
  isExistingUser: boolean;
}

/**
 * Creates an invitation and returns the token.
 * Also checks if the user already exists (confirmed) to determine
 * whether to send a magic link or a sign-up invite.
 */
export async function createInvitation(
  supabase: SupabaseClient,
  params: CreateInvitationParams
): Promise<InvitationResult | null> {
  const { email, role, companyIds, isGenesis = false, invitedBy = null } = params;

  // Look up user by email
  const { data: { users } } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingUser = users?.find((u) => u.email === email);
  const isExistingUser = !!existingUser?.email_confirmed_at;

  // If genesis invite, check if email already has active genesis membership on all companies
  if (isGenesis && companyIds.length > 0 && existingUser) {
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", existingUser.id)
      .eq("is_genesis", true)
      .eq("status", "active")
      .in("company_id", companyIds);

    if (memberships && memberships.length === companyIds.length) {
      return { token: "", alreadyExists: true, isExistingUser };
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

  return { token: data.token, alreadyExists: false, isExistingUser };
}

/**
 * For existing users: magic link that auto-accepts the invitation.
 * For new users: link to the invite page where they sign up first.
 */
export function getInviteUrl(
  token: string,
  baseUrl: string,
  isExistingUser: boolean
): string {
  if (isExistingUser) {
    return `${baseUrl}/invite/${token}/accept`;
  }
  return `${baseUrl}/invite/${token}`;
}
