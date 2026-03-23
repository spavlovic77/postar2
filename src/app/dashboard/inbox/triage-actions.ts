"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export async function assignDocumentToDepartment(
  documentId: string,
  departmentId: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  const { data: doc } = await admin
    .from("documents")
    .select("company_id")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };

  // Check permission: super admin, company admin, or operator
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("roles")
      .eq("user_id", user.id)
      .eq("company_id", doc.company_id)
      .eq("status", "active")
      .single();

    const roles: string[] = membership?.roles ?? [];
    if (!roles.includes("company_admin") && !roles.includes("operator")) {
      return { error: "Only admins and operators can assign documents" };
    }
  }

  // Get department name for audit
  let deptName: string | null = null;
  if (departmentId) {
    const { data: dept } = await admin
      .from("departments")
      .select("name")
      .eq("id", departmentId)
      .single();
    deptName = dept?.name ?? null;
  }

  await admin
    .from("documents")
    .update({
      department_id: departmentId,
      status: departmentId ? "assigned" : "new",
    })
    .eq("id", documentId);

  audit({
    eventId: "DOCUMENT_ASSIGNED",
    eventName: departmentId ? "Document assigned to department" : "Document unassigned",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: {
      documentId,
      departmentId,
      departmentName: deptName,
    },
  });

  revalidatePath("/dashboard/inbox");
  return { success: true };
}

export async function bulkAssignDocuments(
  documentIds: string[],
  departmentId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (documentIds.length === 0) return { error: "No documents selected" };

  const admin = getSupabaseAdmin();

  // Get department info
  const { data: dept } = await admin
    .from("departments")
    .select("name, company_id")
    .eq("id", departmentId)
    .single();

  if (!dept) return { error: "Department not found" };

  // Check permission
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("roles")
      .eq("user_id", user.id)
      .eq("company_id", dept.company_id)
      .eq("status", "active")
      .single();

    const roles: string[] = membership?.roles ?? [];
    if (!roles.includes("company_admin") && !roles.includes("operator")) {
      return { error: "Only admins and operators can assign documents" };
    }
  }

  // Bulk update
  await admin
    .from("documents")
    .update({
      department_id: departmentId,
      status: "assigned",
    })
    .in("id", documentIds);

  audit({
    eventId: "DOCUMENTS_BULK_ASSIGNED",
    eventName: "Documents bulk assigned to department",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: dept.company_id,
    details: {
      documentIds,
      departmentId,
      departmentName: dept.name,
      count: documentIds.length,
    },
  });

  revalidatePath("/dashboard/inbox");
  return { success: true, count: documentIds.length };
}
