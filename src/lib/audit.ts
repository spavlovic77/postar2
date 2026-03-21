import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Severity = "info" | "warning" | "error";

interface AuditEvent {
  eventId: string;
  eventName: string;
  severity?: Severity;
  actorId?: string | null;
  actorEmail?: string | null;
  companyId?: string | null;
  companyDic?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

// CEF severity mapping
const CEF_SEVERITY: Record<Severity, number> = {
  info: 3,
  warning: 6,
  error: 9,
};

function escapeField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function escapeExtValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=");
}

function buildCef(event: AuditEvent): string {
  const severity = event.severity ?? "info";
  const header = [
    "CEF:0",
    "Postar",
    "Postar",
    "1.0",
    escapeField(event.eventId),
    escapeField(event.eventName),
    CEF_SEVERITY[severity],
  ].join("|");

  const ext: string[] = [];
  ext.push(`rt=${new Date().toISOString()}`);

  if (event.actorId) ext.push(`suid=${escapeExtValue(event.actorId)}`);
  if (event.actorEmail) ext.push(`suser=${escapeExtValue(event.actorEmail)}`);
  if (event.companyDic) ext.push(`cs1=${escapeExtValue(event.companyDic)}`);
  if (event.companyDic) ext.push(`cs1Label=CompanyDIC`);
  if (event.companyId) ext.push(`cs2=${escapeExtValue(event.companyId)}`);
  if (event.companyId) ext.push(`cs2Label=CompanyID`);
  if (event.sourceIp) ext.push(`src=${escapeExtValue(event.sourceIp)}`);
  if (event.userAgent) ext.push(`requestClientApplication=${escapeExtValue(event.userAgent)}`);

  if (event.details) {
    ext.push(`cs3=${escapeExtValue(JSON.stringify(event.details))}`);
    ext.push(`cs3Label=Details`);
  }

  return `${header}|${ext.join(" ")}`;
}

/**
 * Log an audit event. Fire-and-forget — never throws, never blocks.
 */
export function audit(event: AuditEvent): void {
  const cef = buildCef(event);

  // Fire-and-forget: don't await, don't block the caller
  const supabase = getSupabaseAdmin();
  supabase
    .from("audit_logs")
    .insert({
      event_id: event.eventId,
      event_name: event.eventName,
      severity: event.severity ?? "info",
      actor_id: event.actorId ?? null,
      actor_email: event.actorEmail ?? null,
      company_id: event.companyId ?? null,
      company_dic: event.companyDic ?? null,
      source_ip: event.sourceIp ?? null,
      user_agent: event.userAgent ?? null,
      details: event.details ?? {},
      cef,
    })
    .then(({ error }) => {
      if (error) {
        console.error("[AUDIT] Failed to write audit log:", error.message, cef);
      }
    });
}

// ============================================================
// Predefined event helpers
// ============================================================

function getRequestMeta(request?: Request) {
  if (!request) return { sourceIp: null, userAgent: null };
  return {
    sourceIp:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent") ?? null,
  };
}

export function auditSignIn(params: {
  userId: string;
  email: string;
  method: "google" | "apple" | "otp" | "magic_link";
  request?: Request;
}) {
  const meta = getRequestMeta(params.request);
  audit({
    eventId: "AUTH_SIGN_IN",
    eventName: "User signed in",
    actorId: params.userId,
    actorEmail: params.email,
    details: { method: params.method },
    ...meta,
  });
}

export function auditSignOut(params: {
  userId: string;
  email: string;
}) {
  audit({
    eventId: "AUTH_SIGN_OUT",
    eventName: "User signed out",
    actorId: params.userId,
    actorEmail: params.email,
  });
}

export function auditOtpSent(params: {
  userId: string;
  email: string;
  channel: "email" | "sms";
  destination: string;
  request?: Request;
}) {
  const meta = getRequestMeta(params.request);
  audit({
    eventId: "AUTH_OTP_SENT",
    eventName: "OTP code sent",
    actorId: params.userId,
    actorEmail: params.email,
    details: { channel: params.channel, destination: params.destination },
    ...meta,
  });
}

