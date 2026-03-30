# peppolbox.sk — Permissions & Roles

## Roles Overview

| Role                      | Scope       | Created by                   | Description                                                                   |
| ------------------------- | ----------- | ---------------------------- | ----------------------------------------------------------------------------- |
| **Super Admin**           | Global      | SQL (manual)                 | Full system access. Manages all companies, users, settings.                   |
| **Genesis Company Admin** | Per company | PFS webhook (auto)           | First admin of a company. Cannot be removed by other admins. Owns the wallet. |
| **Company Admin**         | Per company | Genesis admin or Super admin | Manages users and documents for assigned companies.                           |
| **Operator**              | Per company | Company admin                | Triages documents, manages department members. Cannot invite users.           |
| **Processor**             | Per company | Company admin                | Read-only access to documents in their assigned department(s).                |

---

## Navigation Access

| Page       | Super Admin        | Genesis Admin                 | Company Admin                 | Operator        | Processor           |
| ---------- | ------------------ | ----------------------------- | ----------------------------- | --------------- | ------------------- |
| Dashboard  | Stats + onboarding | Company cards + test invoices | Company cards + test invoices | Company cards   | Redirected to Inbox |
| Inbox      | All documents      | Own companies                 | Own companies                 | Own companies   | Own department only |
| Companies  | All                | Own                           | Own                           | Own (read-only) | Own (read-only)     |
| Users      | All                | Own companies                 | Own companies                 | View only       | No access           |
| Webhooks   | Yes (all)          | Own companies                 | Own companies                 | No              | No                  |
| Wallet     | Via company detail | Yes (owner)                   | Yes (shared)                  | Yes (shared)    | No                  |
| Operations | Full access        | Own companies only            | No                            | No              | No                  |
| Audit Log  | All events         | Own companies                 | Own companies                 | Own companies   | No                  |
| Settings   | Profile + system   | Profile only                  | Profile only                  | Profile only    | No                  |

---

## Detailed Permission Matrix

### Company Management

| Action                                    | Super Admin | Genesis Admin               | Company Admin | Operator | Processor |
| ----------------------------------------- | ----------- | --------------------------- | ------------- | -------- | --------- |
| View all companies                        | Yes         | No                          | No            | No       | No        |
| View own companies                        | Yes         | Yes                         | Yes           | Yes      | Yes       |
| Edit company details (name, email, phone) | Yes         | Yes                         | Yes           | No       | No        |
| Activate company on Peppol (manual)       | Yes         | Yes (auto on invite accept) | No            | No       | No        |
| Deactivate company                        | Yes         | No                          | No            | No       | No        |
| Reactivate company                        | Yes         | No                          | No            | No       | No        |
| Set company pricing                       | Yes         | No                          | No            | No       | No        |

### User & Invitation Management

| Action                        | Super Admin | Genesis Admin                  | Company Admin | Operator | Processor |
| ----------------------------- | ----------- | ------------------------------ | ------------- | -------- | --------- |
| Invite super admin            | Yes         | No                             | No            | No       | No        |
| Invite company admin          | Yes         | Yes                            | No            | No       | No        |
| Invite operator               | Yes         | Yes                            | Yes           | No       | No        |
| Invite processor              | Yes         | Yes                            | Yes           | No       | No        |
| Resend invitation             | Yes         | Yes                            | Yes           | No       | No        |
| Revoke invitation             | Yes         | Yes                            | Yes           | No       | No        |
| Deactivate genesis admin      | Yes         | No                             | No            | No       | No        |
| Deactivate company admin      | Yes         | Yes                            | No            | No       | No        |
| Deactivate operator/processor | Yes         | Yes                            | Yes           | No       | No        |
| Reactivate member             | Yes         | Yes                            | Yes           | No       | No        |
| Update member roles           | Yes         | Yes (can assign company_admin) | No            | No       | No        |

### Department Management

| Action                        | Super Admin | Genesis Admin | Company Admin | Operator | Processor |
| ----------------------------- | ----------- | ------------- | ------------- | -------- | --------- |
| Create department             | Yes         | Yes           | Yes           | No       | No        |
| Rename department             | Yes         | Yes           | Yes           | No       | No        |
| Delete department             | Yes         | Yes           | Yes           | No       | No        |
| Add member to department      | Yes         | Yes           | Yes           | Yes      | No        |
| Remove member from department | Yes         | Yes           | Yes           | Yes      | No        |

### Document / Inbox

