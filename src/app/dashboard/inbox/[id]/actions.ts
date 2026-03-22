"use server";

import { revalidatePath } from "next/cache";
import { updateDocumentStatus } from "@/lib/dal";
import { processDocument } from "@/lib/document-processor";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export async function markDocumentUnread(documentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await updateDocumentStatus(documentId, "new");

  audit({
    eventId: "DOCUMENT_UNREAD",
    eventName: "Document marked as unread",
    actorId: user?.id,
    actorEmail: user?.email ?? undefined,
    details: { documentId },
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${documentId}`);
}

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
