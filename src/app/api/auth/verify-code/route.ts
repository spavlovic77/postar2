import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyCode } from "@/lib/verification";

export async function POST(request: Request) {
  const { userId, code } = await request.json();

  if (!userId || !code) {
    return NextResponse.json(
      { error: "userId and code are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const valid = await verifyCode(supabase, { userId, code });

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 400 }
    );
  }

  // Confirm the user's email
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to confirm user:", error);
    return NextResponse.json({ error: "Failed to confirm account" }, { status: 500 });
  }

  return NextResponse.json({ message: "Account verified" });
}
