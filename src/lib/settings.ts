import { getSupabaseAdmin } from "@/lib/supabase/admin";

// In-memory cache (per server instance, refreshed every 60s)
let cache: Record<string, string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Get all system settings as a key-value map.
 * Cached in memory for 60 seconds to avoid DB hits on every request.
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("system_settings")
    .select("key, value");

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  cache = settings;
  cacheExpiry = now + CACHE_TTL;

  return settings;
}

/**
 * Get a single setting. Falls back to env var, then default.
 */
export async function getSetting(
  key: string,
  envFallback?: string,
  defaultValue = ""
): Promise<string> {
  const settings = await getSystemSettings();
  const dbValue = settings[key];

  // Use DB value if non-empty
  if (dbValue) return dbValue;

  // Fall back to env var
  if (envFallback && process.env[envFallback]) {
    return process.env[envFallback]!;
  }

  return defaultValue;
}

/**
 * Update a system setting.
 */
export async function updateSetting(
  key: string,
  value: string,
  userId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from("system_settings")
    .upsert({
      key,
      value,
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    });

  // Invalidate cache
  cache = null;
}

/**
 * Invalidate the settings cache (call after updates).
 */
export function invalidateSettingsCache(): void {
  cache = null;
}

// ============================================================
// Convenience getters for specific settings
// ============================================================

export async function getResendFromEmail(): Promise<string> {
  return getSetting("resend_from_email", "RESEND_FROM_EMAIL", "noreply@postar.app");
}

export async function getPfsWebhookSecret(): Promise<string> {
  return getSetting("pfs_webhook_secret", "PFS_WEBHOOK_SECRET", "");
}

export async function getPfsActivationLink(): Promise<string> {
  return getSetting("pfs_activation_link");
}

export async function getIonApBaseUrl(): Promise<string> {
  return getSetting("ion_ap_base_url", "ION_AP_BASE_URL", "https://test.ion-ap.net");
}

export async function getIonApApiToken(): Promise<string> {
  return getSetting("ion_ap_api_token", "ION_AP_API_TOKEN", "");
}

export async function getTwilioPhoneNumber(): Promise<string> {
  return getSetting("twilio_phone_number", "TWILIO_PHONE_NUMBER", "");
}

/**
 * Welcome credit added to a wallet on first Peppol activation.
 * Configurable in EUR. Default 0.03 EUR. Set to 0 to disable.
 */
export async function getWelcomeCreditAmount(): Promise<number> {
  const v = await getSetting("welcome_credit_amount", undefined, "0.03");
  const num = parseFloat(v);
  return isNaN(num) || num < 0 ? 0 : num;
}
