import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockStore, createMockSupabaseAdmin } from "./mocks/supabase";

describe("Invitations", () => {
  let store: ReturnType<typeof createMockStore>;
  let mockAdmin: ReturnType<typeof createMockSupabaseAdmin>;

  beforeEach(() => {
    store = createMockStore();
    mockAdmin = createMockSupabaseAdmin(store);
  });

  it("creates invitation for new user and pre-creates auth user", async () => {
    const { createInvitation } = await import("@/lib/invitations");

    const result = await createInvitation(mockAdmin as any, {
      email: "new@example.com",
      role: "company_admin",
      companyIds: ["company-1"],
      isGenesis: true,
    });

    expect(result).toBeTruthy();
    expect(result!.alreadyExists).toBe(false);
    expect(result!.token).toBeTruthy();
    expect(store.authUsers.length).toBe(1);
    expect(store.authUsers[0].email).toBe("new@example.com");
    expect(store.authUsers[0].email_confirmed_at).toBeTruthy();
    expect(store.invitations.length).toBe(1);
  });

  it("creates invitation for existing user without pre-creating", async () => {
    const { createInvitation } = await import("@/lib/invitations");

    store.authUsers.push({
      id: "existing-user",
      email: "existing@example.com",
      email_confirmed_at: new Date().toISOString(),
    });

    const result = await createInvitation(mockAdmin as any, {
      email: "existing@example.com",
      role: "accountant",
      companyIds: ["company-1"],
    });

    expect(result).toBeTruthy();
    expect(result!.alreadyExists).toBe(false);
    expect(store.authUsers.length).toBe(1);
  });

  it("skips genesis invite if already genesis member", async () => {
    const { createInvitation } = await import("@/lib/invitations");

    store.authUsers.push({
      id: "user-1",
      email: "admin@example.com",
      email_confirmed_at: new Date().toISOString(),
    });

    store.companyMemberships.push({
      id: "m-1",
      user_id: "user-1",
      company_id: "company-1",
      role: "company_admin",
      is_genesis: true,
      status: "active",
    });

    const result = await createInvitation(mockAdmin as any, {
      email: "admin@example.com",
      role: "company_admin",
      companyIds: ["company-1"],
      isGenesis: true,
    });

    expect(result!.alreadyExists).toBe(true);
    expect(store.invitations.length).toBe(0);
  });

  it("generates magic link URL", async () => {
    const { getInviteUrl } = await import("@/lib/invitations");
    const url = getInviteUrl("abc123", "https://postar.app");
    expect(url).toBe("https://postar.app/invite/abc123/accept");
  });
});
