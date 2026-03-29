import https from "https";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { topUpWallet } from "@/lib/billing";
import { auditPaymentLinkCreated, auditPaymentReceived } from "@/lib/audit";
import { sendBillingInvoice } from "@/lib/billing-invoice";

// ============================================================
// mTLS helpers
// ============================================================

/**
 * Read a PEM certificate from an environment variable.
 * Supports both direct PEM content and base64-encoded PEM.
 */
function readCertFromEnv(envKey: string): string {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`Missing env var: ${envKey}`);

  if (raw.startsWith("-----BEGIN")) return raw;
  return Buffer.from(raw, "base64").toString("utf8");
}

/**
 * Create an HTTPS agent with mTLS client certificates.
 */
function createMtlsAgent(): https.Agent {
  return new https.Agent({
    cert: readCertFromEnv("KV_CERT"),
    key: readCertFromEnv("KV_KEY"),
    ca: readCertFromEnv("KV_CA_BUNDLE"),
    rejectUnauthorized: false,
  });
}

/**
 * Make an mTLS-authenticated request to the KVERKOM ERP API.
 * Uses Node.js https.request (not fetch) for proper mTLS client cert support.
 */
function kverkomFetch(
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  const apiUrl = process.env.KV_API_URL;
  if (!apiUrl) throw new Error("Missing env var: KV_API_URL");

  const url = new URL(path, apiUrl);
  const agent = createMtlsAgent();

  console.log(`[KVERKOM] ${options.method ?? "GET"} ${url.toString()}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: options.method ?? "GET",
        agent,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
        timeout: 25000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          console.log(`[KVERKOM] ${res.statusCode} ${body.slice(0, 200)}`);
          resolve({
            ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
            status: res.statusCode ?? 500,
            text: async () => body,
            json: async () => JSON.parse(body),
          });
        });
      }
    );

    req.on("error", (err) => {
      console.error(`[KVERKOM] Request error: ${err.message}`);
      reject(err);
    });

    req.on("timeout", () => {
      console.error("[KVERKOM] Request timed out (25s)");
      req.destroy(new Error("KVERKOM request timed out"));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// ============================================================
// Transaction ID Generation
// ============================================================

/**
 * Generate a unique transaction ID from the KVERKOM NOP API.
 * POST /api/v1/generateNewTransactionId
 */
export async function generateTransactionId(): Promise<string> {
  const response = await kverkomFetch("/api/v1/generateNewTransactionId", {
    method: "POST",
    headers: { Date: new Date().toISOString() },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`generateNewTransactionId error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.transaction_id ?? data.transactionId;
}

// ============================================================
// Transaction Status Check (REST polling — replaces MQTT)
// ============================================================

export interface TransactionNotification {
  transactionStatus: string;
  transactionAmount: { currency: string; amount: string };
  endToEndId: string;
  dataIntegrityHash?: string;
  creditorAccount?: { iban: string };
  receivedAt?: string;
}

/**
 * Check if a payment has been confirmed via KVERKOM's getTransactionHistory.
 * Returns the notification if payment is confirmed (status ACCC), or null.
 *
 * The POKLADNICA identifier is extracted from the client certificate CN field:
 *   CN = VATSK-{ico} POKLADNICA {pokladnica}
 */
export async function checkTransactionStatus(
  transactionId: string
): Promise<TransactionNotification | null> {
  // Extract VATSK and POKLADNICA from the certificate for the topic/query
  const cert = readCertFromEnv("KV_CERT");
  const identifiers = extractCertIdentifiers(cert);

  if (!identifiers.pokladnica) {
    console.warn("[PAYMENT] Could not extract POKLADNICA from certificate");
    return null;
  }

  const response = await kverkomFetch(
    `/api/v1/getAllTransactions/${identifiers.pokladnica}`,
    { method: "GET" }
  );

  if (!response.ok) {
    console.error(`[PAYMENT] getAllTransactions error ${response.status}`);
    return null;
  }

  const data = await response.json();

  // Search for our transaction in the history
  const transactions: TransactionNotification[] = Array.isArray(data)
    ? data
    : data.transactions ?? data.items ?? [];

  const match = transactions.find(
    (t) => t.endToEndId === transactionId && t.transactionStatus === "ACCC"
  );

  return match ?? null;
}

/**
 * Check a pending payment link and process it if confirmed.
 * Returns true if payment was confirmed and processed.
 */
export async function checkAndProcessPayment(
  paymentLinkId: string
): Promise<{ confirmed: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: paymentLink } = await supabase
    .from("payment_links")
    .select("id, wallet_id, amount, status, external_transaction_id")
    .eq("id", paymentLinkId)
    .single();

  if (!paymentLink) {
    return { confirmed: false, error: "Payment link not found" };
  }

  if (paymentLink.status === "completed") {
    return { confirmed: true };
  }

  if (paymentLink.status === "expired") {
    return { confirmed: false, error: "Payment link expired" };
  }

  // Check with KVERKOM
  const notification = await checkTransactionStatus(paymentLink.external_transaction_id);

  if (!notification) {
    return { confirmed: false };
  }

  // Payment confirmed — process it
  await supabase
    .from("payment_links")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", paymentLink.id);

  const result = await topUpWallet(paymentLink.wallet_id, paymentLink.amount, {
    type: "qr_payment",
    payment_link_id: paymentLink.id,
    transaction_id: paymentLink.external_transaction_id,
    kverkom_notification: notification,
  });

  if (!result.success) {
    console.error(`[PAYMENT] Top-up failed: ${result.error}`);
    return { confirmed: false, error: result.error };
  }

  auditPaymentReceived({
    walletId: paymentLink.wallet_id,
    amount: paymentLink.amount,
    transactionId: paymentLink.external_transaction_id,
  });

  console.log(`[PAYMENT] ${paymentLink.external_transaction_id} → ${paymentLink.amount} EUR confirmed`);

  // Send billing invoice via Peppol (non-blocking)
  sendBillingInvoice(
    paymentLink.wallet_id,
    paymentLink.amount,
    paymentLink.external_transaction_id
  ).catch((err) => {
    console.error("[PAYMENT] Billing invoice failed (non-fatal):", err);
  });

  return { confirmed: true };
}

