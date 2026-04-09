import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Create a single-use magic link for a user.
 * The link is valid for 7 days and can only be consumed once.
 * Returns the full URL to use in emails, or null if the user doesn't exist.
 */
export async function createMagicLinkForEmail(
  email: string,
  redirectTo: string,
  baseUrl: string
): Promise<string | null> {
  const admin = getSupabaseAdmin();

  // Find user by email
  const { data: { users } } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const user = users?.find((u) => u.email === email && u.email_confirmed_at);

  if (!user) {
    return null;
  }

  const { data, error } = await admin
    .from("magic_links")
    .insert({
      user_id: user.id,
      redirect_to: redirectTo,
    })
    .select("token")
    .single();

  if (error || !data) {
    console.error("Failed to create magic link:", error);
    return null;
  }

  return `${baseUrl}/api/auth/magic?token=${data.token}`;
}
