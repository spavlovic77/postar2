import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CreateInvitationParams {
  email: string;
  roles: string[];
  companyIds: string[];
  isGenesis?: boolean;
  invitedBy?: string | null;
}

interface InvitationResult {
  token: string;
  alreadyExists: boolean;
}

/**
 * Creates an invitation. Pre-creates the user if they don't exist yet.
 * All invitations use magic-link auto-accept (one click).
 */
export async function createInvitation(
  supabase: SupabaseClient,
  params: CreateInvitationParams
): Promise<InvitationResult | null> {
  const { email, roles, companyIds, isGenesis = false, invitedBy = null } = params;

  // Look up user by email
  const { data: { users } } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingUser = users?.find((u) => u.email === email);

  // If genesis invite, check if already has active genesis membership on all companies
  if (isGenesis && companyIds.length > 0 && existingUser) {
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", existingUser.id)
      .eq("is_genesis", true)
      .eq("status", "active")
      .in("company_id", companyIds);

    if (memberships && memberships.length === companyIds.length) {
      return { token: "", alreadyExists: true };
    }
  }

  // Pre-create user if they don't exist
  if (!existingUser) {
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password: randomBytes(32).toString("hex"),
      email_confirm: true,
    });

    if (createError && !createError.message?.includes("already been registered")) {
      throw new Error(`Failed to pre-create user: ${createError.message}`);
    }
  }

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email,
      roles,
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

/**
 * All invitations now use magic-link auto-accept.
 */
export function getInviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/invite/${token}/accept`;
}
