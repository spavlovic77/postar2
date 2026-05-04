import { describe, it, expect, vi } from "vitest";
import { createHash } from "crypto";

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

describe("PFS Webhook (PDS spec)", () => {
  const SECRET = "test-webhook-secret";

  function pdsSign(rawBody: string): string {
    return createHash("sha512").update(rawBody + SECRET, "utf8").digest("hex");
  }

  function makeRequest(body: string, signature?: string): Request {
    return new Request("https://postar.app/api/webhooks/pfs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-pds-secret": signature } : {}),
      },
      body,
    });
  }

  const validItem = {
    verification_token: "abc-123",
    dic: "1234567890",
    legalName: "Test Company s.r.o.",
    company_email: "admin@test.com",
    company_phone: "+421900123456",
    created: "2026-01-01T00:00:00Z",
  };

  it("rejects request without X-PDS-Secret header", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([validItem]);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.Kód).toBe(401);
  });

  it("rejects request with invalid signature", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([validItem]);
    const res = await POST(
      makeRequest(body, "0".repeat(128)) // wrong but well-formed hex
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.Kód).toBe(401);
  });

  it("accepts uppercase hex signature (case-insensitive compare)", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([validItem]);
    const sig = pdsSign(body).toUpperCase();
    const res = await POST(makeRequest(body, sig));
    expect(res.status).toBe(200);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = "not json";
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects non-array body", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify(validItem); // single object, not array
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.Popis).toContain("array");
  });

  it("rejects empty array", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([{ dic: "1234567890" }]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
  });

  it("rejects invalid DIC format", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([{ ...validItem, dic: "123" }]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
  });

  it("accepts valid single-element array", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([validItem]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.Kód).toBe(200);
    expect(json.Popis).toBe("OK");
  });

  it("accepts multi-element array (batch)", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([
      validItem,
      { ...validItem, dic: "9876543210", company_email: "two@test.com" },
    ]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(200);
  });

  it("rejects batch where any item is invalid (atomic 400)", async () => {
    const { POST } = await import("@/app/api/webhooks/pfs/route");
    const body = JSON.stringify([validItem, { ...validItem, dic: "bad" }]);
    const res = await POST(makeRequest(body, pdsSign(body)));
    expect(res.status).toBe(400);
  });
});
