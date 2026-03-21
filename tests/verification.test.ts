import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockStore, createMockSupabaseAdmin } from "./mocks/supabase";

describe("Verification Codes", () => {
  let store: ReturnType<typeof createMockStore>;
  let mockAdmin: ReturnType<typeof createMockSupabaseAdmin>;

  beforeEach(() => {
    store = createMockStore();
    mockAdmin = createMockSupabaseAdmin(store);
  });

  it("generates a 6-digit code", async () => {
    const { generateCode } = await import("@/lib/verification");
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(code)).toBeLessThan(1000000);
  });

  it("creates and stores a verification code", async () => {
    const { createVerificationCode } = await import("@/lib/verification");

    const code = await createVerificationCode(mockAdmin as any, {
      userId: "user-1",
      channel: "email",
      destination: "test@example.com",
    });

    expect(code).toMatch(/^\d{6}$/);
    expect(store.verificationCodes.length).toBe(1);
    expect(store.verificationCodes[0].user_id).toBe("user-1");
    expect(store.verificationCodes[0].channel).toBe("email");
  });

  it("verifies a valid code", async () => {
    const { createVerificationCode, verifyCode } = await import("@/lib/verification");

    const code = await createVerificationCode(mockAdmin as any, {
      userId: "user-1",
      channel: "email",
      destination: "test@example.com",
    });

    store.verificationCodes[0].expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const result = await verifyCode(mockAdmin as any, { userId: "user-1", code });
    expect(result).toBe(true);
    expect(store.verificationCodes[0].verified_at).toBeTruthy();
  });

  it("rejects wrong code", async () => {
    const { createVerificationCode, verifyCode } = await import("@/lib/verification");

    await createVerificationCode(mockAdmin as any, {
      userId: "user-1",
      channel: "email",
      destination: "test@example.com",
    });

    store.verificationCodes[0].expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const result = await verifyCode(mockAdmin as any, { userId: "user-1", code: "000000" });
    expect(result).toBe(false);
  });

  it("rejects expired code", async () => {
    const { createVerificationCode, verifyCode } = await import("@/lib/verification");

    const code = await createVerificationCode(mockAdmin as any, {
      userId: "user-1",
      channel: "email",
      destination: "test@example.com",
    });

    store.verificationCodes[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const result = await verifyCode(mockAdmin as any, { userId: "user-1", code });
    expect(result).toBe(false);
  });
});
