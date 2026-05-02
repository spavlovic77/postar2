import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { auditInvitationCreated } from "@/lib/audit";

const ALLOWED_ROLES = ["company_admin", "operator", "processor"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Mobile-facing invitation endpoint. Mirrors the web `inviteUser` server
// action in src/lib/actions.ts but accepts a Bearer token + JSON body and
// returns machine-readable error codes the mobile maps to Slovak alerts.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const companyIds = Array.isArray(body.companyIds)
    ? (body.companyIds.filter(
        (id: unknown): id is string => typeof id === "string" && id.length > 0
      ) as string[])
    : [];

  if (!email || !role || companyIds.length === 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  // Permission: super_admin OR company_admin of every requested company.
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

    const adminCompanyIds = new Set(
      (userMemberships ?? []).map((m) => m.company_id)
    );
    const unauthorized = companyIds.filter((id) => !adminCompanyIds.has(id));
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: "not_admin_for_companies", unauthorized },
        { status: 403 }
      );
    }
  }

  // Already-member pre-check: if the recipient already exists AND has
  // active membership in every requested company, there's nothing to do.
  // createInvitation only does this check for is_genesis; for the mobile
  // (non-genesis) flow we add it here so the UI can show a clean message
  // instead of letting the recipient receive a useless email.
  const { data: existingUsersPage } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const recipient = existingUsersPage?.users?.find((u) => u.email === email);
  if (recipient) {
    const { data: activeMemberships } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", recipient.id)
      .eq("status", "active")
      .in("company_id", companyIds);
    const memberOfAll =
      (activeMemberships?.length ?? 0) === companyIds.length;
    if (memberOfAll) {
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }
  }

  try {
    const result = await createInvitation(admin, {
      email,
      roles: [role],
      companyIds,
      invitedBy: user.id,
    });

    if (!result || result.alreadyExists) {
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }

    const { data: companies } = await admin
      .from("companies")
      .select("id, legal_name, dic")
      .in("id", companyIds);

    const companyNames = (companies ?? []).map(
      (c) => c.legal_name ?? c.dic ?? ""
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://www.v0-postar2.vercel.app";

    await sendInvitationEmail({
      to: email,
      inviteUrl: getInviteUrl(result.token, baseUrl),
      roles: role,
      companyNames,
    });

    const dicById = new Map(
      (companies ?? []).map((c) => [c.id, c.dic ?? null])
    );
    for (const companyId of companyIds) {
      auditInvitationCreated({
        actorId: user.id,
        actorEmail: user.email ?? null,
        inviteeEmail: email,
        roles: [role],
        companyId,
        companyDic: dicById.get(companyId) ?? null,
        isGenesis: false,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/invitations] failed:", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "send_failed", detail },
      { status: 500 }
    );
  }
}
