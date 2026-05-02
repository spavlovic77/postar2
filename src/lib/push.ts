import http2 from "node:http2";
import { SignJWT, importPKCS8 } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";

const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const APNS_HOST_DEFAULT = "api.push.apple.com";
const APNS_BUNDLE_DEFAULT = "sk.epodatelna24.mobile";

type PushBody = {
  docId: string;
  companyId: string;
  supplierName: string | null;
  totalAmount: string | null;
  currency: string | null;
};

type DeviceRow = {
  expo_token: string;
  platform: "ios" | "android";
};

let apnsJwtCache: { token: string; iat: number } | null = null;
let fcmTokenCache: {
  token: string;
  expiresAt: number;
  projectId: string;
} | null = null;

function formatAmount(value: string | null, currency: string | null): string {
  if (!value) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  const formatted = num.toLocaleString("sk-SK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const c = currency ?? "EUR";
  return c === "EUR" ? `${formatted} €` : `${formatted} ${c}`;
}

function buildBody(p: PushBody): string {
  const supplier = p.supplierName?.trim() || "neznámy dodávateľ";
  const amount = formatAmount(p.totalAmount, p.currency);
  return amount ? `Od ${supplier} — ${amount}` : `Od ${supplier}`;
}

function normalizePem(raw: string): string {
  // Vercel UI strips real newlines; the conventional escape is `\n`.
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

async function getApnsJwt(): Promise<string | null> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPem = process.env.APNS_AUTH_KEY;
  if (!keyId || !teamId || !keyPem) return null;

  const now = Math.floor(Date.now() / 1000);
  // APNs caps JWT lifetime at 1h. Refresh every 55min to stay safe.
  if (apnsJwtCache && now - apnsJwtCache.iat < 55 * 60) {
    return apnsJwtCache.token;
  }
  const key = await importPKCS8(normalizePem(keyPem), "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(key);
  apnsJwtCache = { token: jwt, iat: now };
  return jwt;
}

async function getFcmAccess(): Promise<{ token: string; projectId: string } | null> {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  let sa: { client_email: string; private_key: string; private_key_id: string; project_id: string };
  try {
    // Accept either raw JSON or base64-encoded JSON.
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    sa = JSON.parse(decoded);
  } catch (e) {
    console.warn("[push] FCM_SERVICE_ACCOUNT_JSON parse failed:", e);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (fcmTokenCache && fcmTokenCache.expiresAt > now + 60) {
    return { token: fcmTokenCache.token, projectId: fcmTokenCache.projectId };
  }

  const key = await importPKCS8(normalizePem(sa.private_key), "RS256");
  const assertion = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256", kid: sa.private_key_id })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(FCM_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(FCM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    console.warn("[push] FCM token exchange failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  fcmTokenCache = {
    token: json.access_token,
    expiresAt: now + json.expires_in,
    projectId: sa.project_id,
  };
  return { token: json.access_token, projectId: sa.project_id };
}

type PushResult = { ok: boolean; isInvalid: boolean };

async function sendApnsBatch(
  tokens: string[],
  body: PushBody,
  jwt: string
): Promise<Map<string, PushResult>> {
  const host = process.env.APNS_HOST ?? APNS_HOST_DEFAULT;
  const bundleId = process.env.APNS_BUNDLE_ID ?? APNS_BUNDLE_DEFAULT;
  const results = new Map<string, PushResult>();

  const client = http2.connect(`https://${host}`);
  const closeClient = () => {
    try { client.close(); } catch { /* noop */ }
  };
  client.on("error", (e) => console.warn("[push] APNs h2 error:", e.message));

  const payload = JSON.stringify({
    aps: {
      alert: { title: "Nová faktúra", body: buildBody(body) },
      sound: "default",
    },
    docId: body.docId,
  });

  await Promise.all(
    tokens.map(
      (token) =>
        new Promise<void>((resolve) => {
          const req = client.request({
            ":method": "POST",
            ":path": `/3/device/${token}`,
            "apns-topic": bundleId,
            "apns-push-type": "alert",
            "apns-priority": "10",
            authorization: `bearer ${jwt}`,
            "content-type": "application/json",
          });
          let status = 0;
          let respBody = "";
          req.on("response", (headers) => {
            status = Number(headers[":status"]);
          });
          req.setEncoding("utf8");
          req.on("data", (chunk: string) => {
            respBody += chunk;
          });
          req.on("end", () => {
            const ok = status === 200;
            // 410 Unregistered or 400 BadDeviceToken → token is dead.
            const isInvalid =
              status === 410 ||
              (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(respBody));
            results.set(token, { ok, isInvalid });
            if (!ok) {
              console.warn(`[push] APNs ${status} for token ${token.slice(0, 8)}…:`, respBody.slice(0, 200));
            }
            resolve();
          });
          req.on("error", (e) => {
            console.warn("[push] APNs stream error:", e.message);
            results.set(token, { ok: false, isInvalid: false });
            resolve();
          });
          req.end(payload);
        })
    )
  );

  closeClient();
  return results;
}

async function sendFcmOne(
  token: string,
  body: PushBody,
  oauth: string,
  projectId: string
): Promise<PushResult> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: "Nová faktúra", body: buildBody(body) },
          data: { docId: body.docId },
          android: {
            priority: "high",
            notification: { channel_id: "default", color: "#3162FF" },
          },
        },
      }),
    }
  );
  if (res.ok) return { ok: true, isInvalid: false };
  const text = await res.text().catch(() => "");
  const isInvalid =
    res.status === 404 ||
    (res.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(text));
  console.warn(`[push] FCM ${res.status} for token ${token.slice(0, 8)}…:`, text.slice(0, 200));
  return { ok: false, isInvalid };
}

