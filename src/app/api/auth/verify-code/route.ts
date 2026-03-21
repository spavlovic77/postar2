import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyCode } from "@/lib/verification";
import { auditOtpVerified, auditSignIn } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { userId, code, phone } = await request.json();

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
    await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    // Upsert profile (with phone if provided)
    await supabase.rpc("upsert_profile", {
      user_id: userId,
      user_full_name: null,
      user_avatar_url: null,
      user_phone: phone ?? null,
    });

    // Generate a session for the user via admin API
    // We create a magic link and exchange it immediately
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);

    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 500 });
    }

    // Generate a one-time link for the user
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error("Failed to generate link:", linkError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Exchange the token for a session using the user's Supabase client
    const cookieStore = await cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: verifyError } = await userClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyError) {
      console.error("Failed to verify OTP session:", verifyError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    auditOtpVerified({ userId, email: user?.email ?? "", request });
    auditSignIn({ userId, email: user?.email ?? "", method: "otp", request });

    return NextResponse.json({ message: "Verified and signed in" });
  } catch (err) {
    console.error("verify-code error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
