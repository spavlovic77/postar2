import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: (globalThis as any).__companyState, error: null }),
        }),
      }),
      update: (updates: any) => ({
        eq: () => {
          Object.assign((globalThis as any).__companyState, updates);
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

const mockCompany = {
  id: "company-1",
  dic: "1234567890",
  legal_name: "Test Company s.r.o.",
  ion_ap_status: "pending",
  ion_ap_org_id: null,
};

const mockFetch = vi.fn();

beforeAll(() => {
  vi.stubGlobal("fetch", mockFetch);
});

beforeEach(() => {
  mockFetch.mockReset();
  (globalThis as any).__companyState = { ...mockCompany };
});

describe("ion-AP Client", () => {
  it("creates organization with correct payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 42, name: "Test", country: "SK" }),
    });

    const { createOrganization } = await import("@/lib/ion-ap/client");
    const org = await createOrganization({
      name: "Test Company",
      country: "SK",
      publishInSmp: true,
      reference: "1234567890",
    });

    expect(org.id).toBe(42);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v2/organizations/");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.name).toBe("Test Company");
    expect(body.country).toBe("SK");
    expect(body.publish_in_smp).toBe(true);
  });

  it("creates identifier with 0245 scheme", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 99, identifier: "0245:1234567890", verified: true }),
    });

    const { createIdentifier } = await import("@/lib/ion-ap/client");
    const id = await createIdentifier(42, {
      identifier: "0245:1234567890",
      verified: true,
      publishReceivePeppolbis: true,
    });

    expect(id.id).toBe(99);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.identifier).toBe("0245:1234567890");
    expect(body.verified).toBe(true);
    expect(body.scheme).toBe("iso6523-actorid-upis");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({
        type: "client_error",
        errors: [{ code: "invalid", detail: "Name is required" }],
      })),
    });

    const { createOrganization } = await import("@/lib/ion-ap/client");

    await expect(
      createOrganization({ name: "", country: "SK", publishInSmp: true })
    ).rejects.toThrow("Name is required");
  });

  it("uses Token auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ exists: true, detail: "Found" }),
    });

    const { discoverParticipant } = await import("@/lib/ion-ap/client");
    await discoverParticipant("0245:1234567890");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toMatch(/^Token /);
  });
});

describe("Lazy Activation", () => {
  it("activates a pending company on ion-AP", async () => {
    const jsonResponse = (data: any) => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(data),
    });

    // Mock create org
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42, name: "Test", country: "SK", identifiers: [] }));
    // Mock create identifier
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 99, identifier: "0245:1234567890", verified: true }));
    // Mock create receive trigger
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    // Mock create trigger options (url, method, post_data)
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 2 }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 3 }));

    const { ensureCompanyActivated } = await import("@/lib/ion-ap/activate");
    const orgId = await ensureCompanyActivated("company-1");

    expect(orgId).toBe(42);
    expect((globalThis as any).__companyState.ion_ap_org_id).toBe(42);
    expect((globalThis as any).__companyState.ion_ap_identifier_id).toBe(99);
    expect((globalThis as any).__companyState.ion_ap_status).toBe("active");
  });

  it("returns existing org ID for already active company", async () => {
    (globalThis as any).__companyState.ion_ap_status = "active";
    (globalThis as any).__companyState.ion_ap_org_id = 42;

    const { ensureCompanyActivated } = await import("@/lib/ion-ap/activate");
    const orgId = await ensureCompanyActivated("company-1");

    expect(orgId).toBe(42);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets error status on activation failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    const { ensureCompanyActivated } = await import("@/lib/ion-ap/activate");

    await expect(ensureCompanyActivated("company-1")).rejects.toThrow("Failed to activate");
    expect((globalThis as any).__companyState.ion_ap_status).toBe("error");
    expect((globalThis as any).__companyState.ion_ap_error).toContain("500");
  });

  it("generates correct Peppol identifier", async () => {
    const { getPeppolIdentifier } = await import("@/lib/ion-ap/activate");
    expect(getPeppolIdentifier("1234567890")).toBe("0245:1234567890");
  });
});