async function pruneDeadTokens(
  supabaseAdmin: SupabaseClient,
  dead: string[]
): Promise<void> {
  if (!dead.length) return;
  const { error } = await supabaseAdmin
    .from("device_tokens")
    .delete()
    .in("expo_token", dead);
  if (error) console.warn("[push] dead-token prune failed:", error.message);
}

/**
 * Notify every active company_admin of the receiving company about a new
 * invoice. Sends directly to APNs (HTTP/2) for iOS and FCM v1 for Android.
 *
 * Failures must NOT bust the surrounding peppol-receive transaction — a
 * delivered invoice with no push is much better than a dropped invoice.
 * Catch + log; never throw.
 */
export async function sendNewInvoicePush(
  supabaseAdmin: SupabaseClient,
  body: PushBody
): Promise<void> {
  try {
    const { data: members, error: memErr } = await supabaseAdmin
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", body.companyId)
      .eq("status", "active")
      .eq("role", "company_admin");
    if (memErr || !members?.length) return;

    const userIds = Array.from(new Set(members.map((m) => m.user_id)));
    const { data: tokens, error: tokErr } = await supabaseAdmin
      .from("device_tokens")
      .select("expo_token, platform")
      .in("user_id", userIds);
    if (tokErr || !tokens?.length) return;

    const rows = tokens as DeviceRow[];
    const ios = rows.filter((r) => r.platform === "ios").map((r) => r.expo_token);
    const android = rows.filter((r) => r.platform === "android").map((r) => r.expo_token);

    const dead: string[] = [];

    if (ios.length) {
      const jwt = await getApnsJwt();
      if (jwt) {
        const results = await sendApnsBatch(ios, body, jwt);
        for (const [token, r] of results) if (r.isInvalid) dead.push(token);
      } else {
        console.warn("[push] APNs not configured (APNS_AUTH_KEY/KEY_ID/TEAM_ID missing)");
      }
    }

    if (android.length) {
      const fcm = await getFcmAccess();
      if (fcm) {
        const results = await Promise.all(
          android.map((t) => sendFcmOne(t, body, fcm.token, fcm.projectId))
        );
        android.forEach((t, i) => {
          if (results[i].isInvalid) dead.push(t);
        });
      } else {
        console.warn("[push] FCM not configured (FCM_SERVICE_ACCOUNT_JSON missing)");
      }
    }

    await pruneDeadTokens(supabaseAdmin, dead);
  } catch (e) {
    console.warn("[push] sendNewInvoicePush failed:", e);
  }
}
