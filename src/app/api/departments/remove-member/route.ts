import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { departmentId, userId } = await request.json();

  if (!departmentId || !userId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Find the membership
  const { data: membership } = await admin
    .from("department_memberships")
    .select("id")
    .eq("department_id", departmentId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  // Get department info for audit
  const { data: dept } = await admin
    .from("departments")
    .select("name, company_id, company:companies(dic)")
    .eq("id", departmentId)
    .single();

  await admin.from("department_memberships").delete().eq("id", membership.id);

  audit({
    eventId: "DEPARTMENT_MEMBER_REMOVED",
    eventName: "User removed from department",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: dept?.company_id,
    companyDic: (dept?.company as any)?.dic ?? undefined,
    details: {
      userId,
      departmentName: dept?.name,
    },
  });

  return NextResponse.json({ ok: true });
}
