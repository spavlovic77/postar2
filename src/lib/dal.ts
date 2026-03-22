import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppRole,
  UserProfile,
  Company,
  CompanyMembership,
  Department,
  Document,
} from "./types";

export interface UserWithRole {
  user: { id: string; email: string | null };
  profile: UserProfile;
  memberships: CompanyMembership[];
  companies: Company[];
  role: AppRole;
}

export async function getUserWithRole(): Promise<UserWithRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: memberships } = await admin
    .from("company_memberships")
    .select("*, company:companies(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const companies = (memberships ?? [])
    .map((m: CompanyMembership & { company: Company }) => m.company)
    .filter(Boolean);

  let role: AppRole = "accountant";
  if (profile.is_super_admin) {
    role = "super_admin";
  } else if (memberships?.some((m: CompanyMembership) => m.role === "company_admin")) {
    role = "company_admin";
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    profile,
    memberships: memberships ?? [],
    companies,
    role,
  };
}

export async function getSuperAdminStats() {
  const admin = getSupabaseAdmin();

  const [companies, profiles, invitations, webhooks] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("invitations").select("id", { count: "exact", head: true }).is("accepted_at", null),
    admin.from("pfs_verifications").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalCompanies: companies.count ?? 0,
    totalUsers: profiles.count ?? 0,
    pendingInvitations: invitations.count ?? 0,
    totalWebhooks: webhooks.count ?? 0,
  };
}

export async function getRecentWebhooks(limit = 10) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pfs_verifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch webhooks:", error);
  }

  return data ?? [];
}

export async function getRecentInvitations(limit = 10) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getCompanyAdminData(userId: string) {
  const admin = getSupabaseAdmin();

  const { data: memberships } = await admin
    .from("company_memberships")
    .select("*, company:companies(*)")
    .eq("user_id", userId)
    .eq("role", "company_admin")
    .eq("status", "active");

  const companyIds = (memberships ?? []).map((m: CompanyMembership) => m.company_id);

  let memberCounts: Record<string, number> = {};
  let pendingInvitations: Record<string, number> = {};

  if (companyIds.length > 0) {
    const { data: allMembers } = await admin
      .from("company_memberships")
      .select("company_id")
      .in("company_id", companyIds)
      .eq("status", "active");

    for (const m of allMembers ?? []) {
      memberCounts[m.company_id] = (memberCounts[m.company_id] ?? 0) + 1;
    }

    const { data: allInvites } = await admin
      .from("invitations")
      .select("company_ids")
      .is("accepted_at", null)
      .eq("invited_by", userId);

    for (const inv of allInvites ?? []) {
      for (const cid of inv.company_ids ?? []) {
        if (companyIds.includes(cid)) {
          pendingInvitations[cid] = (pendingInvitations[cid] ?? 0) + 1;
        }
      }
    }
  }

  return {
    memberships: memberships ?? [],
    memberCounts,
    pendingInvitations,
  };
}

