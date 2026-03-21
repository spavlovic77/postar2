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

describe("Audit Logger", () => {
  it("builds valid CEF string", async () => {
    // Dynamic import to pick up mocks
    const { audit } = await import("@/lib/audit");

    audit({
      eventId: "TEST_EVENT",
      eventName: "Test event",
      severity: "info",
      actorId: "user-123",
      actorEmail: "test@example.com",
      companyDic: "1234567890",
      sourceIp: "192.168.1.1",
    });

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 50));

    expect(store.auditLogs.length).toBe(1);
    const log = store.auditLogs[0];
    expect(log.event_id).toBe("TEST_EVENT");
    expect(log.event_name).toBe("Test event");
    expect(log.severity).toBe("info");
    expect(log.actor_id).toBe("user-123");
    expect(log.actor_email).toBe("test@example.com");
    expect(log.company_dic).toBe("1234567890");
    expect(log.source_ip).toBe("192.168.1.1");

    // Verify CEF format
    expect(log.cef).toMatch(/^CEF:0\|Postar\|Postar\|1\.0\|TEST_EVENT\|Test event\|3\|/);
    expect(log.cef).toContain("suid=user-123");
    expect(log.cef).toContain("suser=test@example.com");
    expect(log.cef).toContain("cs1=1234567890");
    expect(log.cef).toContain("src=192.168.1.1");
  });

  it("maps severity correctly in CEF", async () => {
    const { audit } = await import("@/lib/audit");

    audit({ eventId: "E1", eventName: "Info", severity: "info" });
    audit({ eventId: "E2", eventName: "Warning", severity: "warning" });
    audit({ eventId: "E3", eventName: "Error", severity: "error" });

    await new Promise((r) => setTimeout(r, 50));

    expect(store.auditLogs[0].cef).toContain("|3|");  // info = 3
    expect(store.auditLogs[1].cef).toContain("|6|");  // warning = 6
    expect(store.auditLogs[2].cef).toContain("|9|");  // error = 9
  });

  it("never throws on failure", async () => {
    // Override to simulate failure
    mockAdmin.from = () => ({
      insert: () => ({ then: (resolve: any) => resolve({ error: { message: "DB down" } }) }),
    }) as any;

    const { audit } = await import("@/lib/audit");

    // Should not throw
    expect(() => {
      audit({ eventId: "FAIL", eventName: "Should not throw" });
    }).not.toThrow();
  });
});
