import { Resend } from "resend";
import { getResendFromEmail } from "@/lib/settings";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function getFromEmail(): Promise<string> {
  return `Postar <${await getResendFromEmail()}>`;
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
}): Promise<void> {
  const resend = getResend();
  const digits = params.code.split("");

  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject: `${params.code} is your Postar verification code`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; text-align: center;">
        <h2 style="margin-bottom: 8px;">Verification Code</h2>
        <p style="color: #666; margin-bottom: 32px;">Enter this code to verify your account.</p>
        <div style="display: inline-flex; gap: 8px; margin-bottom: 32px;">
          ${digits
            .map(
              (d) =>
                `<span style="display: inline-block; width: 48px; height: 56px; line-height: 56px; font-size: 28px; font-weight: 700; background: #f4f4f5; border-radius: 8px; font-family: monospace;">${d}</span>`
            )
            .join("")}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 5 minutes.</p>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send verification email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendInvitationEmail(params: {
  to: string;
  inviteUrl: string;
  role: string;
  companyNames: string[];
}): Promise<void> {
  const roleLabel =
    params.role === "super_admin"
      ? "Super Admin"
      : params.role === "company_admin"
        ? "Company Admin"
        : "Accountant";

  const companiesList = params.companyNames.join(", ");

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject: `You've been invited to Postar as ${roleLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're invited to Postar</h2>
        <p>You've been invited as <strong>${roleLabel}</strong>${companiesList ? ` for <strong>${companiesList}</strong>` : ""}.</p>
        <p>Click the button below to accept your invitation. This link expires in 48 hours.</p>
        <a href="${params.inviteUrl}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendOnboardingEmail(params: {
  to: string;
  companyName: string | null;
  activationLink: string;
}): Promise<void> {
  const resend = getResend();
  const companyLine = params.companyName
    ? ` for <strong>${params.companyName}</strong>`
    : "";

  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject: "Get started with Postar — Register your company",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to Postar</h2>
        <p>You've been invited to register your company${companyLine} on the Postar platform for sending and receiving electronic invoices via the Peppol network.</p>
        <p>To get started, please visit the PFS portal and complete the registration process:</p>
        <a href="${params.activationLink}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Register Your Company
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you have any questions, please contact your Postar administrator.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send onboarding email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendReonboardingEmail(params: {
  to: string;
  companyName: string;
  activationLink: string;
}): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject: `Action required: Re-onboard ${params.companyName} on Postar`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Re-onboarding Request</h2>
        <p>The company <strong>${params.companyName}</strong> needs to be re-onboarded on Postar.</p>
        <p>Please visit the PFS portal using the link below and complete the activation process. This will trigger the webhook that registers the company again.</p>
        <a href="${params.activationLink}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Go to PFS Portal
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you didn't expect this email, please contact your Postar administrator.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send re-onboarding email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
