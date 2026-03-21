import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockStore, createMockSupabaseAdmin } from "./mocks/supabase";

let store: ReturnType<typeof createMockStore>;
let mockAdmin: ReturnType<typeof createMockSupabaseAdmin>;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdmin,
}));

beforeEach(() => {
  store = createMockStore();
  mockAdmin = createMockSupabaseAdmin(store);
});

describe("Invitations", () => {
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

    // User should be pre-created with email_confirm: true
    expect(store.authUsers.length).toBe(1);
    expect(store.authUsers[0].email).toBe("new@example.com");
    expect(store.authUsers[0].email_confirmed_at).toBeTruthy();

    // Invitation should be stored
    expect(store.invitations.length).toBe(1);
    expect(store.invitations[0].role).toBe("company_admin");
    expect(store.invitations[0].is_genesis).toBe(true);
  });

  it("creates invitation for existing user without pre-creating", async () => {
    const { createInvitation } = await import("@/lib/invitations");

    // Pre-existing user
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
    // Should not create duplicate user
    expect(store.authUsers.length).toBe(1);
  });

  it("skips genesis invite if user already has genesis membership", async () => {
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

    expect(result).toBeTruthy();
    expect(result!.alreadyExists).toBe(true);
    // No new invitation created
    expect(store.invitations.length).toBe(0);
  });

  it("generates correct invite URL (always magic link)", async () => {
    const { getInviteUrl } = await import("@/lib/invitations");

    const url = getInviteUrl("abc123", "https://postar.app");
    expect(url).toBe("https://postar.app/invite/abc123/accept");
  });
});
