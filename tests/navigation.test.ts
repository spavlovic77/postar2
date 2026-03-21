import { describe, it, expect } from "vitest";
import { getNavForRole } from "@/lib/navigation";

describe("Navigation", () => {
  it("super admin sees all nav items", () => {
    const items = getNavForRole("super_admin");
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Companies");
    expect(labels).toContain("Users");
    expect(labels).toContain("Webhooks");
    expect(labels).toContain("Audit Log");
    expect(labels).toContain("Settings");
  });

  it("company admin sees correct nav items", () => {
    const items = getNavForRole("company_admin");
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Companies");
    expect(labels).toContain("Users");
    expect(labels).toContain("Audit Log");
    expect(labels).toContain("Settings");
    expect(labels).not.toContain("Webhooks");
  });

  it("accountant sees limited nav items", () => {
    const items = getNavForRole("accountant");
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Companies");
    expect(labels).toContain("Audit Log");
    expect(labels).toContain("Settings");
    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Webhooks");
  });
});
