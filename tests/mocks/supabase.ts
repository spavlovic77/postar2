import { vi } from "vitest";

// In-memory store for test data
export interface MockStore {
  profiles: Record<string, any>;
  companies: Record<string, any>;
  companyMemberships: any[];
  invitations: any[];
  pfsVerifications: any[];
  verificationCodes: any[];
  auditLogs: any[];
  authUsers: any[];
}

export function createMockStore(): MockStore {
  return {
    profiles: {},
    companies: {},
    companyMemberships: [],
    invitations: [],
    pfsVerifications: [],
    verificationCodes: [],
    auditLogs: [],
    authUsers: [],
  };
}

function createQueryBuilder(data: any[]) {
  let filtered = [...data];
  let selectFields = "*";
  let countMode = false;

  const builder: any = {
    select: (fields?: string, opts?: { count?: string; head?: boolean }) => {
      if (fields) selectFields = fields;
      if (opts?.count) countMode = true;
      if (opts?.head) {
        return { count: filtered.length, data: null, error: null };
      }
      return builder;
    },
    eq: (field: string, value: any) => {
      filtered = filtered.filter((r) => getNestedValue(r, field) === value);
      return builder;
    },
    in: (field: string, values: any[]) => {
      filtered = filtered.filter((r) => values.includes(getNestedValue(r, field)));
      return builder;
    },
    is: (field: string, value: any) => {
      filtered = filtered.filter((r) => {
        const v = getNestedValue(r, field);
        if (value === null) return v === null || v === undefined;
        return v === value;
      });
      return builder;
    },
    or: (_expr: string) => builder,
    order: (_field: string, _opts?: any) => builder,
    limit: (n: number) => {
      filtered = filtered.slice(0, n);
      return builder;
    },
    range: (from: number, to: number) => {
      const total = filtered.length;
      filtered = filtered.slice(from, to + 1);
      return { data: filtered, count: total, error: null };
    },
    single: () => ({
      data: filtered[0] ?? null,
      error: filtered[0] ? null : { message: "No rows found" },
    }),
    then: undefined,
  };

  // Make it thenable so `await query` works
  Object.defineProperty(builder, "then", {
    get() {
      const result = countMode
        ? { data: filtered, count: filtered.length, error: null }
        : { data: filtered, error: null };
      return (resolve: any) => resolve(result);
    },
  });

  return builder;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

export function createMockSupabaseAdmin(store: MockStore) {
  const tableMap: Record<string, () => any[]> = {
    profiles: () => Object.values(store.profiles),
    companies: () => Object.values(store.companies),
    company_memberships: () => store.companyMemberships,
    invitations: () => store.invitations,
    pfs_verifications: () => store.pfsVerifications,
    verification_codes: () => store.verificationCodes,
    audit_logs: () => store.auditLogs,
  };

  return {
    from: (table: string) => {
      const getData = tableMap[table] ?? (() => []);

      return {
        select: (...args: any[]) => createQueryBuilder(getData()).select(...args),
        insert: (row: any) => {
          const rows = Array.isArray(row) ? row : [row];
          for (const r of rows) {
            const withId = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
            if (table === "profiles") store.profiles[withId.id] = withId;
            else if (table === "companies") store.companies[withId.id] = withId;
            else if (table === "company_memberships") store.companyMemberships.push(withId);
            else if (table === "invitations") {
              withId.token = withId.token ?? crypto.randomUUID();
              store.invitations.push(withId);
            }
            else if (table === "pfs_verifications") store.pfsVerifications.push(withId);
            else if (table === "verification_codes") store.verificationCodes.push(withId);
            else if (table === "audit_logs") store.auditLogs.push(withId);
          }
          const result = {
            select: () => ({
              single: () => ({
                data: rows[0] ? { ...rows[0], id: crypto.randomUUID(), token: crypto.randomUUID() } : null,
                error: null,
              }),
            }),
            error: null,
            then: (resolve: any) => resolve({ error: null }),
          };
          return result;
        },
        update: (updates: any) => ({
          eq: (field: string, value: any) => {
            if (table === "profiles") {
              const p = store.profiles[value];
              if (p) Object.assign(p, updates);
            } else if (table === "invitations") {
              const inv = store.invitations.find((i: any) => i[field] === value);
              if (inv) Object.assign(inv, updates);
            } else if (table === "verification_codes") {
              const vc = store.verificationCodes.find((c: any) => c[field] === value);
              if (vc) Object.assign(vc, updates);
            } else if (table === "company_memberships") {
              const m = store.companyMemberships.find((m: any) => m[field] === value);
              if (m) Object.assign(m, updates);
            }
            return { error: null };
          },
        }),
        upsert: (row: any, _opts?: any) => {
          if (table === "company_memberships") {
            const existing = store.companyMemberships.find(
              (m: any) => m.user_id === row.user_id && m.company_id === row.company_id
            );
            if (existing) Object.assign(existing, row);
            else store.companyMemberships.push({ id: crypto.randomUUID(), ...row });
          }
          return { error: null };
        },
        delete: () => ({
          eq: (field: string, value: any) => ({
            is: (_f: string, _v: any) => {
              if (table === "verification_codes") {
                store.verificationCodes = store.verificationCodes.filter(
                  (c: any) => !(c[field] === value && c.verified_at === null)
                );
              }
              return { error: null };
            },
            error: null,
          }),
        }),
      };
    },
    rpc: vi.fn((_name: string, _params: any) => ({ error: null })),
    auth: {
      admin: {
        createUser: vi.fn(({ email, password, email_confirm }: any) => {
          const existing = store.authUsers.find((u: any) => u.email === email);
          if (existing) {
            return {
              data: { user: null },
              error: { message: "A user with this email address has already been registered" },
            };
          }
          const user = {
            id: crypto.randomUUID(),
            email,
            email_confirmed_at: email_confirm ? new Date().toISOString() : null,
            app_metadata: {},
            user_metadata: {},
          };
          store.authUsers.push(user);
          return { data: { user }, error: null };
        }),
        listUsers: vi.fn(() => ({
          data: { users: store.authUsers },
        })),
        updateUserById: vi.fn((id: string, updates: any) => {
          const user = store.authUsers.find((u: any) => u.id === id);
          if (user && updates.email_confirm) {
            user.email_confirmed_at = new Date().toISOString();
          }
          return { error: null };
        }),
        getUserById: vi.fn((id: string) => ({
          data: { user: store.authUsers.find((u: any) => u.id === id) ?? null },
        })),
        generateLink: vi.fn(() => ({
          data: { properties: { hashed_token: "test-hashed-token" } },
          error: null,
        })),
      },
    },
  };
}
