"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
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

  redirect("/dashboard");
}

export async function inviteUser(formData: FormData) {
  const user = await getAuthUser();
  const admin = getSupabaseAdmin();

  const email = formData.get("email") as string;
  const role = formData.get("role") as "company_admin" | "accountant";
  const companyIds = (formData.getAll("companyIds") as string[]).filter(Boolean);

  if (!email || !role || companyIds.length === 0) {
    return { error: "Email, role, and at least one company are required" };
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
      .eq("role", "company_admin")
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
      role,
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postar2.vercel.app";

    await sendInvitationEmail({
      to: email,
      inviteUrl: getInviteUrl(result.token, baseUrl),
      role,
      companyNames,
    });

    // Get company DICs for audit
    const companyDics = (companies ?? []).map((c) => c.dic);
    for (let i = 0; i < companyIds.length; i++) {
      auditInvitationCreated({
        actorId: user.id,
        actorEmail: user.email,
        inviteeEmail: email,
        role,
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
      .select("role, is_genesis")
      .eq("user_id", user.id)
      .eq("company_id", membership.company_id)
      .eq("status", "active")
      .single();

    if (!myMembership || myMembership.role !== "company_admin") {
      return { error: "You don't have permission to deactivate this member" };
    }

    // Genesis admin can't be deactivated by non-super-admin
    if (membership.is_genesis) {
      return { error: "Genesis admin can only be deactivated by a super admin" };
    }

    // Non-genesis admin can't deactivate other admins
    if (membership.role === "company_admin" && !myMembership.is_genesis) {
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
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .eq("status", "active")
    .single();

  return !!membership;
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

  if (!(await verifyCompanyAdmin(user.id, dept.company_id))) {
    return { error: "Only company admins can manage department members" };
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
  if (!(await verifyCompanyAdmin(user.id, dept.company_id))) {
    return { error: "Only company admins can manage department members" };
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
