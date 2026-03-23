import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppRole,
  UserProfile,
  Company,
  CompanyMembership,
  Department,
  Document,
  Wallet,
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

  // Determine highest role across all memberships
  let role: AppRole = "processor";
  if (profile.is_super_admin) {
    role = "super_admin";
  } else {
    const allRoles = (memberships ?? []).flatMap((m: CompanyMembership) => m.roles ?? []);
    if (allRoles.includes("company_admin")) {
      role = "company_admin";
    } else if (allRoles.includes("operator")) {
      role = "operator";
    }
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

export async function getRecentWebhooks(params: {
  limit?: number;
  offset?: number;
  dic?: string;
  company?: string;
  email?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}) {
  const admin = getSupabaseAdmin();
  const limit = params.limit ?? 10;
  const offset = params.offset ?? 0;

  let query = admin
    .from("pfs_verifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.dic) query = query.ilike("dic", `%${params.dic}%`);
  if (params.company) query = query.ilike("legal_name", `%${params.company}%`);
  if (params.email) query = query.ilike("company_email", `%${params.email}%`);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", `${params.dateTo}T23:59:59`);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch webhooks:", error);
  }

  return { webhooks: data ?? [], total: count ?? 0 };
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
  severity?: string;
  eventId?: string;
  dic?: string;
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (!params.isSuperAdmin) {
    if (params.companyIds && params.companyIds.length > 0) {
      query = query.or(
        `company_id.in.(${params.companyIds.join(",")}),actor_id.eq.${params.userId}`
      );
    } else {
      query = query.eq("actor_id", params.userId!);
    }
  }

  if (params.companyId) query = query.eq("company_id", params.companyId);
  if (params.severity) query = query.eq("severity", params.severity);
  if (params.eventId) query = query.ilike("event_id", `%${params.eventId}%`);
  if (params.dic) query = query.ilike("company_dic", `%${params.dic}%`);
  if (params.actor) query = query.ilike("actor_email", `%${params.actor}%`);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", `${params.dateTo}T23:59:59`);

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
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
  ]);

  if (membersRes.error) {
    console.error("Failed to fetch members:", membersRes.error);
  }

  // Fetch profiles separately to avoid join issues
  const members = membersRes.data ?? [];
  const userIds = members.map((m) => m.user_id).filter(Boolean);

  let profilesMap: Record<string, any> = {};
  let emailsMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("*")
      .in("id", userIds);

    for (const p of profiles ?? []) {
      profilesMap[p.id] = p;
    }

    // Fetch emails from auth
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    for (const u of authUsers ?? []) {
      if (u.email) emailsMap[u.id] = u.email;
    }
  }

  const membersWithProfiles = members.map((m) => ({
    ...m,
    profile: profilesMap[m.user_id] ?? null,
    email: emailsMap[m.user_id] ?? null,
  }));

  return {
    company: companyRes.data,
    members: membersWithProfiles,
  };
}

export async function getCompaniesWithMemberCounts(params: {
  companyIds?: string[];
  name?: string;
  dic?: string;
  peppolStatus?: string;
  companyStatus?: string;
} = {}) {
  const admin = getSupabaseAdmin();

  let query = admin.from("companies").select("*").order("created_at", { ascending: false });
  if (params.companyIds) query = query.in("id", params.companyIds);
  if (params.name) query = query.ilike("legal_name", `%${params.name}%`);
  if (params.dic) query = query.ilike("dic", `%${params.dic}%`);
  if (params.peppolStatus) query = query.eq("ion_ap_status", params.peppolStatus);
  if (params.companyStatus) query = query.eq("status", params.companyStatus);

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

export async function getCompanyDepartmentsWithMembers(companyId: string) {
  const admin = getSupabaseAdmin();

  const { data: departments } = await admin
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  const deptIds = (departments ?? []).map((d) => d.id);

  let deptMembers: any[] = [];
  if (deptIds.length > 0) {
    const { data } = await admin
      .from("department_memberships")
      .select("*")
      .in("department_id", deptIds);
    deptMembers = data ?? [];
  }

  const { data: companyMembers } = await admin
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");

  const companyMemberIds = (companyMembers ?? []).map((m) => m.user_id);

  let allMembers: { id: string; fullName: string | null; email: string | null }[] = [];

  if (companyMemberIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", companyMemberIds);

    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const emailsMap: Record<string, string> = {};
    for (const u of authUsers ?? []) {
      if (u.email) emailsMap[u.id] = u.email;
    }

    allMembers = (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: emailsMap[p.id] ?? null,
    }));
  }

  const membersByDept: Record<string, string[]> = {};
  for (const dm of deptMembers) {
    if (!membersByDept[dm.department_id]) membersByDept[dm.department_id] = [];
    membersByDept[dm.department_id].push(dm.user_id);
  }

  const assignedUserIds = new Set(deptMembers.map((dm: any) => dm.user_id));
  const unassignedUserIds = companyMemberIds.filter((id: string) => !assignedUserIds.has(id));

  return {
    departments: departments ?? [],
    membersByDept,
    unassignedUserIds,
    allMembers,
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
  search?: string;
  documentType?: string;
  limit?: number;
  offset?: number;
}) {
  const admin = getSupabaseAdmin();
  let query = admin
    .from("documents")
    .select("*", { count: "exact" })
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

  if (params.documentType) query = query.eq("document_type", params.documentType);
  if (params.search) {
    query = query.or(
      `sender_identifier.ilike.%${params.search}%,document_id.ilike.%${params.search}%`
    );
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  query = query.range(
    params.offset ?? 0,
    (params.offset ?? 0) + (params.limit ?? 50) - 1
  );

  const { data, count, error } = await query;

  if (error) {
    console.error("Failed to fetch documents:", error);
  }

  return { documents: data ?? [], total: count ?? 0 };
}

export async function getDocument(documentId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error) {
    console.error("Failed to fetch document:", error);
    return null;
  }

  // Fetch company separately
  if (data?.company_id) {
    const { data: company } = await admin
      .from("companies")
      .select("id, dic, legal_name")
      .eq("id", data.company_id)
      .single();

    return { ...data, company };
  }

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

// ============================================================
// Billing / Wallet
// ============================================================

export async function getWalletByOwner(ownerId: string): Promise<Wallet | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("wallets")
    .select("*")
    .eq("owner_id", ownerId)
    .single();
  return data as Wallet | null;
}

/**
 * Find the wallet associated with a user.
 * If the user is genesis admin, return their wallet.
 * Otherwise, find the genesis admin of their first company.
 */
export async function getWalletForCurrentUser(userId: string): Promise<{
  wallet: Wallet;
  genesisUserId: string;
  isOwner: boolean;
} | null> {
  const admin = getSupabaseAdmin();

  // Check if user has their own wallet (is genesis admin)
  const { data: ownWallet } = await admin
    .from("wallets")
    .select("*")
    .eq("owner_id", userId)
    .single();

  if (ownWallet) {
    return { wallet: ownWallet as Wallet, genesisUserId: userId, isOwner: true };
  }

  // Find genesis admin of user's first company
  const { data: membership } = await admin
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) return null;

  const { data: genesisMembership } = await admin
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", membership.company_id)
    .eq("is_genesis", true)
    .eq("status", "active")
    .single();

  if (!genesisMembership) return null;

  const { data: wallet } = await admin
    .from("wallets")
    .select("*")
    .eq("owner_id", genesisMembership.user_id)
    .single();

  if (!wallet) return null;

  return {
    wallet: wallet as Wallet,
    genesisUserId: genesisMembership.user_id,
    isOwner: false,
  };
}
