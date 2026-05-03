# postar2 — Permissions & Roles

Web (postar2) and mobile (ePodatelna24) enforce **identical permission
matrices**. Web actions live in [`src/lib/actions.ts`](src/lib/actions.ts) and
[`src/app/dashboard/companies/[id]/company-actions.ts`](src/app/dashboard/companies/%5Bid%5D/company-actions.ts);
mobile-equivalent routes live under
[`src/app/api/memberships/[id]/`](src/app/api/memberships/%5Bid%5D/) and
[`src/app/api/account/delete/`](src/app/api/account/delete/).

## Roles overview

| Role                      | Scope       | Created by                   | Description                                                                   |
| ------------------------- | ----------- | ---------------------------- | ----------------------------------------------------------------------------- |
| **Super Admin**           | Global      | SQL (manual)                 | Full system access. Manages all companies, users, settings.                   |
| **Genesis Company Admin** | Per company | PFS webhook (auto)           | First admin of a company. Cannot be removed or have role changed except by super admin. Owns the wallet. |
| **Company Admin**         | Per company | Genesis admin or super admin | Manages users and documents for own companies.                                |
| **Operator**              | Per company | Company admin                | Triages documents, manages department members, manages operator/processor roles. |
| **Processor**             | Per company | Company admin                | Read-only access to documents in their assigned department(s).                |

Every membership is a single row in `company_memberships` with **one role** and an `is_genesis` boolean. Super admin is a global flag (`profiles.is_super_admin`), independent of any company membership.

## Universal guards

Both web and mobile enforce these on every membership / role / account-delete action:

1. **Never act on yourself.** Deactivating your own membership, changing your own role, or — outside of `/api/account/delete` — deleting your own account is rejected.
2. **Genesis is sacred.** A user with `is_genesis = true` cannot be deactivated, have their role changed, or be removed except by a super admin. (Support-case lever for orphaned-genesis recovery.)
3. **No role escalation by non-genesis.** Only genesis admins (or super admins) can promote anyone to `company_admin`.
4. **Operators cannot touch admins.** Operators can only manage roles in the `operator ↔ processor` band — they cannot demote or promote admins.

These guards apply identically on the web server actions, the mobile membership routes, and (where relevant) the account-delete endpoint.

---

## Navigation access

### Sidebar

| Page       | Super Admin | Company Admin | Operator | Processor    |
| ---------- | ----------- | ------------- | -------- | ------------ |
| Dashboard  | Yes         | Yes           | Yes      | No (→ Inbox) |
| Inbox      | Yes         | Yes           | Yes      | Yes          |
| Companies  | Yes         | Yes           | Yes      | Yes          |
| Users      | Yes         | Yes           | Yes      | No           |
| Webhooks   | Yes         | No            | No       | No           |
| Wallet     | No          | Yes           | Yes      | No           |
| Operations | Yes         | Yes           | No       | No           |

### User-avatar dropdown (all roles)

| Page      | Access                                          |
| --------- | ----------------------------------------------- |
| Settings  | All roles (system settings visible to SA only)  |
| Audit Log | All roles (data scoped by role)                 |

### Data scope

| Page       | Super Admin        | Genesis Admin                 | Company Admin                 | Operator        | Processor           |
| ---------- | ------------------ | ----------------------------- | ----------------------------- | --------------- | ------------------- |
| Dashboard  | Stats + onboarding | Company cards + test invoices | Company cards + test invoices | Company cards   | Redirected to Inbox |
| Inbox      | All documents      | Own companies                 | Own companies                 | Own companies   | Own department only |
| Companies  | All                | Own                           | Own                           | Own (read-only) | Own (read-only)     |
| Users      | All                | Own companies                 | Own companies                 | Own companies   | No access           |
| Webhooks   | All                | No access                     | No access                     | No access       | No access           |
| Wallet     | Via company detail | Yes (owner)                   | Yes (shared)                  | Yes (shared)    | No                  |
| Operations | Full access        | Own companies only            | No                            | No              | No                  |
| Audit Log  | All events         | Own companies                 | Own companies                 | Own companies   | Own actions only    |
| Settings   | Profile + system   | Profile only                  | Profile only                  | Profile only    | Profile only        |

---

## Detailed permission matrix

### Company management

