import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCodeEmail } from "@/lib/email";
import { sendSmsCode } from "@/lib/sms";

export async function POST(request: Request) {
  const { email, password, channel, phone } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
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

  // Create the user (unconfirmed) via admin API
  // If user already exists but is unconfirmed, we re-send the code
  let userId: string;

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  if (existing) {
    if (existing.email_confirmed_at) {
      return NextResponse.json(
        { error: "This email is already registered. Please sign in." },
        { status: 409 }
      );
    }
    // Update password for unconfirmed user in case they changed it
    await supabase.auth.admin.updateUserById(existing.id, { password });
    userId = existing.id;
  } else {
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (createError || !newUser.user) {
      console.error("Failed to create user:", createError);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
    userId = newUser.user.id;
  }

  // Generate and store code
  const destination = channel === "email" ? email : phone;
  const code = await createVerificationCode(supabase, {
    userId,
    channel,
    destination,
  });

  // Send code
  try {
    if (channel === "email") {
      await sendVerificationCodeEmail({ to: email, code });
    } else {
      await sendSmsCode({ to: phone, code });
    }
  } catch (err) {
    console.error("Failed to send verification code:", err);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Verification code sent via ${channel}`,
    userId,
  });
}
