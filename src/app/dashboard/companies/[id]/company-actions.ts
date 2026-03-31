"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { audit, auditInvitationCreated, auditProfileUpdated } from "@/lib/audit";

export async function reactivateCompany(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can reactivate companies" };
  }

  const companyId = formData.get("companyId") as string;
  const legalName = formData.get("legalName") as string;
  const genesisEmail = formData.get("genesisEmail") as string;
  const companyEmail = formData.get("companyEmail") as string;

  if (!companyId || !genesisEmail) {
    return { error: "Company ID and genesis admin email are required" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  // 1. Update company details (activation happens when genesis admin accepts invite)
  const companyUpdates: Record<string, string | null> = {};
  if (legalName) companyUpdates.legal_name = legalName;
  if (companyEmail) companyUpdates.company_email = companyEmail;
  companyUpdates.status = "active" as any;
  companyUpdates.deactivated_at = null;

  if (Object.keys(companyUpdates).length > 0) {
    await admin.from("companies").update(companyUpdates).eq("id", companyId);
  }

  // 2. Send genesis admin invitation (Peppol activation triggered on accept)
  try {
    const result = await createInvitation(admin, {
      email: genesisEmail,
      roles: ["company_admin"],
      companyIds: [companyId],
      isGenesis: true,
      invitedBy: user.id,
    });

    if (result && !result.alreadyExists) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk";

      await sendInvitationEmail({
        to: genesisEmail,
        inviteUrl: getInviteUrl(result.token, baseUrl),
        roles: ["company_admin"],
        companyNames: [legalName || company.legal_name || company.dic],
      });

      auditInvitationCreated({
        actorId: user.id,
        actorEmail: user.email,
        inviteeEmail: genesisEmail,
        roles: ["company_admin"],
        companyId,
        companyDic: company.dic,
        isGenesis: true,
      });
    }
  } catch (err) {
    // Company is already activated, invitation failure is non-fatal
    console.error("Failed to send genesis invitation:", err);
  }

  audit({
    eventId: "COMPANY_REACTIVATED",
    eventName: "Company reactivated by super admin",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId,
    companyDic: company.dic,
    details: {
      genesisEmail,
      legalName: legalName || company.legal_name,
    },
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${companyId}`);
  return { success: true };
}

export async function updateCompanyDetails(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();
  const companyId = formData.get("companyId") as string;

  if (!companyId) return { error: "Company ID is required" };

  // Check permission: super admin or company admin
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("role", "company_admin")
      .eq("status", "active")
      .single();

    if (!membership) {
      return { error: "Only company admins can edit company details" };
    }
  }

  const updates: Record<string, any> = {};
  const legalName = formData.get("legalName") as string;
  const companyEmail = formData.get("companyEmail") as string;
  const companyPhone = formData.get("companyPhone") as string;
  const slaTriageHours = formData.get("slaTriageHours") as string;
  const slaProcessHours = formData.get("slaProcessHours") as string;

  if (legalName !== undefined) updates.legal_name = legalName || null;
  if (companyEmail !== undefined) updates.company_email = companyEmail || null;
  if (companyPhone !== undefined) updates.company_phone = companyPhone || null;
  if (slaTriageHours) updates.sla_triage_hours = parseInt(slaTriageHours, 10) || 8;
  if (slaProcessHours) updates.sla_process_hours = parseInt(slaProcessHours, 10) || 24;

  if (Object.keys(updates).length === 0) {
    return { error: "No changes" };
  }

  await admin.from("companies").update(updates).eq("id", companyId);

  audit({
    eventId: "COMPANY_UPDATED",
    eventName: "Company details updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId,
    details: updates,
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${companyId}`);
  return { success: true };
}

export async function updateMemberRole(membershipId: string, role: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!role) return { error: "A role is required" };

  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from("company_memberships")
    .select("user_id, company_id, role, is_genesis")
    .eq("id", membershipId)
    .single();

  if (!membership) return { error: "Membership not found" };

  // Check permissions
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const isSuperAdmin = profile?.is_super_admin ?? false;

  if (!isSuperAdmin) {
    const { data: myMembership } = await admin
      .from("company_memberships")
      .select("role, is_genesis")
      .eq("user_id", user.id)
      .eq("company_id", membership.company_id)
      .eq("status", "active")
      .single();

    if (!myMembership) return { error: "You don't have access to this company" };

    if (myMembership.role !== "company_admin" && myMembership.role !== "operator") {
      return { error: "You don't have permission to edit roles" };
    }

    if (role === "company_admin" && !myMembership.is_genesis) {
      return { error: "Only genesis admin or super admin can assign the Company Admin role" };
    }
  }

  await admin
    .from("company_memberships")
    .update({ role })
    .eq("id", membershipId);

  audit({
    eventId: "MEMBER_ROLE_UPDATED",
    eventName: "Member role updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: membership.company_id,
    details: {
      membershipId,
      userId: membership.user_id,
      oldRole: membership.role,
      newRole: role,
    },
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${membership.company_id}`);
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function updateCompanyPricing(companyId: string, pricePerDocument: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can set pricing" };
  }

  if (pricePerDocument < 0) return { error: "Price cannot be negative" };

  await admin
    .from("companies")
    .update({ price_per_document: pricePerDocument })
    .eq("id", companyId);

  audit({
    eventId: "COMPANY_PRICING_UPDATED",
    eventName: "Company pricing updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId,
    details: { pricePerDocument },
  });

  revalidatePath(`/dashboard/companies/${companyId}`);
  return { success: true };
}