| Action                                    | Super Admin | Genesis Admin                   | Company Admin (non-genesis) | Operator | Processor |
| ----------------------------------------- | ----------- | ------------------------------- | --------------------------- | -------- | --------- |
| View all companies                        | Yes         | No                              | No                          | No       | No        |
| View own companies                        | Yes         | Yes                             | Yes                         | Yes      | Yes       |
| Edit company details (name, email, phone) | Yes         | Yes                             | Yes                         | No       | No        |
| Activate company on Peppol (manual)       | Yes         | Yes (auto on first invite accept) | No                        | No       | No        |
| Deactivate company                        | Yes         | No                              | No                          | No       | No        |
| Reactivate company                        | Yes         | No                              | No                          | No       | No        |
| Set company pricing                       | Yes         | No                              | No                          | No       | No        |

### Invitations

| Action                          | Super Admin | Genesis Admin       | Company Admin (non-genesis) | Operator | Processor |
| ------------------------------- | ----------- | ------------------- | --------------------------- | -------- | --------- |
| Invite super admin              | Yes         | No                  | No                          | No       | No        |
| Invite company admin            | Yes         | Yes (own companies) | No                          | No       | No        |
| Invite operator                 | Yes         | Yes                 | Yes                         | No       | No        |
| Invite processor                | Yes         | Yes                 | Yes                         | No       | No        |
| Resend invitation               | Yes         | Own invites         | Own invites                 | No       | No        |
| Revoke invitation               | Yes         | Own invites         | Own invites                 | No       | No        |
| Extend invitation expiry        | Yes         | Yes (own)           | No                          | No       | No        |

### Membership lifecycle (deactivate / change role)

Both routes — web (`deactivateMembership` / `updateMemberRole` server actions) and mobile (`POST /api/memberships/[id]/deactivate` / `…/role`) — apply the matrix below. **Any cell that says "Yes" still requires the universal guards above to pass** (no self, no genesis target except super admin).

#### Deactivate a member

| Target                          | Super Admin | Genesis Admin | Company Admin (non-genesis) | Operator | Processor |
| ------------------------------- | ----------- | ------------- | --------------------------- | -------- | --------- |
| Self                            | No          | No            | No                          | No       | No        |
| Genesis admin                   | Yes         | No            | No                          | No       | No        |
| Other company admin (non-genesis) | Yes       | Yes           | No                          | No       | No        |
| Operator                        | Yes         | Yes           | Yes                         | No       | No        |
| Processor                       | Yes         | Yes           | Yes                         | No       | No        |
| Reactivate any member           | Yes         | Yes           | Yes                         | No       | No        |

#### Change role of a member

| From → To                                     | Super Admin | Genesis Admin | Company Admin (non-genesis) | Operator | Processor |
| --------------------------------------------- | ----------- | ------------- | --------------------------- | -------- | --------- |
| Self (any → any)                              | No          | No            | No                          | No       | No        |
| Genesis admin (any → any)                     | Yes         | No            | No                          | No       | No        |
| Anything → `company_admin` (promote)          | Yes         | Yes           | No                          | No       | No        |
| `company_admin` → operator/processor (demote) | Yes         | Yes           | No                          | No       | No        |
| operator → processor                          | Yes         | Yes           | Yes                         | Yes      | No        |
| processor → operator                          | Yes         | Yes           | Yes                         | Yes      | No        |
| Same role (no-change)                         | Returns `400 no_change` for all callers       |

### Department management

| Action                        | Super Admin | Genesis Admin | Company Admin | Operator | Processor |
| ----------------------------- | ----------- | ------------- | ------------- | -------- | --------- |
| Create department             | Yes         | Yes           | Yes           | No       | No        |
| Rename department             | Yes         | Yes           | Yes           | No       | No        |
| Delete department             | Yes         | Yes           | Yes           | No       | No        |
| Add member to department      | Yes         | Yes           | Yes           | Yes      | No        |
| Remove member from department | Yes         | Yes           | Yes           | Yes      | No        |

### Documents / Inbox

The PDF and XML endpoints accept either a Supabase **session cookie** (web) or a **Bearer token** (mobile). Access checks are identical: super admin OR active membership in the document's company.