// ============================================================
// PayMe.sk URL Construction
// ============================================================

/**
 * Construct a PayMe.sk compatible payment URL.
 */
export function constructPayMeUrl(params: {
  amount: number;
  transactionId: string;
  iban?: string;
  creditorName?: string;
  message?: string;
}): string {
  const iban = params.iban ?? process.env.PAYME_IBAN ?? "";
  const creditorName = params.creditorName ?? process.env.PAYME_CREDITOR_NAME ?? "peppolbox.sk";
  const message = params.message ?? "Wallet top-up";

  // Payment Link Standard v2.0: https://payme.sk/{Version}/{Type}/{SchemeID}?{Attributes}
  // Type /m/ = dynamic QR payment at POI (amount + PI mandatory, DT omitted)
  const urlParams = new URLSearchParams({
    IBAN: iban,
    AM: params.amount.toFixed(2),
    CC: "EUR",
    PI: params.transactionId,
    CN: creditorName,
    MSG: message,
  });

  return `https://payme.sk/2/m/PME?${urlParams.toString()}`;
}

// ============================================================
// Payment Link Creation
// ============================================================

/**
 * Create a payment link for a wallet top-up.
 */
export async function createPaymentLink(params: {
  walletId: string;
  amount: number;
  createdBy: string;
  isPublic?: boolean;
}): Promise<{
  paymentLinkId: string;
  transactionId: string;
  paymeUrl: string;
}> {
  const transactionId = await generateTransactionId();
  const paymeUrl = constructPayMeUrl({
    amount: params.amount,
    transactionId,
  });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("payment_links")
    .insert({
      wallet_id: params.walletId,
      external_transaction_id: transactionId,
      amount: params.amount,
      payme_url: paymeUrl,
      is_public: params.isPublic ?? false,
      created_by: params.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create payment link: ${error?.message}`);
  }

  auditPaymentLinkCreated({
    actorId: params.createdBy,
    walletId: params.walletId,
    amount: params.amount,
    transactionId,
    isPublic: params.isPublic ?? false,
  });

  return {
    paymentLinkId: data.id,
    transactionId,
    paymeUrl,
  };
}

// ============================================================
// Certificate identity extraction
// ============================================================

/**
 * Extract VATSK and POKLADNICA from the client certificate CN field.
 * CN format: "VATSK-1234567890 POKLADNICA 88812345678900001"
 */
function extractCertIdentifiers(certPem: string): {
  vatsk: string | null;
  pokladnica: string | null;
} {
  try {
    const { X509Certificate } = require("crypto");
    const cert = new X509Certificate(certPem);
    const subject = cert.subject as string;

    const cnMatch = subject.match(/CN\s*=\s*VATSK-(\d+)\s+POKLADNICA\s+(\d+)/);

    return {
      vatsk: cnMatch ? cnMatch[1] : null,
      pokladnica: cnMatch ? cnMatch[2] : null,
    };
  } catch {
    return { vatsk: null, pokladnica: null };
  }
}
