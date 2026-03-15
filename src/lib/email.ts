import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { error } = await resend.emails.send({
    from: `Postar <${process.env.RESEND_FROM_EMAIL!}>`,
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
