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
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", doc.company_id)
      .eq("status", "active")
      .single();

    if (membership?.role !== "company_admin" && membership?.role !== "operator") {
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

/**
 * Manually change a document's status. Only admin/operator.
 * Allowed transitions: to new, assigned, or processed.
 * Processed status requires a note (handled by markDocumentProcessed instead).
 * Changing to 'new' clears the department.
 */
export async function updateDocumentStatus(
  documentId: string,
  newStatus: "new" | "assigned" | "processed"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const admin = getSupabaseAdmin();

  const { data: doc } = await admin
    .from("documents")
    .select("company_id, status, department_id")
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
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", doc.company_id)
      .eq("status", "active")
      .single();

    if (membership?.role !== "company_admin" && membership?.role !== "operator") {
      return { error: "Only admins and operators can change document status" };
    }
  }

  // Changing to 'assigned' requires a department to already be set
  if (newStatus === "assigned" && !doc.department_id) {
    return { error: "Assign the document to a department first" };
  }

  const updates: Record<string, any> = { status: newStatus };
  // Changing to 'new' also clears department
  if (newStatus === "new") {
    updates.department_id = null;
  }

  await admin.from("documents").update(updates).eq("id", documentId);

  audit({
    eventId: "DOCUMENT_STATUS_UPDATED",
    eventName: "Document status manually updated",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: {
      documentId,
      oldStatus: doc.status,
      newStatus,
    },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${documentId}`);
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
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", dept.company_id)
      .eq("status", "active")
      .single();

    if (membership?.role !== "company_admin" && membership?.role !== "operator") {
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
