import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDocument, retryPendingDocuments } from "@/lib/document-processor";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let transactionUrl: string | null = null;

    if (contentType.includes("x-www-form-urlencoded")) {
      const formData = await request.formData();
      transactionUrl = (formData.get("data") ?? formData.get("document") ?? formData.get("url")) as string;
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      transactionUrl = body.data ?? body.document ?? body.url ?? null;
    } else {
      const text = await request.text();
      if (text.includes("receive-transactions")) {
        transactionUrl = text.trim();
      } else {
        return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
      }
    }

    if (!transactionUrl) {
      return NextResponse.json({ error: "Missing transaction URL" }, { status: 400 });
    }

    const idMatch = transactionUrl.match(/receive-transactions\/(\d+)/);
    if (!idMatch) {
      console.error("[WEBHOOK] Invalid transaction URL:", transactionUrl.substring(0, 100));
      return NextResponse.json({ error: "Invalid transaction URL" }, { status: 400 });
    }

    const transactionId = parseInt(idMatch[1], 10);
    const supabase = getSupabaseAdmin();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("documents")
      .select("id, status")
      .eq("ion_ap_transaction_id", transactionId)
      .eq("direction", "received")
      .single();

    if (existing) {
      if (existing.status === "pending" || existing.status === "failed") {
        await processDocument(existing.id);
      }
      return NextResponse.json({ message: "Already tracked", documentId: existing.id }, { status: 200 });
    }

    // Find company
    const companyId = await findCompanyFromTransaction(supabase, transactionId);

    // Save as pending
    const { data: newDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        company_id: companyId,
        direction: "received",
        status: "pending",
        ion_ap_transaction_id: transactionId,
      })
      .select("id")
      .single();

    if (insertError || !newDoc) {
      console.error("[WEBHOOK] Failed to save:", insertError);
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    console.log(`[WEBHOOK] Transaction ${transactionId} → ${newDoc.id}`);

    await processDocument(newDoc.id);

    retryPendingDocuments().catch((err) =>
      console.error("[WEBHOOK] Background retry failed:", err)
    );

    return NextResponse.json({ message: "Document received", documentId: newDoc.id }, { status: 201 });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function findCompanyFromTransaction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  transactionId: number
): Promise<string> {
  const { getReceiveTransaction } = await import("@/lib/ion-ap");
  const transaction = await getReceiveTransaction(transactionId);
  const receiverDic = transaction.receiver_identifier?.replace("0245:", "");

  if (receiverDic) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("dic", receiverDic)
      .single();

    if (company) return company.id;
  }

  throw new Error(`Unknown receiver: ${transaction.receiver_identifier}`);
}