| Action                            | Super Admin   | Genesis Admin      | Company Admin      | Operator           | Processor          |
| --------------------------------- | ------------- | ------------------ | ------------------ | ------------------ | ------------------ |
| View all documents                | Yes           | No                 | No                 | No                 | No                 |
| View own company documents        | Yes           | Yes                | Yes                | Yes                | Own dept only      |
| View unassigned documents         | Yes           | Yes                | Yes                | Yes                | No                 |
| Click row to open detail          | Yes           | Yes                | Yes                | Yes                | Yes                |
| View document detail              | Yes           | Yes                | Yes                | Yes                | Own dept only      |
| Download PDF (hover icon)         | Yes           | Yes                | Yes                | Yes                | Yes                |
| Download XML                      | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mass download (select + download) | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mark as read (auto on view)       | Yes           | Yes                | Yes                | Yes                | Yes                |
| Mark as Processed (with note)     | Yes           | Yes                | Yes                | Yes                | Yes                |
| Add note to document              | Yes           | Yes                | Yes                | Yes                | Yes                |
| View document activity timeline   | Yes           | Yes                | Yes                | Yes                | Yes                |
| Assign to department (triage)     | Yes           | Yes                | Yes                | Yes                | No                 |
| Bulk assign documents             | Yes           | Yes                | Yes                | Yes                | No                 |
| View locked documents (billing)   | Yes (no lock) | Locked if unbilled | Locked if unbilled | Locked if unbilled | Locked if unbilled |
| Click locked doc → payment modal  | N/A           | Yes                | Yes                | Yes                | Yes                |

### Wallet & Billing

| Action                     | Super Admin        | Genesis Admin | Company Admin | Operator     | Processor |
| -------------------------- | ------------------ | ------------- | ------------- | ------------ | --------- |
| View wallet balance        | Via company detail | Yes (owner)   | Yes (shared)  | Yes (shared) | No        |
| Top up wallet (QR payment) | No                 | Yes           | Yes           | Yes          | No        |
| View transaction history   | Via company detail | Yes           | Yes           | Yes          | No        |
| Export statement (CSV)     | Via company detail | Yes           | Yes           | No           | No        |
| Adjust balance (manual)    | Yes                | No            | No            | No           | No        |
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

### Test Invoices

| Action             | Super Admin | Genesis Admin            | Company Admin            | Operator | Processor |
| ------------------ | ----------- | ------------------------ | ------------------------ | -------- | --------- |
| Send test invoices | Yes         | Yes (own, Peppol active) | Yes (own, Peppol active) | No       | No        |

### System Settings

| Action                   | Super Admin | Genesis Admin | Company Admin | Operator | Processor |
| ------------------------ | ----------- | ------------- | ------------- | -------- | --------- |
| Update system settings   | Yes         | No            | No            | No       | No        |
| Update own profile       | Yes         | Yes           | Yes           | Yes      | Yes       |
| View PFS activation link | Yes         | No            | No            | No       | No        |

### Audit Log

| Action                  | Super Admin | Genesis Admin | Company Admin | Operator | Processor |
| ----------------------- | ----------- | ------------- | ------------- | -------- | --------- |
| View all audit events   | Yes         | No            | No            | No       | No        |
| View own company events | Yes         | Yes           | Yes           | Yes      | No        |
| Filter by company       | Yes         | Yes           | Yes           | No       | No        |

---

## Special Rules

### Genesis Admin Protection
- Genesis admin **cannot** be deactivated by another company admin — only by super admin.
- Genesis admin **cannot** be removed from their company.
- Only genesis admin (or super admin) can assign the `company_admin` role to others.

### Wallet Ownership
- One wallet per genesis admin, shared across all their companies.
- Non-genesis users see "Shared wallet (managed by your company admin)" badge.
- Super admin accesses wallets via `/dashboard/wallet/[walletId]`, not their own wallet page.

### Document Billing Lock
- Super admins **never** see locked documents — they bypass billing checks.
- All other roles see locked (blurred) documents when `billed_at` is null.
- Clicking a locked document opens the QR payment modal (not a blocked page).

### Processor Isolation
- Processors are redirected to `/dashboard/inbox` on login (no dashboard page).
- Processors can **only** see documents assigned to their department(s).
- Unassigned documents are invisible to processors.
- Direct URL access to unassigned documents returns 404.

### Inbox Smart Defaults
- Operators land on Inbox with `?status=unassigned` filter (focus on triage).
- Processors land on Inbox with `?status=assigned` filter (focus on their work).
