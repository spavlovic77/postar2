"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { getOrCreateWallet, topUpWallet } from "@/lib/billing";
import { sendInvitationEmail } from "@/lib/email";
import {
  auditOnboarded,
  auditInvitationCreated,
  auditMembershipDeactivated,
  auditProfileUpdated,
  auditDepartmentCreated,
  auditDepartmentMemberAdded,
  auditDepartmentMemberRemoved,
} from "@/lib/audit";
import { ensureCompanyActivated, getPeppolIdentifier } from "@/lib/ion-ap";
import { updateOrganization, deleteIdentifier } from "@/lib/ion-ap/client";
import { audit } from "@/lib/audit";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function completeOnboarding() {
  const user = await getAuthUser();

  const admin = getSupabaseAdmin();
  await admin
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  auditOnboarded({ userId: user.id, email: user.email ?? "" });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function inviteUser(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const email = formData.get("email") as string;
  const roles = (formData.getAll("roles") as string[]).filter(Boolean);
  const companyIds = (formData.getAll("companyIds") as string[]).filter(Boolean);

  if (!email || roles.length === 0 || companyIds.length === 0) {
    return { error: "Email, at least one role, and at least one company are required" };
  }

  // Verify the current user has permission to invite for these companies
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: userMemberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .contains("roles", ["company_admin"])
      .eq("status", "active");

    const userCompanyIds = (userMemberships ?? []).map((m) => m.company_id);
    const unauthorized = companyIds.filter((id) => !userCompanyIds.includes(id));

    if (unauthorized.length > 0) {
      return { error: "You don't have permission to invite for some of these companies" };
    }
  }

  try {
    const result = await createInvitation(admin, {
      email,
      roles,
      companyIds,
      invitedBy: user.id,
    });

    if (!result || result.alreadyExists) {
      return { error: "User already has access to these companies" };
    }

    // Get company names for the email
    const { data: companies } = await admin
      .from("companies")
      .select("legal_name, dic")
      .in("id", companyIds);

    const companyNames = (companies ?? []).map(
      (c) => c.legal_name ?? c.dic
    );

    // Get base URL from env or fallback
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk";

    await sendInvitationEmail({
      to: email,
      inviteUrl: getInviteUrl(result.token, baseUrl),
      roles,
      companyNames,
    });

    // Get company DICs for audit
    const companyDics = (companies ?? []).map((c) => c.dic);
    for (let i = 0; i < companyIds.length; i++) {
      auditInvitationCreated({
        actorId: user.id,
        actorEmail: user.email,
        inviteeEmail: email,
        roles,
        companyId: companyIds[i],
        companyDic: companyDics[i] ?? null,
        isGenesis: false,
      });
    }

    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to invite user:", err);
    return { error: "Failed to send invitation" };
  }
}

