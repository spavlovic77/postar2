/**
 * Drop into postar2 as e.g. `src/lib/push.ts`. Used by the peppol-receive
 * worker to fan out a single push per active company member after a new
 * Document row is committed.
 *
 * Uses the Expo Push API directly (no Expo Server SDK needed). Requires:
 *   - device_tokens table populated by the mobile client (see migration)
 *   - service-role Supabase client (RLS bypass) to read other users' tokens
 *
 * Mobile expects `data.docId` so the tap-handler can deep-link straight to
 * the detail screen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushBody = {
  docId: string;
  companyId: string;
  supplierName: string | null;
  totalAmount: string | null;
  currency: string | null;
};

type ExpoMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: { docId: string };
  channelId?: string;
};

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
  return amount
    ? `Od ${supplier} — ${amount}`
    : `Od ${supplier}`;
}

/**
 * Notify every active member (any role — admin, member, processor) of the
 * receiving company about a new invoice. Per product spec, only
 * COMPANY-LEVEL members are targeted; department_memberships are ignored.
 *
 * Failures here must NOT bust the surrounding peppol-receive transaction —
 * a delivered invoice with no push is much better than a dropped invoice.
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
      .eq("status", "active");
    if (memErr || !members?.length) return;

    const userIds = Array.from(new Set(members.map((m) => m.user_id)));
    const { data: tokens, error: tokErr } = await supabaseAdmin
      .from("device_tokens")
      .select("expo_token, platform")
      .in("user_id", userIds);
    if (tokErr || !tokens?.length) return;

    const message = buildBody(body);
    const payload: ExpoMessage[] = tokens.map((t) => ({
      to: t.expo_token,
      sound: "default",
      title: "Nová faktúra",
      body: message,
      data: { docId: body.docId },
      ...(t.platform === "android" ? { channelId: "default" } : {}),
    }));

    // Expo accepts up to 100 messages per request. Chunk for safety.
    const CHUNK = 100;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const slice = payload.slice(i, i + CHUNK);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(slice),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          "[push] Expo push API non-2xx:",
          res.status,
          text.slice(0, 200)
        );
        continue;
      }
      // Optional: parse `data[i].status === 'error'` and prune dead tokens.
      // Expo returns DeviceNotRegistered for tokens we should delete from
      // device_tokens — worth wiring up in a v1.1 cleanup pass.
    }
  } catch (e) {
    console.warn("[push] sendNewInvoicePush failed:", e);
  }
}
