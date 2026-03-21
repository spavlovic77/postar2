import { describe, it, expect, vi, beforeEach } from "vitest";

// Inline mock store for audit tests
let auditLogs: any[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: (row: any) => {
        auditLogs.push(row);
        return { then: (resolve: any) => resolve({ error: null }) };
      },
    }),
  }),
}));

beforeEach(() => {
  auditLogs = [];
});

describe("Audit Logger", () => {
  it("builds valid CEF string", async () => {
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

    await new Promise((r) => setTimeout(r, 50));

    expect(auditLogs.length).toBe(1);
    const log = auditLogs[0];
    expect(log.event_id).toBe("TEST_EVENT");
    expect(log.event_name).toBe("Test event");
    expect(log.severity).toBe("info");
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

    expect(auditLogs[0].cef).toContain("|3|");
    expect(auditLogs[1].cef).toContain("|6|");
    expect(auditLogs[2].cef).toContain("|9|");
  });

  it("never throws on failure", async () => {
    const { audit } = await import("@/lib/audit");
    expect(() => {
      audit({ eventId: "FAIL", eventName: "Should not throw" });
    }).not.toThrow();
  });
});
