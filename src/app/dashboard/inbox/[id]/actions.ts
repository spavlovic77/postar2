"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDocument } from "@/lib/document-processor";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function retryDocument(documentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  audit({
    eventId: "DOCUMENT_MANUAL_RETRY",
    eventName: "Document processing manually retried",
    actorId: user?.id,
    actorEmail: user?.email ?? undefined,
    details: { documentId },
  });

  const success = await processDocument(documentId);

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${documentId}`);

  return { success };
}

export async function markDocumentProcessed(documentId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!note.trim()) return { error: "Note is required" };

  const admin = getSupabaseAdmin();

  const { data: doc } = await admin
    .from("documents")
    .select("status, company_id")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };

  // Update status to processed
  await admin
    .from("documents")
    .update({ status: "processed" })
    .eq("id", documentId);

  // Add note
  await admin.from("document_notes").insert({
    document_id: documentId,
    user_id: user.id,
    note: note.trim(),
    type: "processed",
  });

  audit({
    eventId: "DOCUMENT_PROCESSED",
    eventName: "Document marked as processed",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: { documentId, note: note.trim() },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${documentId}`);

  return { success: true };
}

export async function bulkMarkDocumentsProcessed(documentIds: string[], note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!note.trim()) return { error: "Note is required" };
  if (documentIds.length === 0) return { error: "No documents selected" };

  const admin = getSupabaseAdmin();

  // Only mark documents that aren't already processed
  const { data: docs } = await admin
    .from("documents")
    .select("id, status, company_id")
    .in("id", documentIds)
    .in("status", ["new", "read", "assigned"]);

  if (!docs || docs.length === 0) return { count: 0 };

  const idsToMark = docs.map((d) => d.id);

  await admin
    .from("documents")
    .update({ status: "processed" })
    .in("id", idsToMark);

  // Add notes for each document
  const notes = idsToMark.map((id) => ({
    document_id: id,
    user_id: user.id,
    note: note.trim(),
    type: "processed",
  }));
  await admin.from("document_notes").insert(notes);

  // Audit per company
  const companyIds = [...new Set(docs.map((d) => d.company_id))];
  for (const companyId of companyIds) {
    const companyDocs = docs.filter((d) => d.company_id === companyId);
    audit({
      eventId: "DOCUMENTS_BULK_PROCESSED",
      eventName: "Documents bulk exported and marked as processed",
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      companyId,
      details: {
        documentIds: companyDocs.map((d) => d.id),
        count: companyDocs.length,
        note: note.trim(),
      },
    });
  }

  revalidatePath("/dashboard/inbox");

  return { count: idsToMark.length };
}

export async function returnDocumentToTriage(documentId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!note.trim()) return { error: "Note is required" };

  const admin = getSupabaseAdmin();

  const { data: doc } = await admin
    .from("documents")
    .select("status, company_id, department_id")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found" };
  if (doc.status !== "assigned") return { error: "Only assigned documents can be returned" };

  // Reset to new + unassign from department
  await admin
    .from("documents")
    .update({ status: "new", department_id: null })
    .eq("id", documentId);

  // Add note
  await admin.from("document_notes").insert({
    document_id: documentId,
    user_id: user.id,
    note: note.trim(),
    type: "system",
  });

  audit({
    eventId: "DOCUMENT_RETURNED_TO_TRIAGE",
    eventName: "Document returned to triage by processor",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    companyId: doc.company_id,
    details: { documentId, note: note.trim(), previousDepartmentId: doc.department_id },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${documentId}`);

  return { success: true };
}

export async function addDocumentNote(documentId: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!note.trim()) return { error: "Note is required" };

  const admin = getSupabaseAdmin();

  await admin.from("document_notes").insert({
    document_id: documentId,
    user_id: user.id,
    note: note.trim(),
    type: "comment",
  });

  audit({
    eventId: "DOCUMENT_NOTE_ADDED",
    eventName: "Note added to document",
    actorId: user.id,
    actorEmail: user.email ?? undefined,
    details: { documentId, note: note.trim() },
  });

  revalidatePath(`/dashboard/inbox/${documentId}`);

  return { success: true };
}
