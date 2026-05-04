import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createInvitation, getInviteUrl } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { getPfsWebhookSecret } from "@/lib/settings";
import { auditWebhookReceived, auditInvitationCreated } from "@/lib/audit";

// Inbound webhook from FS SR's PDS module on PFS. Implements the spec
// "Poskytnutie údajov subjektu pre poskytovateľa doručovacej služby":
//   - Header X-PDS-Secret: Hexa(Sha512Hash(Utf8Bytes(rawBody + webhookSecret)))
//   - Body: JSON array of subject records
//   - Response: { Kód: int, Popis: string } with HTTP 200/400/401/500
//
// The webhook secret comes from system_settings.pfs_webhook_secret (or env
// var fallback). Comma-separated values are accepted to support secret
// rotation — any one match wins.

const DIC_REGEX = /^\d{10}$/;

type PdsItem = {
  verification_token?: unknown;
  dic?: unknown;
  legalName?: unknown;
  company_email?: unknown;
  company_phone?: unknown;
  created?: unknown;
};

type PdsResponse = { Kód: number; Popis: string };

const POPIS_DEFAULT: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  401: "Unauthorized",
  500: "Server error",
};

function pdsResponse(code: number, popis?: string) {
  const body: PdsResponse = { Kód: code, Popis: popis ?? POPIS_DEFAULT[code] ?? "" };
  return NextResponse.json(body, { status: code });
}

async function verifyPdsSecret(rawBody: string, header: string): Promise<boolean> {
  const secretValue = await getPfsWebhookSecret();
  if (!secretValue) return false;

  const secrets = secretValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (secrets.length === 0) return false;

  // Hex output from SHA-512 is always 128 chars. Compare case-insensitively
  // — spec doesn't pin uppercase vs lowercase. Constant-time across the byte
  // string to avoid timing oracles.
  const headerLower = header.toLowerCase();

  for (const secret of secrets) {
    const expected = createHash("sha512")
      .update(rawBody + secret, "utf8")
      .digest("hex");
    if (
      expected.length === headerLower.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(headerLower))
    ) {
      return true;
    }
  }
  return false;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-pds-secret");
  if (!signature) {
    return pdsResponse(401, "Missing X-PDS-Secret header");
  }

  const rawBody = await request.text();
  if (!(await verifyPdsSecret(rawBody, signature))) {
    return pdsResponse(401, "Invalid signature");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return pdsResponse(400, "Invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    return pdsResponse(400, "Body must be a JSON array");
  }
  if (parsed.length === 0) {
    return pdsResponse(400, "Empty array");
  }

  // Pre-validate every item before we touch the DB so a bad batch fails
  // atomically with a 400 instead of half-committing.
  const items: PdsItem[] = [];
  for (const raw of parsed) {
    if (!isObject(raw)) {
      return pdsResponse(400, "Array items must be JSON objects");
    }
    const item = raw as PdsItem;
    if (
      typeof item.verification_token !== "string" ||
      typeof item.dic !== "string" ||
      typeof item.created !== "string"
    ) {
      return pdsResponse(
        400,
        "Missing required fields: verification_token, dic, created"
      );
    }
    if (!DIC_REGEX.test(item.dic)) {
      return pdsResponse(400, "Invalid DIC format: must be exactly 10 digits");
    }
    items.push(item);
  }

  const supabase = getSupabaseAdmin();

  for (const item of items) {
    const verification_token = item.verification_token as string;
    const dic = item.dic as string;
    const created = item.created as string;
    const legalName =
      typeof item.legalName === "string" ? item.legalName : null;
    const company_email =
      typeof item.company_email === "string" ? item.company_email : null;
    const company_phone =
      typeof item.company_phone === "string" ? item.company_phone : null;

    // 1. Save raw webhook payload (per item — append-only).
    const { error: pfsError } = await supabase.from("pfs_verifications").insert({
      verification_token,
      dic,
      legal_name: legalName,
      company_email,
      company_phone,
      pfs_created_at: created,
    });
    if (pfsError) {
      console.error("[PFS webhook] pfs_verifications insert failed:", pfsError);
      return pdsResponse(500);
    }

    // 2. Upsert company by DIC.
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
          legal_name: legalName,
          company_email,
          company_phone,
          pfs_created_at: created,
          price_per_document: 0.01,
        })
        .select("id")
        .single();
      if (companyError || !newCompany) {
        console.error("[PFS webhook] companies insert failed:", companyError);
        return pdsResponse(500);
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

    // 3. Send genesis admin invitation if email is provided. Failures here
    // must not bust the webhook — the company row is the durable artifact.
    if (company_email) {
      try {
        const result = await createInvitation(supabase, {
          email: company_email,
          roles: ["company_admin"],
          companyIds: [companyId],
          isGenesis: true,
        });

        if (result && !result.alreadyExists) {
          auditInvitationCreated({
            inviteeEmail: company_email,
            roles: ["company_admin"],
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
            roles: ["company_admin"],
            companyNames: [legalName ?? dic],
          });
        }
      } catch (err) {
        console.error("[PFS webhook] invitation send failed (non-fatal):", err);
      }
    }
  }

  return pdsResponse(200);
}
