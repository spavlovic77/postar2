import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function createVerificationCode(
  supabase: SupabaseClient,
  params: {
    userId: string;
    channel: "email" | "sms";
    destination: string;
  }
): Promise<string> {
  const code = generateCode();

  // Invalidate any existing unused codes for this user
  await supabase
    .from("verification_codes")
    .delete()
    .eq("user_id", params.userId)
    .is("verified_at", null);

  const { error } = await supabase.from("verification_codes").insert({
    user_id: params.userId,
    code,
    channel: params.channel,
    destination: params.destination,
  });

  if (error) {
    throw new Error(`Failed to create verification code: ${error.message}`);
  }

  return code;
}

export async function verifyCode(
  supabase: SupabaseClient,
  params: {
    userId: string;
    code: string;
  }
): Promise<boolean> {
  const { data } = await supabase
    .from("verification_codes")
    .select("id, expires_at")
    .eq("user_id", params.userId)
    .eq("code", params.code)
    .is("verified_at", null)
    .single();

  if (!data) return false;

  if (new Date(data.expires_at) < new Date()) return false;

  // Mark as verified
  await supabase
    .from("verification_codes")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", data.id);

  return true;
}
