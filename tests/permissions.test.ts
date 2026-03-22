import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockStore, createMockSupabaseAdmin } from "./mocks/supabase";

// Shared state
let store = createMockStore();
let mockAdmin = createMockSupabaseAdmin(store);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mockAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: "current-user", email: "current@example.com" } },
      })),
    },
  }),
}));

vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  auditInvitationCreated: vi.fn(),
  auditMembershipDeactivated: vi.fn(),
  auditProfileUpdated: vi.fn(),
  auditOnboarded: vi.fn(),
}));

describe("Permission checks", () => {
  beforeEach(() => {
    store = createMockStore();
    mockAdmin = createMockSupabaseAdmin(store);
  });

  describe("deactivateMembership", () => {
    it("super admin can deactivate anyone", async () => {
      store.profiles["current-user"] = { id: "current-user", is_super_admin: true };
      store.companyMemberships.push({
        id: "m-1", user_id: "other-user", company_id: "c-1",
        roles: ["company_admin"], is_genesis: true, status: "active",
        company: { dic: "1234567890" },
      });

      const { deactivateMembership } = await import("@/lib/actions");
      const result = await deactivateMembership("m-1");
      expect(result.success).toBe(true);
    });

    it("genesis admin can deactivate non-genesis admin", async () => {
      store.profiles["current-user"] = { id: "current-user", is_super_admin: false };
      store.companyMemberships.push(
        { id: "my-m", user_id: "current-user", company_id: "c-1", roles: ["company_admin"], is_genesis: true, status: "active" },
        { id: "m-target", user_id: "other-user", company_id: "c-1", roles: ["company_admin"], is_genesis: false, status: "active", company: { dic: "1234567890" } }
      );

      const { deactivateMembership } = await import("@/lib/actions");
      const result = await deactivateMembership("m-target");
      expect(result.success).toBe(true);
    });

    it("non-genesis admin cannot deactivate genesis admin", async () => {
      store.profiles["current-user"] = { id: "current-user", is_super_admin: false };
      store.companyMemberships.push(
        { id: "my-m", user_id: "current-user", company_id: "c-1", roles: ["company_admin"], is_genesis: false, status: "active" },
        { id: "m-genesis", user_id: "genesis-user", company_id: "c-1", roles: ["company_admin"], is_genesis: true, status: "active", company: { dic: "1234567890" } }
      );

      const { deactivateMembership } = await import("@/lib/actions");
      const result = await deactivateMembership("m-genesis");
      expect(result.error).toContain("Genesis admin");
    });

    it("non-genesis admin cannot deactivate other admins", async () => {
      store.profiles["current-user"] = { id: "current-user", is_super_admin: false };
      store.companyMemberships.push(
        { id: "my-m", user_id: "current-user", company_id: "c-1", roles: ["company_admin"], is_genesis: false, status: "active" },
        { id: "m-other", user_id: "other-admin", company_id: "c-1", roles: ["company_admin"], is_genesis: false, status: "active", company: { dic: "1234567890" } }
      );

      const { deactivateMembership } = await import("@/lib/actions");
      const result = await deactivateMembership("m-other");
      expect(result.error).toContain("genesis admin or super admin");
    });

    it("accountant cannot deactivate anyone", async () => {
      store.profiles["current-user"] = { id: "current-user", is_super_admin: false };
      store.companyMemberships.push(
        { id: "my-m", user_id: "current-user", company_id: "c-1", roles: ["processor"], is_genesis: false, status: "active" },
        { id: "m-target", user_id: "other-user", company_id: "c-1", roles: ["processor"], is_genesis: false, status: "active", company: { dic: "1234567890" } }
      );

      const { deactivateMembership } = await import("@/lib/actions");
      const result = await deactivateMembership("m-target");
      expect(result.error).toContain("permission");
    });
  });
});
