import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory state for tests
let wallets: any[] = [];
let walletTransactions: any[] = [];
let documents: any[] = [];
let companies: any[] = [];
let memberships: any[] = [];
let txnIdCounter = 0;

function resetState() {
  wallets = [];
  walletTransactions = [];
  documents = [];
  companies = [];
  memberships = [];
  txnIdCounter = 0;
}

function createChainableQuery(data: any[]) {
  let filtered = [...data];

  const builder: any = {
    select: () => builder,
    eq: (field: string, value: any) => {
      filtered = filtered.filter((r) => r[field] === value);
      return builder;
    },
    gte: (field: string, value: any) => {
      filtered = filtered.filter((r) => r[field] >= value);
      return builder;
    },
    lt: (field: string, value: any) => {
      filtered = filtered.filter((r) => r[field] < value);
      return builder;
    },
    is: (field: string, _value: null) => {
      filtered = filtered.filter((r) => r[field] == null);
      return builder;
    },
    in: (field: string, values: any[]) => {
      filtered = filtered.filter((r) => values.includes(r[field]));
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    single: () => ({
      data: filtered[0] ?? null,
      error: filtered[0] ? null : { message: "not found", code: "PGRST116" },
    }),
    then: undefined as any,
  };

  // Make it thenable for array results
  builder.then = (resolve: (v: any) => void) =>
    resolve({ data: filtered, count: filtered.length, error: null });

  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const getCollection = () => {
        switch (table) {
          case "wallets": return wallets;
          case "wallet_transactions": return walletTransactions;
          case "documents": return documents;
          case "companies": return companies;
          case "company_memberships": return memberships;
          case "audit_logs": return [];
          default: return [];
        }
      };

      return {
        select: (...args: any[]) => createChainableQuery(getCollection()).select(...args),
        insert: (row: any) => {
          const newRow = { id: `test-${++txnIdCounter}`, ...row };
          getCollection().push(newRow);
          return {
            select: () => ({
              single: () => ({ data: newRow, error: null }),
            }),
            error: null,
          };
        },
        update: (updates: any) => {
          let targetCollection = getCollection();
          const builder: any = {
            eq: (field: string, value: any) => {
              targetCollection = targetCollection.filter((r) => r[field] === value);
              return builder;
            },
            gte: (field: string, value: any) => {
              targetCollection = targetCollection.filter((r) => r[field] >= value);
              return builder;
            },
            in: (field: string, values: any[]) => {
              targetCollection = targetCollection.filter((r) => values.includes(r[field]));
              return builder;
            },
            is: (field: string, _value: null) => {
              targetCollection = targetCollection.filter((r) => r[field] == null);
              return builder;
            },
            select: () => ({
              single: () => {
                if (targetCollection.length > 0) {
                  Object.assign(targetCollection[0], updates);
                  return { data: targetCollection[0], error: null };
                }
                return { data: null, error: { message: "not found" } };
              },
            }),
            then: (resolve: any) => {
              for (const row of targetCollection) {
                Object.assign(row, updates);
              }
              return resolve({ error: null, count: targetCollection.length });
            },
          };
          return builder;
        },
      };
    },
  }),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
  auditDocumentUnbilled: vi.fn(),
}));

// Import after mocks
const { chargeForDocument, topUpWallet, autoBillUnbilledDocuments, adjustWallet, getUnbilledCount } = await import("@/lib/billing");

