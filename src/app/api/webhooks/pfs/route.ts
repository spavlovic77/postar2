import { NextResponse } from "next/server";
import { timingSafeEqual, createHmac } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { getPfsWebhookSecret } from "@/lib/settings";
import { auditWebhookReceived, auditInvitationCreated } from "@/lib/audit";

async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  const secretValue = await getPfsWebhookSecret();
  const secrets = secretValue.split(",");

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
  const signature = request.headers.get("x-pfs-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-PFS-Signature header" },
      { status: 401 }
    );
  }

  const rawBody = await request.text();

  if (!(await verifySignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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

  const supabase = getSupabaseAdmin();

  // 1. Save raw webhook payload
  const { error: pfsError } = await supabase.from("pfs_verifications").insert({
    verification_token,
    dic,
    legal_name: legalName ?? null,
    company_email: company_email ?? null,
    company_phone: company_phone ?? null,
    pfs_created_at: created,
  });

  if (pfsError) {
    console.error("Failed to insert PFS verification:", pfsError);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // 2. Upsert company by DIC
  let companyId: string;
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("dic", dic)
    .single();

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        dic,
        legal_name: legalName ?? null,
        company_email: company_email ?? null,
        company_phone: company_phone ?? null,
        pfs_created_at: created,
      })
      .select("id")
      .single();

    if (companyError || !newCompany) {
      console.error("Failed to create company:", companyError);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    companyId = newCompany.id;
  }

  auditWebhookReceived({
    dic,
    companyId,
    verificationToken: verification_token,
    isNewCompany: !existingCompany,
    request,
  });

  // 3. Send genesis admin invitation (if company_email provided)
  if (company_email) {
    try {
      const result = await createInvitation(supabase, {
        email: company_email,
        role: "company_admin",
        companyIds: [companyId],
        isGenesis: true,
      });

      if (result && !result.alreadyExists) {
        auditInvitationCreated({
          inviteeEmail: company_email,
          role: "company_admin",
          companyId,
          companyDic: dic,
          isGenesis: true,
        });
        const baseUrl = request.headers.get("x-forwarded-proto")
          ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
          : new URL(request.url).origin;

        await sendInvitationEmail({
          to: company_email,
          inviteUrl: getInviteUrl(result.token, baseUrl),
          role: "company_admin",
          companyNames: [legalName ?? dic],
        });
      }
    } catch (err) {
      // Log but don't fail the webhook — the company was still created
      console.error("Failed to create invitation:", err);
    }
  }

  return NextResponse.json(
    {
      message: existingCompany ? "Webhook processed" : "Company created",
      company_id: companyId,
    },
    { status: existingCompany ? 200 : 201 }
  );
}
