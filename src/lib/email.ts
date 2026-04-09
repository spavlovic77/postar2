import { Resend } from "resend";
import { getResendFromEmail } from "@/lib/settings";
import type { DocumentLineDetail } from "@/lib/types";

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
    subject: `${params.code} is your peppolbox.sk verification code`,
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
  roles: string | string[];
  companyNames: string[];
}): Promise<void> {
  const rolesArr = Array.isArray(params.roles) ? params.roles : [params.roles];
  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    company_admin: "Company Admin",
    operator: "Operator",
    processor: "Processor",
  };
  const roleLabel = rolesArr.map((r) => ROLE_LABELS[r] ?? r).join(", ");

  const companiesList = params.companyNames.join(", ");

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject: `You've been invited to peppolbox.sk as ${roleLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're invited to peppolbox.sk</h2>
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
    subject: "Get started with peppolbox.sk — Register your company",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to peppolbox.sk</h2>
        <p>You've been invited to register your company${companyLine} on the peppolbox.sk platform for sending and receiving electronic invoices via the Peppol network.</p>
        <p>To get started, please visit the PFS portal and complete the registration process:</p>
        <a href="${params.activationLink}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Register Your Company
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you have any questions, please contact your peppolbox.sk administrator.
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
    subject: `Action required: Re-onboard ${params.companyName} on peppolbox.sk`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Re-onboarding Request</h2>
        <p>The company <strong>${params.companyName}</strong> needs to be re-onboarded on peppolbox.sk.</p>
        <p>Please visit the PFS portal using the link below and complete the activation process. This will trigger the webhook that registers the company again.</p>
        <a href="${params.activationLink}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Go to PFS Portal
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you didn't expect this email, please contact your peppolbox.sk administrator.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send re-onboarding email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendDocumentReceivedEmail(params: {
  to: string;
  documentId: string;
  documentType?: string;
  supplierName?: string;
  supplierTaxId?: string;
  totalAmount?: string;
  currency?: string;
  dueDate?: string;
  issueDate?: string;
  lineDetails?: DocumentLineDetail[];
  totalLineCount?: number;
}): Promise<void> {
  const resend = getResend();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.peppolbox.sk";
  const directUrl = `/dashboard/inbox/${params.documentId}`;

  // Try to create a magic link for one-click sign-in.
  // Falls back to direct URL (which redirects to sign-in) if user not found.
  const { createMagicLinkForEmail } = await import("@/lib/magic-link");
  const magicUrl = await createMagicLinkForEmail(params.to, directUrl, appUrl);
  const docUrl = magicUrl ?? `${appUrl}${directUrl}`;

  const docType = params.documentType === "CreditNote" ? "Credit Note" : "Invoice";
  const from = params.supplierName ?? params.supplierTaxId ?? "Unknown sender";
  const subject = `New ${docType} received from ${from}`;

  // Build line items rows (max 3)
  const lines = (params.lineDetails ?? []).slice(0, 3);
  const lineRowsHtml = lines
    .map(
      (line) =>
        `<tr>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${escapeHtml(line.name)}</td>
          <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; text-align: right; white-space: nowrap;">
            ${line.amount ? `${escapeHtml(line.amount)} ${escapeHtml(params.currency ?? "")}` : "&mdash;"}
          </td>
        </tr>`
    )
    .join("");

  const totalLines = params.totalLineCount ?? lines.length;
  const moreCount = totalLines - lines.length;
  const moreRow =
    moreCount > 0
      ? `<tr><td colspan="2" style="padding: 6px 12px; font-size: 13px; color: #888;">... and ${moreCount} more item${moreCount > 1 ? "s" : ""}</td></tr>`
      : "";

  const linesTable =
    lines.length > 0
      ? `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineRowsHtml}
            ${moreRow}
          </tbody>
        </table>`
      : "";

  const amountLine = params.totalAmount
    ? `<p style="font-size: 20px; font-weight: 700; margin: 8px 0;">${escapeHtml(params.totalAmount)} ${escapeHtml(params.currency ?? "")}</p>`
    : "";

  const dueLine = params.dueDate
    ? `<p style="color: #666; font-size: 14px;">Due date: <strong>${escapeHtml(params.dueDate)}</strong></p>`
    : "";

  const issueLine = params.issueDate
    ? `<p style="color: #666; font-size: 14px;">Issue date: ${escapeHtml(params.issueDate)}</p>`
    : "";

  const { error } = await resend.emails.send({
    from: await getFromEmail(),
    to: params.to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">New ${escapeHtml(docType)} Received</h2>
        <p style="color: #666; margin-top: 0;">From <strong>${escapeHtml(from)}</strong>${params.supplierTaxId && params.supplierName ? ` (${escapeHtml(params.supplierTaxId)})` : ""}</p>
        ${amountLine}
        ${issueLine}
        ${dueLine}
        ${linesTable}
        <a href="${docUrl}" style="display: inline-block; background: #171717; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 8px;">
          View ${escapeHtml(docType)}
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          This is an automated notification from peppolbox.sk.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send document notification email:", error);
    // Non-fatal: don't throw — document is already processed
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