| Action                            | Super Admin   | Genesis Admin      | Company Admin      | Operator           | Processor          |
| --------------------------------- | ------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| View all documents                | Yes           | No                 | No                 | No                 | No                 |
| View own company documents        | Yes           | Yes                | Yes                | Yes                | Own dept only      |
| View unassigned documents         | Yes           | Yes                | Yes                | Yes                | No                 |
| Click row to open detail          | Yes           | Yes                | Yes                | Yes                | Yes                |
| Download PDF (web, mobile)        | Yes           | Yes                | Yes                | Yes                | Yes                |
| Download XML (web, mobile)        | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mass download (select + download) | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mark as read (auto on view)       | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mark as Processed (with note)     | Yes           | Yes                | Yes                | Yes                | Yes                |
| Export XML & Process              | Yes           | Yes                | Yes                | Yes                | Yes                |
| Bulk Export XML & Process         | Yes           | Yes                | Yes                | Yes                | Yes                |
| Add note to document              | Yes           | Yes                | Yes                | Yes                | Yes                |
| View document activity timeline   | Yes           | Yes                | Yes                | Yes                | Yes                |
| Assign to department (triage)     | Yes           | Yes                | Yes                | Yes                | No                 |
| Bulk assign / unassign            | Yes           | Yes                | Yes                | Yes                | No                 |
| View locked documents             | Yes (no lock) | Locked if unbilled | Locked if unbilled | Locked if unbilled | Locked if unbilled |
| Click locked doc → payment modal  | N/A           | Yes                | Yes                | Yes                | Yes                |

**PDF/XML lock semantics**: the routes return `403 "Document is locked — insufficient wallet balance"` when `billed_at IS NULL` and status ∈ `{new, read, assigned, processed}`, except for super admin. Mobile reads `documents.billed_at` directly via Supabase RLS to render the lock UI without a 403.

### Wallet & billing

| Action                     | Super Admin        | Genesis Admin | Company Admin | Operator     | Processor |
| -------------------------- | ------------------ | ------------- | ------------- | ------------ | --------- |
| View wallet balance        | Via company detail | Yes (owner)   | Yes (shared)  | Yes (shared) | No        |
| Top up wallet (QR payment) | No                 | Yes           | Yes           | Yes          | No        |
| View transaction history   | Via company detail | Yes           | Yes           | Yes          | No        |
| Export statement (CSV)     | Via company detail | Yes           | Yes           | No           | No        |
| Adjust balance (manual)    | Yes                | No            | No            | No           | No        |
| Refund wallet              | Yes                | No            | No            | No           | No        |
| View wallet detail page    | Yes (any wallet)   | No            | No            | No           | No        |
| Force bill documents       | Yes                | No            | No            | No           | No        |

### Operations Center

| Action                     | Super Admin | Genesis Admin       | Company Admin | Operator | Processor |
| -------------------------- | ----------- | ------------------- | ------------- | -------- | --------- |
| View Operations page       | Yes (all)   | Yes (own companies) | No            | No       | No        |
| Retry Peppol activation    | Yes         | Yes (own)           | No            | No       | No        |
| Retry failed document      | Yes         | Yes (own)           | No            | No       | No        |
| Retry all failed documents | Yes         | Yes (own)           | No            | No       | No        |
| Force document status      | Yes         | No                  | No            | No       | No        |
| Force check payment        | Yes         | Yes (own wallet)    | No            | No       | No        |
| Mark payment completed     | Yes         | No                  | No            | No       | No        |
| Retry auto-billing         | Yes         | Yes (own)           | No            | No       | No        |
| Force bill document        | Yes         | No                  | No            | No       | No        |
| Resend invitation          | Yes         | Yes (own)           | No            | No       | No        |
| Extend invitation expiry   | Yes         | Yes (own)           | No            | No       | No        |

### Test invoices

| Action             | Super Admin | Genesis Admin            | Company Admin            | Operator | Processor |
| ------------------ | ----------- | ------------------------ | ------------------------ | -------- | --------- |
| Send test invoices | Yes         | Yes (own, Peppol active) | Yes (own, Peppol active) | No       | No        |

### System settings

| Action                   | Super Admin | Genesis Admin | Company Admin | Operator | Processor |
| ------------------------ | ----------- | ------------- | ------------- | -------- | --------- |
| Update system settings   | Yes         | No            | No            | No       | No        |
| Update own profile       | Yes         | Yes           | Yes           | Yes      | Yes       |
| View PFS activation link | Yes         | No            | No            | No       | No        |

### Audit log

| Action                  | Super Admin | Genesis Admin | Company Admin | Operator | Processor       |
| ----------------------- | ----------- | ------------- | ------------- | -------- | --------------- |
| View all audit events   | Yes         | No            | No            | No       | No              |
| View own company events | Yes         | Yes           | Yes           | Yes      | Own actions only |
| Filter by company       | Yes         | Yes           | Yes           | No       | No              |

### Account self-deletion (mobile-only — `POST /api/account/delete`)

Required by App Store / Play Store. Bearer-token authenticated. Cascades the auth user (and therefore profile, memberships, device tokens, department memberships, wallet) on success.