export async function getAuditLogs(params: {
  userId?: string;
  companyId?: string | null;
  isSuperAdmin: boolean;
  companyIds?: string[];
  limit?: number;
  offset?: number;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (!params.isSuperAdmin && params.companyIds?.length) {
    // Non-super-admin: only logs for their companies or their own actions
    query = query.or(
      `company_id.in.(${params.companyIds.join(",")}),actor_id.eq.${params.userId}`
    );
  }

  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  query = query.range(
    params.offset ?? 0,
    (params.offset ?? 0) + (params.limit ?? 50) - 1
  );

  const { data, count } = await query;
  return { logs: data ?? [], total: count ?? 0 };
}

export async function getAllCompanies() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getCompanyWithMembers(companyId: string) {
  const admin = getSupabaseAdmin();

  const [companyRes, membersRes] = await Promise.all([
    admin.from("companies").select("*").eq("id", companyId).single(),
    admin
      .from("company_memberships")
      .select("*, profile:profiles(*)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    company: companyRes.data,
    members: membersRes.data ?? [],
  };
}

export async function getCompaniesWithMemberCounts(companyIds?: string[]) {
  const admin = getSupabaseAdmin();

  let query = admin.from("companies").select("*").order("created_at", { ascending: false });
  if (companyIds) {
    query = query.in("id", companyIds);
  }
  const { data: companies } = await query;

  const ids = (companies ?? []).map((c: Company) => c.id);
  let memberCounts: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: allMembers } = await admin
      .from("company_memberships")
      .select("company_id")
      .in("company_id", ids)
      .eq("status", "active");

    for (const m of allMembers ?? []) {
      memberCounts[m.company_id] = (memberCounts[m.company_id] ?? 0) + 1;
    }
  }

  return { companies: companies ?? [], memberCounts };
}

export async function getAllUsers() {
  const admin = getSupabaseAdmin();

  const { data: profiles } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: memberships } = await admin
    .from("company_memberships")
    .select("*, company:companies(id, dic, legal_name)")
    .eq("status", "active");

  // Get emails from auth
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailMap: Record<string, string> = {};
  for (const u of authUsers ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  const membershipsByUser: Record<string, typeof memberships> = {};
  for (const m of memberships ?? []) {
    if (!membershipsByUser[m.user_id]) membershipsByUser[m.user_id] = [];
    membershipsByUser[m.user_id]!.push(m);
  }

  return (profiles ?? []).map((p: UserProfile) => ({
    ...p,
    email: emailMap[p.id] ?? null,
    memberships: membershipsByUser[p.id] ?? [],
  }));
}

export async function getInvitations(params: {
  isSuperAdmin: boolean;
  userId?: string;
  companyIds?: string[];
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false });

  if (!params.isSuperAdmin) {
    query = query.eq("invited_by", params.userId!);
  }

  const { data } = await query;
  return data ?? [];
}

// ============================================================
// Departments
// ============================================================

export async function getCompanyDepartments(companyId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function getDepartmentWithMembers(departmentId: string) {
  const admin = getSupabaseAdmin();

  const [deptRes, membersRes] = await Promise.all([
    admin.from("departments").select("*").eq("id", departmentId).single(),
    admin
      .from("department_memberships")
      .select("*, profile:profiles(*)")
      .eq("department_id", departmentId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    department: deptRes.data,
    members: membersRes.data ?? [],
  };
}

export async function getUserDepartments(userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("department_memberships")
    .select("*, department:departments(*, company:companies(id, dic, legal_name))")
    .eq("user_id", userId);

  return data ?? [];
}

// ============================================================
// Documents (Inbox)
// ============================================================

export async function getDocuments(params: {
  companyIds: string[];
  direction?: "received" | "sent";
  status?: string;
  companyId?: string | null;
  isSuperAdmin: boolean;
  limit?: number;
  offset?: number;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("documents")
    .select("*, company:companies(id, dic, legal_name)", { count: "exact" })
    .order("peppol_created_at", { ascending: false });

  if (!params.isSuperAdmin && params.companyIds.length > 0) {
    query = query.in("company_id", params.companyIds);
  }

  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  if (params.direction) {
    query = query.eq("direction", params.direction);
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  query = query.range(
    params.offset ?? 0,
    (params.offset ?? 0) + (params.limit ?? 50) - 1
  );

  const { data, count } = await query;
  return { documents: data ?? [], total: count ?? 0 };
}

export async function getDocument(documentId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("documents")
    .select("*, company:companies(id, dic, legal_name)")
    .eq("id", documentId)
    .single();

  return data;
}

export async function updateDocumentStatus(
  documentId: string,
  status: "new" | "read" | "assigned" | "processed"
) {
  const admin = getSupabaseAdmin();
  await admin.from("documents").update({ status }).eq("id", documentId);
}

export async function getInboxCounts(companyIds: string[], isSuperAdmin: boolean) {
  const admin = getSupabaseAdmin();

  let unreadQuery = admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("direction", "received")
    .eq("status", "new");

  let totalQuery = admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("direction", "received");

  if (!isSuperAdmin && companyIds.length > 0) {
    unreadQuery = unreadQuery.in("company_id", companyIds);
    totalQuery = totalQuery.in("company_id", companyIds);
  }

  const [unread, total] = await Promise.all([unreadQuery, totalQuery]);

  return {
    unread: unread.count ?? 0,
    total: total.count ?? 0,
  };
}
