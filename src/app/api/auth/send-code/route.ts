import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationCodeEmail } from "@/lib/email";
import { sendSmsCode } from "@/lib/sms";

export async function POST(request: Request) {
  try {
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

    // Try to create the user. If they already exist, createUser will fail.
    let userId: string;

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (createError) {
      // User likely already exists
      if (createError.message?.includes("already been registered")) {
        // Find existing user via admin API
        const { data: { users } } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const existing = users?.find((u) => u.email === email);

        if (!existing) {
          return NextResponse.json(
            { error: "Failed to find existing account" },
            { status: 500 }
          );
        }

        if (existing.email_confirmed_at) {
          return NextResponse.json(
            { error: "This email is already registered. Please sign in." },
            { status: 409 }
          );
        }

        // Update password for unconfirmed user
        await supabase.auth.admin.updateUserById(existing.id, { password });
        userId = existing.id;
      } else {
        console.error("Failed to create user:", createError);
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 }
        );
      }
    } else {
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
    if (channel === "email") {
      await sendVerificationCodeEmail({ to: email, code });
    } else {
      await sendSmsCode({ to: phone, code });
    }

    return NextResponse.json({
      message: `Verification code sent via ${channel}`,
      userId,
    });
  } catch (err) {
    console.error("send-code error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
