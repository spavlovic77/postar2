import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCodeEmail } from "@/lib/email";
import { sendSmsCode } from "@/lib/sms";
import { auditOtpSent } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { email, channel, phone } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!channel || !["email", "sms"].includes(channel)) {
      return NextResponse.json(
        { error: "Channel must be 'email' or 'sms'" },
        { status: 400 }
      );
    }

    if (channel === "sms" && !phone) {
      return NextResponse.json(
        { error: "Phone number is required for SMS verification" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find or create user
    let userId: string;
    let isNewUser = false;
    let storedPhone: string | null = null;

    // Try to create. If exists, will fail.
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: randomBytes(32).toString("hex"),
        email_confirm: false,
      });

    if (createError) {
      if (!createError.message?.includes("already been registered")) {
        console.error("Failed to create user:", createError);
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 }
        );
      }

      // Existing user — find them
      const { data: { users } } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existing = users?.find((u) => u.email === email);

      if (!existing) {
        return NextResponse.json(
          { error: "Failed to find account" },
          { status: 500 }
        );
      }

      userId = existing.id;

      // Get their stored phone from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .single();

      storedPhone = profile?.phone ?? null;

      // For existing users with a phone, SMS must go to their stored phone
      if (channel === "sms" && storedPhone && phone !== storedPhone) {
        const masked = storedPhone.slice(-4).padStart(storedPhone.length, "*");
        return NextResponse.json(
          { error: `SMS can only be sent to your registered phone ending in ${masked}` },
          { status: 400 }
        );
      }
    } else {
      userId = newUser.user.id;
      isNewUser = true;
    }

    // Generate and store code
    const destination = channel === "email" ? email : phone;
    const code = await createVerificationCode(supabase, {
      userId,
      channel,
      destination,
    });

    // Send code
    if (channel === "email") {
      await sendVerificationCodeEmail({ to: email, code });
    } else {
      await sendSmsCode({ to: phone, code });
    }

    auditOtpSent({
      userId,
      email,
      channel,
      destination: channel === "email" ? email : phone,
      request,
    });

    // Return masked phone for existing users (so UI can show "Send to ***1234")
    return NextResponse.json({
      message: `Verification code sent via ${channel}`,
      userId,
      isNewUser,
      hasPhone: !!storedPhone,
      maskedPhone: storedPhone
        ? `****${storedPhone.slice(-4)}`
        : null,
    });
  } catch (err) {
    console.error("send-code error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