export async function deactivateMembership(membershipId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Get the membership
  const { data: membership } = await admin
    .from("company_memberships")
    .select("*, company:companies(dic)")
    .eq("id", membershipId)
    .single();

  if (!membership) {
    return { error: "Membership not found" };
  }

  // Check permissions
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    // Non-super-admin: must be company_admin for this company
    const { data: myMembership } = await admin
      .from("company_memberships")
      .select("roles, is_genesis")
      .eq("user_id", user.id)
      .eq("company_id", membership.company_id)
      .eq("status", "active")
      .single();

    if (!myMembership || !myMembership.roles?.includes("company_admin")) {
      return { error: "You don't have permission to deactivate this member" };
    }

    // Genesis admin can't be deactivated by non-super-admin
    if (membership.is_genesis) {
      return { error: "Genesis admin can only be deactivated by a super admin" };
    }

    // Non-genesis admin can't deactivate other admins
    if (membership.roles?.includes("company_admin") && !myMembership.is_genesis) {
      return { error: "Only genesis admin or super admin can deactivate other admins" };
    }
  }

  await admin
    .from("company_memberships")
    .update({ status: "inactive" })
    .eq("id", membershipId);

  auditMembershipDeactivated({
    actorId: user.id,
    actorEmail: user.email ?? "",
    userId: membership.user_id,
    companyId: membership.company_id,
    companyDic: membership.company?.dic ?? null,
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/companies");
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const fullName = formData.get("fullName") as string | null;
  const phone = formData.get("phone") as string | null;

  const updates: Record<string, string | null> = {};
  if (fullName !== null) updates.full_name = fullName || null;
  if (phone !== null) updates.phone = phone || null;

  if (Object.keys(updates).length === 0) {
    return { error: "No changes" };
  }

  await admin.from("profiles").update(updates).eq("id", user.id);

  auditProfileUpdated({
    userId: user.id,
    email: user.email ?? "",
    changes: updates,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

// ============================================================
// Departments
// ============================================================

async function verifyCompanyAdmin(userId: string, companyId: string) {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  if (profile?.is_super_admin) return true;

  const { data: membership } = await admin
    .from("company_memberships")
    .select("roles")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .contains("roles", ["company_admin"])
    .eq("status", "active")
    .single();

  return !!membership;
}

async function verifyCompanyAdminOrOperator(userId: string, companyId: string) {
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single();

  if (profile?.is_super_admin) return true;

  const { data: membership } = await admin
    .from("company_memberships")
    .select("roles")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .single();

  if (!membership) return false;
  const roles: string[] = membership.roles ?? [];
  return roles.includes("company_admin") || roles.includes("operator");
}

export async function createDepartment(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const companyId = formData.get("companyId") as string;
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;

  if (!companyId || !name) {
    return { error: "Company and department name are required" };
  }

  if (!(await verifyCompanyAdmin(user.id, companyId))) {
    return { error: "Only company admins can create departments" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("dic")
    .eq("id", companyId)
    .single();

  const { error } = await admin.from("departments").insert({
    company_id: companyId,
    parent_id: parentId,
    name,
  });

  if (error) {
    if (error.message?.includes("unique")) {
      return { error: "A department with this name already exists" };
    }
    return { error: "Failed to create department" };
  }

  auditDepartmentCreated({
    actorId: user.id,
    actorEmail: user.email ?? "",
    departmentName: name,
    companyId,
    companyDic: company?.dic ?? null,
    parentId,
  });

  revalidatePath("/dashboard/companies");
  return { success: true };
}

export async function addDepartmentMember(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const departmentId = formData.get("departmentId") as string;
  const userId = formData.get("userId") as string;

  if (!departmentId || !userId) {
    return { error: "Department and user are required" };
  }

  const { data: dept } = await admin
    .from("departments")
    .select("company_id, name, company:companies(dic)")
    .eq("id", departmentId)
    .single();

  if (!dept) return { error: "Department not found" };

  if (!(await verifyCompanyAdminOrOperator(user.id, dept.company_id))) {
    return { error: "Only company admins and operators can manage department members" };
  }

  const { error } = await admin.from("department_memberships").insert({
    user_id: userId,
    department_id: departmentId,
  });

  if (error) {
    if (error.message?.includes("unique")) {
      return { error: "User is already in this department" };
    }
    return { error: "Failed to add member" };
  }

  auditDepartmentMemberAdded({
    actorId: user.id,
    actorEmail: user.email ?? "",
    userId,
    departmentName: dept.name,
    companyId: dept.company_id,
    companyDic: (dept.company as any)?.dic ?? null,
  });

  revalidatePath("/dashboard/companies");
  return { success: true };
}

export async function removeDepartmentMember(membershipId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from("department_memberships")
    .select("user_id, department:departments(company_id, name, company:companies(dic))")
    .eq("id", membershipId)
    .single();

  if (!membership) return { error: "Membership not found" };

  const dept = membership.department as any;
  if (!(await verifyCompanyAdminOrOperator(user.id, dept.company_id))) {
    return { error: "Only company admins and operators can manage department members" };
  }

  await admin.from("department_memberships").delete().eq("id", membershipId);

  auditDepartmentMemberRemoved({
    actorId: user.id,
    actorEmail: user.email ?? "",
    userId: membership.user_id,
    departmentName: dept.name,
    companyId: dept.company_id,
    companyDic: dept.company?.dic ?? null,
  });

  revalidatePath("/dashboard/companies");
  return { success: true };
}

export async function renameDepartment(departmentId: string, newName: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const { data: dept } = await admin
    .from("departments")
    .select("company_id, name")
    .eq("id", departmentId)
    .single();

  if (!dept) return { error: "Department not found" };

  if (!(await verifyCompanyAdmin(user.id, dept.company_id))) {
    return { error: "Only company admins can rename departments" };
  }

  const { error } = await admin
    .from("departments")
    .update({ name: newName })
    .eq("id", departmentId);

  if (error) {
    if (error.message?.includes("unique")) {
      return { error: "A department with this name already exists" };
    }
    return { error: "Failed to rename department" };
  }

  audit({
    eventId: "DEPARTMENT_RENAMED",
    eventName: "Department renamed",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: dept.company_id,
    details: { departmentId, oldName: dept.name, newName },
  });

  revalidatePath("/dashboard/companies");
  return { success: true };
}

export async function deleteDepartment(departmentId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const { data: dept } = await admin
    .from("departments")
    .select("company_id, name, company:companies(dic)")
    .eq("id", departmentId)
    .single();

  if (!dept) return { error: "Department not found" };

  if (!(await verifyCompanyAdmin(user.id, dept.company_id))) {
    return { error: "Only company admins can delete departments" };
  }

  // Check for child departments
  const { data: children } = await admin
    .from("departments")
    .select("id")
    .eq("parent_id", departmentId);

  if (children && children.length > 0) {
    return { error: "Cannot delete a department with sub-departments. Delete children first." };
  }

  await admin.from("department_memberships").delete().eq("department_id", departmentId);
  await admin.from("departments").delete().eq("id", departmentId);

  audit({
    eventId: "DEPARTMENT_DELETED",
    eventName: "Department deleted",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: dept.company_id,
    companyDic: (dept.company as any)?.dic ?? undefined,
    details: { departmentId, name: dept.name },
  });

  revalidatePath("/dashboard/companies");
  return { success: true };
}

// ============================================================
// Peppol Activation
// ============================================================

export async function activateCompanyOnPeppol(companyId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Verify permission: must be company admin or super admin
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    if (!(await verifyCompanyAdmin(user.id, companyId))) {
      return { error: "Only company admins can activate companies on Peppol" };
    }
  }

  // Check current status
  const { data: company } = await admin
    .from("companies")
    .select("ion_ap_status, dic")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  if (company.ion_ap_status === "active") {
    return { error: "Company is already active on Peppol" };
  }

  try {
    await ensureCompanyActivated(companyId);

    // Mark user as onboarded (skip welcome screen after activation page)
    const { data: userProfile } = await admin
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .single();

    if (userProfile && !userProfile.onboarded_at) {
      await admin
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", user.id);
      auditOnboarded({ userId: user.id, email: user.email ?? "" });

      // Create wallet with initial credit for genesis admin
      try {
        const wallet = await getOrCreateWallet(user.id);
        if (wallet.available_balance === 0) {
          await topUpWallet(
            wallet.id,
            0.50,
            { type: "initial_credit", reason: "Welcome credit on Peppol activation" },
            user.id,
          );
        }
      } catch (err) {
        console.error("Failed to create wallet with initial credit:", err);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/companies");
    revalidatePath(`/dashboard/companies/${companyId}`);
    return { success: true, peppolId: getPeppolIdentifier(company.dic) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activation failed";
    revalidatePath("/dashboard/companies");
    revalidatePath(`/dashboard/companies/${companyId}`);
    return { error: message };
  }
}

export async function deactivateCompany(companyId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can deactivate companies" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  if (company.status === "deactivated") {
    return { error: "Company is already deactivated" };
  }

  // 1. Unpublish from SMP on ion-AP (if activated)
  if (company.ion_ap_org_id && company.ion_ap_status === "active") {
    try {
      await updateOrganization(company.ion_ap_org_id, {
        publishInSmp: false,
      });

      // Remove identifier from SMP
      if (company.ion_ap_identifier_id) {
        await deleteIdentifier(company.ion_ap_org_id, company.ion_ap_identifier_id);
      }
    } catch (err) {
      console.error("Failed to unpublish from ion-AP:", err);
      // Continue with deactivation even if ion-AP fails
    }
  }

  // 2. Deactivate all company memberships
  await admin
    .from("company_memberships")
    .update({ status: "inactive" })
    .eq("company_id", companyId)
    .eq("status", "active");

  // 3. Archive documents (mark as processed)
  await admin
    .from("documents")
    .update({ status: "processed" })
    .eq("company_id", companyId)
    .in("status", ["new", "read", "assigned"]);

  // 4. Update company status
  await admin
    .from("companies")
    .update({
      status: "deactivated",
      deactivated_at: new Date().toISOString(),
      ion_ap_status: "pending",
    })
    .eq("id", companyId);

  audit({
    eventId: "COMPANY_DEACTIVATED",
    eventName: "Company deactivated",
    severity: "warning",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId,
    companyDic: company.dic,
    details: {
      ionApOrgId: company.ion_ap_org_id,
      membershipsDeactivated: true,
      documentsArchived: true,
      smpUnpublished: !!company.ion_ap_org_id,
    },
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${companyId}`);
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/users");
  return { success: true };
}

// ============================================================
// Resend Invitation
// ============================================================

export async function resendInvitation(invitationId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can resend invitations" };
  }

  // Get the original invitation
  const { data: original } = await admin
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (!original) return { error: "Invitation not found" };

  // Create a new invitation with the same details
  const result = await createInvitation(admin, {
    email: original.email,
    roles: original.roles,
    companyIds: original.company_ids ?? [],
    isGenesis: original.is_genesis,
    invitedBy: user.id,
  });

  if (!result || result.alreadyExists) {
    return { error: "User already has access" };
  }

  // Get company names for the email
  const companyIds = original.company_ids ?? [];
  let companyNames: string[] = [];
  if (companyIds.length > 0) {
    const { data: companies } = await admin
      .from("companies")
      .select("legal_name, dic")
      .in("id", companyIds);

    companyNames = (companies ?? []).map((c) => c.legal_name ?? c.dic);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk";

  await sendInvitationEmail({
    to: original.email,
    inviteUrl: getInviteUrl(result.token, baseUrl),
    roles: original.roles,
    companyNames,
  });

  audit({
    eventId: "INVITATION_RESENT",
    eventName: "Invitation resent",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      originalInvitationId: invitationId,
      email: original.email,
      roles: original.roles,
      isGenesis: original.is_genesis,
    },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function sendGenesisInvitation(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Super admin only
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: "Only super admins can send genesis invitations" };
  }

  const companyId = formData.get("companyId") as string;
  const email = formData.get("email") as string;

  if (!companyId || !email) {
    return { error: "Company and email are required" };
  }

  const { data: company } = await admin
    .from("companies")
    .select("dic, legal_name")
    .eq("id", companyId)
    .single();

  if (!company) return { error: "Company not found" };

  const result = await createInvitation(admin, {
    email,
    roles: ["company_admin"],
    companyIds: [companyId],
    isGenesis: true,
    invitedBy: user.id,
  });

  if (!result) return { error: "Failed to create invitation" };

  if (result.alreadyExists) {
    return { error: "User already has genesis access to this company" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk";

  await sendInvitationEmail({
    to: email,
    inviteUrl: getInviteUrl(result.token, baseUrl),
    roles: ["company_admin"],
    companyNames: [company.legal_name ?? company.dic],
  });

  auditInvitationCreated({
    actorId: user.id,
    actorEmail: user.email,
    inviteeEmail: email,
    roles: ["company_admin"],
    companyId,
    companyDic: company.dic,
    isGenesis: true,
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/companies/${companyId}`);
  return { success: true };
}

export async function revokeInvitation(invitationId: string) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  // Get the invitation
  const { data: invitation } = await admin
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (!invitation) return { error: "Invitation not found" };

  if (invitation.accepted_at) {
    return { error: "Cannot revoke an accepted invitation" };
  }

  // Check permission: super admin or the person who sent it
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin && invitation.invited_by !== user.id) {
    return { error: "You can only revoke invitations you sent" };
  }

  // Soft-revoke: set expires_at to now so it becomes expired
  await admin
    .from("invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", invitationId);

  audit({
    eventId: "INVITATION_REVOKED",
    eventName: "Invitation revoked",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: {
      invitationId,
      email: invitation.email,
      roles: invitation.roles,
    },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}
