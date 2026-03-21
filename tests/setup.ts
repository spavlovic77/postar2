import { vi } from "vitest";

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.PFS_WEBHOOK_SECRET = "test-webhook-secret";
process.env.RESEND_API_KEY = "re_test_key";
process.env.RESEND_FROM_EMAIL = "test@postar.app";

// Global mocks for Next.js modules
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