describe("Billing System", () => {
  beforeEach(() => {
    resetState();
  });

  describe("chargeForDocument", () => {
    it("should auto-bill for free when price is null", async () => {
      companies.push({ id: "c1", price_per_document: null, dic: "1234567890" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(true);
      expect(documents[0].billed_at).toBeTruthy();
    });

    it("should auto-bill for free when price is 0", async () => {
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(true);
    });

    it("should charge when wallet has sufficient balance", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 10.0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(true);
      expect(wallets[0].available_balance).toBe(9.96);
      expect(documents[0].billed_at).toBeTruthy();
    });

    it("should fail when wallet has insufficient balance", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0.01 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(false);
    });

    it("should return false when no genesis admin exists", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(false);
    });
  });

  describe("autoBillUnbilledDocuments", () => {
    it("should bill all documents when balance is sufficient (all-or-nothing)", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 1.0 });

      // 3 unbilled documents = 0.12 EUR total
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "read", peppol_created_at: "2026-01-02" });
      documents.push({ id: "d3", company_id: "c1", billed_at: null, status: "assigned", peppol_created_at: "2026-01-03" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(3);
      expect(result.totalCost).toBe(0.12);
      expect(wallets[0].available_balance).toBe(0.88);
    });

    it("should bill nothing when balance is insufficient (all-or-nothing)", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0.05 });

      // 3 unbilled documents = 0.12 EUR total
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-02" });
      documents.push({ id: "d3", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-03" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(0);
      expect(documents[0].billed_at).toBeNull();
    });

    it("should handle free documents alongside paid ones", async () => {
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });

      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(1);
      expect(result.totalCost).toBe(0);
    });
  });

  describe("topUpWallet", () => {
    it("should add funds and return success", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });

      const result = await topUpWallet("w1", 10.0, { type: "test" }, "u1");

      expect(result.success).toBe(true);
      expect(wallets[0].available_balance).toBe(15.0);
    });

    it("should reject zero or negative amounts", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });

      const result = await topUpWallet("w1", -5, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Amount must be positive");
    });
  });

  describe("adjustWallet", () => {
    it("should allow positive adjustment", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });

      const result = await adjustWallet("w1", 10, "Manual credit", "admin1");

      expect(result.success).toBe(true);
      expect(wallets[0].available_balance).toBe(15.0);
    });

    it("should reject adjustment that would go negative", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });

      const result = await adjustWallet("w1", -10, "Debit", "admin1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("negative balance");
    });

    it("should reject zero amount", async () => {
      const result = await adjustWallet("w1", 0, "Nothing", "admin1");

      expect(result.success).toBe(false);
    });
  });

  describe("getUnbilledCount", () => {
    it("should count unbilled documents across companies", async () => {
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "read" });
      documents.push({ id: "d3", company_id: "c1", billed_at: "2026-01-01", status: "read" }); // billed

      const count = await getUnbilledCount("u1");

      expect(count).toBe(2);
    });

    it("should not count pending/processing/failed documents", async () => {
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "pending" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "processing" });
      documents.push({ id: "d3", company_id: "c1", billed_at: null, status: "failed" });

      const count = await getUnbilledCount("u1");

      expect(count).toBe(0);
    });

    it("should count across multiple companies under same genesis admin", async () => {
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      memberships.push({ user_id: "u1", company_id: "c2", is_genesis: true, status: "active" });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });
      documents.push({ id: "d2", company_id: "c2", billed_at: null, status: "new" });

      const count = await getUnbilledCount("u1");

      expect(count).toBe(2);
    });
  });

  // ============================================================
  // Regression: End-to-end billing flows
  // ============================================================

  describe("Regression: document arrival → billing → locking → top-up → unlock", () => {
    it("full flow: document arrives, insufficient balance, top-up unlocks all", async () => {
      // Setup: genesis admin with empty wallet, company priced at 0.04
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });

      // Step 1: 3 documents arrive — all should be unbilled (insufficient balance)
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-02" });
      documents.push({ id: "d3", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-03" });

      const r1 = await chargeForDocument("d1", "c1");
      const r2 = await chargeForDocument("d2", "c1");
      const r3 = await chargeForDocument("d3", "c1");

      expect(r1).toBe(false);
      expect(r2).toBe(false);
      expect(r3).toBe(false);
      expect(documents.every((d) => d.billed_at === null)).toBe(true);

      // Step 2: Top up with insufficient amount (0.10 < 0.12 needed)
      await topUpWallet("w1", 0.10, { type: "test" });

      // All-or-nothing: nothing should be billed
      expect(documents.every((d) => d.billed_at === null)).toBe(true);
      expect(wallets[0].available_balance).toBe(0.10);

      // Step 3: Top up with enough to cover all (0.10 + 0.05 = 0.15 >= 0.12)
      await topUpWallet("w1", 0.05, { type: "test" });

      // All 3 should now be billed
      expect(documents.every((d) => d.billed_at !== null)).toBe(true);
      expect(wallets[0].available_balance).toBeCloseTo(0.03, 4);
    });

    it("multi-company: one wallet serves multiple companies with different prices", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1111111111" });
      companies.push({ id: "c2", price_per_document: 0.10, dic: "2222222222" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      memberships.push({ user_id: "u1", company_id: "c2", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });

      // Document for c1 (0.04) and c2 (0.10)
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });
      documents.push({ id: "d2", company_id: "c2", billed_at: null, status: "new" });

      const r1 = await chargeForDocument("d1", "c1");
      const r2 = await chargeForDocument("d2", "c2");

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(wallets[0].available_balance).toBeCloseTo(4.86, 4);

      // Verify transaction records created
      const c1Txns = walletTransactions.filter((t) => t.company_id === "c1");
      const c2Txns = walletTransactions.filter((t) => t.company_id === "c2");
      expect(c1Txns.length).toBe(1);
      expect(c2Txns.length).toBe(1);
      expect(c1Txns[0].amount).toBe(-0.04);
      expect(c2Txns[0].amount).toBe(-0.10);
    });

    it("already billed documents are not charged again", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 10.0 });

      // Document already billed
      documents.push({ id: "d1", company_id: "c1", billed_at: "2026-01-01", status: "read", peppol_created_at: "2026-01-01" });
      // Document not billed
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-02" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(1); // only d2
      expect(wallets[0].available_balance).toBeCloseTo(9.96, 4);
    });

    it("auto-bill skips documents in non-billable statuses", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 10.0 });

      // pending and failed should not be auto-billed
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "pending", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "failed", peppol_created_at: "2026-01-02" });
      // new should be billed
      documents.push({ id: "d3", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-03" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(1);
      expect(documents[0].billed_at).toBeNull(); // pending — untouched
      expect(documents[1].billed_at).toBeNull(); // failed — untouched
      expect(documents[2].billed_at).toBeTruthy(); // new — billed
    });

    it("top-up triggers auto-billing of unbilled documents", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });

      // Top up enough
      const result = await topUpWallet("w1", 1.0, { type: "test" });

      expect(result.success).toBe(true);
      expect(documents[0].billed_at).toBeTruthy();
      // 1.0 top-up - 0.04 charge = 0.96
      expect(wallets[0].available_balance).toBeCloseTo(0.96, 4);

      // Verify transaction history: top-up + charge
      const topUps = walletTransactions.filter((t) => t.type === "top_up");
      const charges = walletTransactions.filter((t) => t.type === "charge");
      expect(topUps.length).toBe(1);
      expect(charges.length).toBe(1);
      expect(topUps[0].amount).toBe(1.0);
      expect(charges[0].amount).toBe(-0.04);
    });

    it("positive adjustment triggers auto-billing", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });

      await adjustWallet("w1", 5.0, "Manual credit", "admin1");

      expect(documents[0].billed_at).toBeTruthy();
      expect(wallets[0].available_balance).toBeCloseTo(4.96, 4);
    });

    it("negative adjustment does not trigger auto-billing", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 10.0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });

      await adjustWallet("w1", -5.0, "Debit", "admin1");

      // Balance went down, but the doc should still be billable (balance 5.0 > 0.04)
      // However, adjustWallet with negative amount does NOT trigger auto-billing
      // The doc stays unbilled until a positive event triggers auto-billing
      expect(wallets[0].available_balance).toBe(5.0);
    });

    it("wallet with no genesis companies has nothing to bill", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 100 });
      // No memberships at all

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe("Regression: wallet transaction audit trail", () => {
    it("records correct balance_after for sequential charges", async () => {
      companies.push({ id: "c1", price_per_document: 1.0, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "new" });

      await chargeForDocument("d1", "c1");
      await chargeForDocument("d2", "c1");

      expect(wallets[0].available_balance).toBe(3.0);
      expect(walletTransactions.length).toBe(2);

      const amounts = walletTransactions.map((t) => t.amount);
      expect(amounts).toEqual([-1.0, -1.0]);
    });

    it("top-up records correct transaction with metadata", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });

      await topUpWallet("w1", 25.5, { type: "qr_payment", transaction_id: "QR-test123" }, "u1");

      const topUp = walletTransactions.find((t) => t.type === "top_up");
      expect(topUp).toBeTruthy();
      expect(topUp.amount).toBe(25.5);
      expect(topUp.balance_after).toBe(25.5);
      expect(topUp.metadata.type).toBe("qr_payment");
      expect(topUp.metadata.transaction_id).toBe("QR-test123");
      expect(topUp.created_by).toBe("u1");
    });

    it("adjustment records description and actor", async () => {
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 10 });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      companies.push({ id: "c1", price_per_document: 0, dic: "1234567890" });

      await adjustWallet("w1", -3.0, "Refund for duplicate charge", "admin1");

      const adj = walletTransactions.find((t) => t.type === "adjustment");
      expect(adj).toBeTruthy();
      expect(adj.amount).toBe(-3.0);
      expect(adj.balance_after).toBe(7.0);
      expect(adj.description).toBe("Refund for duplicate charge");
      expect(adj.created_by).toBe("admin1");
    });
  });

  describe("Regression: edge cases", () => {
    it("exact balance matches total cost — should bill all", async () => {
      companies.push({ id: "c1", price_per_document: 0.50, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 1.0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-02" });

      const result = await autoBillUnbilledDocuments("w1");

      expect(result.billed).toBe(2);
      expect(wallets[0].available_balance).toBeCloseTo(0, 4);
    });

    it("single document charge drains wallet to exactly zero", async () => {
      companies.push({ id: "c1", price_per_document: 5.0, dic: "1234567890" });
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 5.0 });
      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new" });

      const result = await chargeForDocument("d1", "c1");

      expect(result).toBe(true);
      expect(wallets[0].available_balance).toBe(0);
    });

    it("mixed free and paid companies in auto-bill", async () => {
      companies.push({ id: "c1", price_per_document: 0.04, dic: "1111111111" });
      companies.push({ id: "c2", price_per_document: 0, dic: "2222222222" }); // free
      memberships.push({ user_id: "u1", company_id: "c1", is_genesis: true, status: "active" });
      memberships.push({ user_id: "u1", company_id: "c2", is_genesis: true, status: "active" });
      wallets.push({ id: "w1", owner_id: "u1", available_balance: 0 });

      documents.push({ id: "d1", company_id: "c1", billed_at: null, status: "new", peppol_created_at: "2026-01-01" });
      documents.push({ id: "d2", company_id: "c2", billed_at: null, status: "new", peppol_created_at: "2026-01-02" });

      const result = await autoBillUnbilledDocuments("w1");

      // c2 doc is free → billed immediately
      // c1 doc costs 0.04 but balance is 0 → not billed
      expect(result.billed).toBe(1); // only the free one
      expect(documents[1].billed_at).toBeTruthy(); // c2 free doc
      // c1 doc remains unbilled because balance can't cover it
    });

    it("wallet not found returns error for top-up", async () => {
      const result = await topUpWallet("nonexistent", 10, {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Wallet not found");
    });

    it("wallet not found returns error for adjustment", async () => {
      const result = await adjustWallet("nonexistent", 10, "test", "admin1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Wallet not found");
    });
  });
});
