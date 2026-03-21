"use server";

import { revalidatePath } from "next/cache";
import { updateDocumentStatus } from "@/lib/dal";
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
