import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/settings", () => ({
  getPfsWebhookSecret: vi.fn(() => Promise.resolve("test-webhook-secret")),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "pfs_verifications") {
        return { insert: () => ({ error: null }) };
      }
      if (table === "companies") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: null, error: { message: "not found" } }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => ({ data: { id: "new-company-id" }, error: null }),
            }),
          }),
        };
      }
      if (table === "audit_logs") {
        return { insert: () => ({ then: (r: any) => r({ error: null }) }) };
      }
      return {
        insert: vi.fn(() => ({ error: null })),
        select: vi.fn(),
      };
    },
    auth: {
      admin: {
        createUser: vi.fn(() => ({
          data: { user: { id: "new-user-id" } },
          error: null,
        })),
        listUsers: vi.fn(() => ({
          data: { users: [] },
        })),
      },
    },
  }),
}));

vi.mock("@/lib/invitations", () => ({
  createInvitation: vi.fn(() => ({ token: "test-token", alreadyExists: false })),
  getInviteUrl: vi.fn(() => "https://postar.app/invite/test-token/accept"),
}));

vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  auditWebhookReceived: vi.fn(),
  auditInvitationCreated: vi.fn(),
}));

describe("PFS Webhook", () => {
  const SECRET = "test-webhook-secret";

  function sign(body: string): string {
    return createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
  }

  function makeRequest(body: string, signature?: string): Request {
    return new Request("https://postar.app/api/webhooks/pfs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-pfs-signature": signature } : {}),
      },
      body,
    });
  }

  it("rejects request without signature", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(401);
  });

  it("rejects request with invalid signature", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify({ verification_token: "t", dic: "1234567890", created: "2026-01-01T00:00:00Z" });
    const res = await POST(makeRequest(body, "invalid-signature"));
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = "not json";
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify({ dic: "1234567890" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects invalid DIC format", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify({
      verification_token: "t",
      dic: "123",
      created: "2026-01-01T00:00:00Z",
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
  });

  it("accepts valid webhook payload", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify({
      verification_token: "abc-123",
      dic: "1234567890",
      legalName: "Test Company s.r.o.",
      company_email: "admin@test.com",
      company_phone: "+421900123456",
      created: "2026-01-01T00:00:00Z",
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(201);
  });
});
