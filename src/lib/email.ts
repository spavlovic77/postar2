/**
 * Send an invitation email.
 * TODO: Replace with actual email provider (Resend, SendGrid, etc.)
 */
export async function sendInvitationEmail(params: {
  to: string;
  inviteUrl: string;
  role: string;
  companyNames: string[];
}): Promise<void> {
  // Placeholder — log to console until email provider is configured
  console.log("[EMAIL] Invitation email:", {
    to: params.to,
    inviteUrl: params.inviteUrl,
    role: params.role,
    companies: params.companyNames,
  });
}
