import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppRole,
  UserProfile,
  Company,
  CompanyMembership,
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
  const { data } = await admin
    .from("pfs_verifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

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

export async function getAllCompanies() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}