| Caller condition                                | Outcome                                                  |
| ----------------------------------------------- | -------------------------------------------------------- |
| Has wallet with `available_balance > 0`         | `409 wallet_not_empty` — drain or contact support first  |
| Is genesis admin of any active company          | `409 genesis_admin` — contact support to transfer ownership |
| Otherwise                                       | `200 ok` — memberships set to inactive, then auth user + profile + cascaded rows deleted, audit `AUTH_ACCOUNT_DELETED` emitted |

There is no equivalent web action — account deletion is mobile-initiated only.

---

## Mobile API surface

The ePodatelna24 mobile app authenticates with a Supabase access token via
`Authorization: Bearer <jwt>` on every postar2 call. Mutations and
multi-step workflows go through the routes below; reads on documents,
companies, memberships, and device tokens go directly through Supabase JS
under RLS.

| Route                                      | Permission rule                                    |
| ------------------------------------------ | -------------------------------------------------- |
| `GET /api/wallet`                          | Caller's wallet (own, or shared via genesis)       |
| `POST /api/wallet/create-payment-link`     | Owner OR member of a company under the genesis admin |
| `POST /api/invitations`                    | Super admin OR `company_admin` of every requested company |
| `GET /api/companies/[id]/members`          | Super admin OR active member of the company        |
| `POST /api/memberships/[id]/role`          | The matrix above                                   |
| `POST /api/memberships/[id]/deactivate`    | The matrix above                                   |
| `POST /api/account/delete`                 | Self-only; subject to wallet + genesis guards      |
| `GET /api/documents/[id]/pdf`              | Member of doc's company; locked unless billed     |
| `GET /api/documents/[id]/xml`              | Member of doc's company; locked unless billed     |

Error codes are machine-readable (see ARCHITECTURE.md → "Mobile API surface" for the full list).

---

## Special rules

### Genesis admin protection

- Genesis admin **cannot** be deactivated or have their role changed by anyone except a super admin.
- Genesis admin **cannot** be removed from their company.
- Only the genesis admin (or super admin) can assign the `company_admin` role to others.
- Genesis admin **cannot** delete their own account via `/api/account/delete` — must contact support to transfer the company first.

### Operator role-change scope

Operators can manage user roles, but only between `operator` and `processor`. They cannot:
- Promote anyone to `company_admin`.
- Demote any `company_admin` to `operator` or `processor`.
- Change the role of a genesis admin (universal guard).

### Wallet ownership

- One wallet per genesis admin, shared across all their companies.
- Non-genesis users see "Shared wallet (managed by your company admin)" badge.
- Super admin accesses wallets via `/dashboard/wallet/[walletId]`, not their own wallet page.
- Super admin **cannot** top up someone else's wallet via QR — they use `Adjust balance` instead.

### Document billing lock

- Super admins **never** see locked documents — they bypass billing checks.
- All other roles see locked (blurred) documents when `billed_at` is null.
- Web: clicking a locked document opens the QR payment modal.
- Mobile: locked rows show a 🔒 chip and the detail screen presents a "Dobiť kredit" sticky bar.
- The `/api/documents/[id]/pdf` and `/xml` endpoints return `403` for non-super-admins on locked rows.

### Processor isolation

- Processors are redirected to `/dashboard/inbox` on login (no dashboard page).
- Processors can **only** see documents assigned to their department(s).
- Unassigned documents are invisible to processors.
- Direct URL access to unassigned documents returns `404`.

### Inbox smart defaults

- Operators land on Inbox with `?status=unassigned` filter (focus on triage).
- Processors land on Inbox with `?status=assigned` filter (focus on their work).

### Company switcher & context-aware roles

- Top bar shows a company switcher dropdown with role badge per company.
- Selecting a company changes the active role to the user's role *in that company*.
- Navigation items, role badge, and user avatar dropdown all update reactively.
- Example: user is `company_admin` in Company A but `operator` in Company B — switching companies changes their visible nav items.
- "All Companies" mode uses the highest global role.
- Super admin role is always `super_admin` regardless of company selection.

### Single role per company

- Each company membership has exactly one role (not an array).
- Roles are hierarchical: `company_admin > operator > processor`.
- UI uses radio buttons (not checkboxes) for role selection everywhere.
- The invite dialog, edit role dialog, user drawer, and direct assignment all enforce single selection.

### Direct user assignment

- Company admins and super admins can assign existing onboarded users to companies directly from the user detail drawer.
- No invitation email flow — instant membership creation.
- Reactivates previously deactivated memberships if they exist.

### Push notifications

- Push fan-out targets only **active `company_admin`** members of the receiving company.
- Operators and processors do not receive push notifications today (UI shows new docs the next time they open the app).
- Super admins receive no push notifications regardless of membership status.
- Push token registration is per-device; signing out from mobile deletes the row.