export function auditOtpVerified(params: {
  userId: string;
  email: string;
  request?: Request;
}) {
  const meta = getRequestMeta(params.request);
  audit({
    eventId: "AUTH_OTP_VERIFIED",
    eventName: "OTP code verified",
    actorId: params.userId,
    actorEmail: params.email,
    ...meta,
  });
}

export function auditInvitationCreated(params: {
  actorId?: string | null;
  actorEmail?: string | null;
  inviteeEmail: string;
  role: string;
  companyId?: string | null;
  companyDic?: string | null;
  isGenesis: boolean;
}) {
  audit({
    eventId: "INVITE_CREATED",
    eventName: "Invitation created",
    actorId: params.actorId ?? undefined,
    actorEmail: params.actorEmail ?? undefined,
    companyId: params.companyId ?? undefined,
    companyDic: params.companyDic ?? undefined,
    details: {
      inviteeEmail: params.inviteeEmail,
      role: params.role,
      isGenesis: params.isGenesis,
    },
  });
}

export function auditInvitationAccepted(params: {
  userId: string;
  email: string;
  role: string;
  companyId?: string | null;
  companyDic?: string | null;
  request?: Request;
}) {
  const meta = getRequestMeta(params.request);
  audit({
    eventId: "INVITE_ACCEPTED",
    eventName: "Invitation accepted",
    actorId: params.userId,
    actorEmail: params.email,
    companyId: params.companyId ?? undefined,
    companyDic: params.companyDic ?? undefined,
    details: { role: params.role },
    ...meta,
  });
}

export function auditMembershipCreated(params: {
  actorId?: string | null;
  userId: string;
  email: string;
  role: string;
  companyId: string;
  companyDic?: string | null;
  isGenesis: boolean;
}) {
  audit({
    eventId: "MEMBERSHIP_CREATED",
    eventName: "Company membership created",
    actorId: params.actorId ?? undefined,
    companyId: params.companyId,
    companyDic: params.companyDic ?? undefined,
    details: {
      userId: params.userId,
      email: params.email,
      role: params.role,
      isGenesis: params.isGenesis,
    },
  });
}

export function auditMembershipDeactivated(params: {
  actorId: string;
  actorEmail: string;
  userId: string;
  companyId: string;
  companyDic?: string | null;
}) {
  audit({
    eventId: "MEMBERSHIP_DEACTIVATED",
    eventName: "Company membership deactivated",
    severity: "warning",
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    companyId: params.companyId,
    companyDic: params.companyDic ?? undefined,
    details: { deactivatedUserId: params.userId },
  });
}

export function auditWebhookReceived(params: {
  dic: string;
  companyId?: string | null;
  verificationToken: string;
  isNewCompany: boolean;
  request?: Request;
}) {
  const meta = getRequestMeta(params.request);
  audit({
    eventId: "WEBHOOK_RECEIVED",
    eventName: "PFS webhook received",
    companyDic: params.dic,
    companyId: params.companyId ?? undefined,
    details: {
      verificationToken: params.verificationToken,
      isNewCompany: params.isNewCompany,
    },
    ...meta,
  });
}

export function auditProfileUpdated(params: {
  userId: string;
  email: string;
  changes: Record<string, unknown>;
}) {
  audit({
    eventId: "PROFILE_UPDATED",
    eventName: "Profile updated",
    actorId: params.userId,
    actorEmail: params.email,
    details: params.changes,
  });
}

export function auditOnboarded(params: {
  userId: string;
  email: string;
}) {
  audit({
    eventId: "USER_ONBOARDED",
    eventName: "User completed onboarding",
    actorId: params.userId,
    actorEmail: params.email,
  });
}

export function auditSuperAdminGranted(params: {
  actorId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
}) {
  audit({
    eventId: "SUPER_ADMIN_GRANTED",
    eventName: "Super admin role granted",
    severity: "warning",
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    details: {
      targetUserId: params.targetUserId,
      targetEmail: params.targetEmail,
    },
  });
}
