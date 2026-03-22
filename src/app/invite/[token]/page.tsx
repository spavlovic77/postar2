import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { InviteAcceptForm } from "./invite-accept-form";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch invitation details
  const { data: invitation } = await supabase
    .from("invitations")
    .select("email, roles, company_ids, is_genesis, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (!invitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Invalid Invitation</h1>
        <p className="text-muted-foreground">This invitation link is not valid.</p>
      </div>
    );
  }

  if (invitation.accepted_at) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Already Accepted</h1>
        <p className="text-muted-foreground">This invitation has already been used.</p>
      </div>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Invitation Expired</h1>
        <p className="text-muted-foreground">
          This invitation expired. Please ask for a new one.
        </p>
      </div>
    );
  }

  // Check if user is signed in
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  // Fetch company names for display
  let companyNames: string[] = [];
  if (invitation.company_ids?.length) {
    const { data: companies } = await supabase
      .from("companies")
      .select("legal_name, dic")
      .in("id", invitation.company_ids);

    companyNames = (companies ?? []).map(
      (c) => c.legal_name ?? c.dic
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    company_admin: "Company Admin",
    operator: "Operator",
    processor: "Processor",
  };
  const roleLabel = (invitation.roles ?? [])
    .map((r: string) => ROLE_LABELS[r] ?? r)
    .join(", ");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">You&apos;re Invited</h1>
          <p className="text-muted-foreground">
            You&apos;ve been invited as <strong>{roleLabel}</strong>
            {companyNames.length > 0 && (
              <>
                {" "}for{" "}
                <strong>{companyNames.join(", ")}</strong>
              </>
            )}
          </p>
        </div>
        <InviteAcceptForm
          token={token}
          isSignedIn={!!user}
          emailMatch={user?.email === invitation.email}
          inviteEmail={invitation.email}
        />
      </div>
    </div>
  );
}
