import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual, createHmac } from "crypto";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function verifySignature(rawBody: string, signature: string): boolean {
  const secrets = (process.env.PFS_WEBHOOK_SECRET ?? "").split(",");

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret.trim())
      .update(rawBody, "utf8")
      .digest("hex");

    if (
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      return true;
    }
  }

  return false;
}

const DIC_REGEX = /^\d{10}$/;

export async function POST(request: Request) {
  // Validate signature
  const signature = request.headers.get("x-pfs-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-PFS-Signature header" },
      { status: 401 }
    );
  }

  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse and validate payload
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { verification_token, dic, legalName, company_email, company_phone, created } =
    payload;

  if (!verification_token || !dic || !created) {
    return NextResponse.json(
      { error: "Missing required fields: verification_token, dic, created" },
      { status: 400 }
    );
  }

  if (!DIC_REGEX.test(dic)) {
    return NextResponse.json(
      { error: "Invalid DIC format: must be exactly 10 digits" },
      { status: 400 }
    );
  }

  const { error } = await getSupabaseAdmin().from("pfs_verifications").insert({
    verification_token,
    dic,
    legal_name: legalName ?? null,
    company_email: company_email ?? null,
    company_phone: company_phone ?? null,
    pfs_created_at: created,
  });

  if (error) {
    console.error("Failed to insert PFS verification:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Created" }, { status: 201 });
}
