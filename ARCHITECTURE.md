# peppolbox.sk — Architecture & Flow Documentation

## Tech Stack

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| Frontend     | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui v4 |
| Auth         | Supabase Auth (Google, Apple OAuth + passwordless OTP)          |
| Database     | Supabase (PostgreSQL with RLS)                                  |
| Email        | Resend                                                          |
| SMS          | Twilio                                                          |
| Peppol AP    | ion-AP (test: test.ion-ap.net)                                  |
| Payments     | PayMe.sk QR + KVERKOM mTLS API                                  |
| Blob Storage | Vercel Blob (XML documents)                                     |
| Hosting      | Vercel                                                          |
| Tests        | Vitest (71 tests)                                               |

## Database Schema

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    profiles       │     │    companies      │     │   departments    │
│──────────────────│     │──────────────────│     │──────────────────│
│ id (PK, FK→auth) │     │ id (PK)          │     │ id (PK)          │
│ full_name         │     │ dic (unique)     │     │ company_id (FK)  │
│ avatar_url        │     │ legal_name       │     │ parent_id (FK)   │
│ phone             │     │ company_email    │     │ name             │
│ is_super_admin    │     │ company_phone    │     └──────────────────┘
│ onboarded_at      │     │ status           │              │
└──────────────────┘     │ deactivated_at   │     ┌────────┴─────────┐
         │                │ ion_ap_org_id    │     │ department_      │
         │                │ ion_ap_status    │     │ memberships      │
┌────────┴─────────┐     │ ion_ap_activated │     │──────────────────│
│ company_          │     │   _at            │     │ user_id (FK)     │
│ memberships       │     │ price_per_       │     │ department_id(FK)│
│──────────────────│     │   document       │     └──────────────────┘
│ user_id (FK)      │     └──────────────────┘
│ company_id (FK)   │              │
│ role (single)     │              │
│ is_genesis        │     ┌────────┴─────────┐
│ status            │     │   documents      │
│ invited_by (FK)   │     │──────────────────│
└──────────────────┘     │ company_id (FK)  │
                          │ department_id(FK)│
┌──────────────────┐     │ direction        │
│  invitations      │     │ status           │
│──────────────────│     │ ion_ap_trans_id  │
│ email             │     │ document_type    │
│ roles[]           │     │ document_id      │
│ company_ids[]     │     │ sender_id        │
│ is_genesis        │     │ receiver_id      │
│ token (unique)    │     │ blob_url         │
│ expires_at (48h)  │     │ metadata (jsonb) │
│ accepted_at       │     │ billed_at        │
└──────────────────┘     │ wallet_txn_id(FK)│
                          └──────────────────┘
┌──────────────────┐
│ pfs_verifications │     ┌──────────────────┐
│──────────────────│     │  wallets          │
│ verification_     │     │──────────────────│
│   token           │     │ owner_id (FK,    │
│ dic               │     │   unique)        │
│ legal_name        │     │ available_       │
│ company_email     │     │   balance        │
└──────────────────┘     └──────────────────┘
                                   │
┌──────────────────┐     ┌────────┴─────────┐
│  audit_logs       │     │ wallet_          │
│  (partitioned)    │     │ transactions     │
│──────────────────│     │──────────────────│
│ event_id          │     │ wallet_id (FK)   │
│ event_name        │     │ company_id (FK)  │
│ severity          │     │ document_id (FK) │
│ actor_id/email    │     │ type (enum)      │
│ company_id/dic    │     │ amount           │
│ source_ip         │     │ balance_after    │
│ details (jsonb)   │     │ description      │
│ cef (string)      │     │ metadata (jsonb) │
└──────────────────┘     └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│ payment_links     │     │ system_settings  │
│──────────────────│     │──────────────────│
│ wallet_id (FK)   │     │ key (PK)         │
│ external_txn_id  │     │ value            │
│ amount           │     │ description      │
│ status (enum)    │     │ updated_by (FK)  │
│ payme_url        │     └──────────────────┘
│ is_public        │     ┌──────────────────┐
│ expires_at (24h) │     │ document_notes   │
└──────────────────┘     │──────────────────│
                          │ document_id (FK) │
                          │ user_id (FK)     │
                          │ note             │
                          │ type (comment/   │
                          │   processed)     │
                          └──────────────────┘
```

## Permission Model

Each user has a **single role per company** (`company_memberships.role`). Roles are hierarchical:
`company_admin > operator > processor`. Super admin is a global flag on the profile.

```
Super Admin (global, profiles.is_super_admin)
├── See everything
├── Create other super admins
├── Activate/deactivate companies on Peppol
├── Reactivate deactivated companies
├── Send onboarding requests
├── Manage all users and invitations
├── Directly assign existing users to companies
├── Adjust wallet balances
├── Set company pricing
├── View all audit logs
├── Access any wallet detail page
└── Nav: Dashboard, Inbox, Companies, Users, Webhooks, Operations

Genesis Company Admin (per company, is_genesis=true)
├── Invited automatically from PFS webhook
├── Cannot be removed by other company admins
├── Invite other company admins (for own companies)
├── Invite operators and processors
├── Deactivate non-genesis admins, operators, processors
├── Directly assign existing users to own companies
├── Create and manage departments
├── Manage department members
├── Triage documents (assign to departments)
├── Download documents (XML/PDF)
├── Owns the wallet (shared across their companies)
└── Nav: Dashboard, Inbox, Companies, Users, Wallet, Operations

Company Admin (per company)
├── Invited by genesis admin or super admin
├── Invite operators and processors
├── Cannot deactivate other admins
├── Triage documents (assign to departments)
├── Download documents (XML/PDF)
├── View own company data
└── Nav: Dashboard, Inbox, Companies, Users, Wallet, Operations

Operator (per company)
├── Invited by company admin
├── Triage documents (assign to departments)
├── Manage department members
├── View documents for assigned companies
├── Cannot invite anyone
└── Nav: Dashboard, Inbox, Companies, Users, Wallet

Processor (per company)
├── Invited by company admin
├── Can only see documents assigned to their department(s)
├── Read-only access
├── Cannot triage or invite anyone
├── Redirected to Inbox (no dashboard)
└── Nav: Inbox, Companies

Settings and Audit Log are accessible from the user avatar dropdown (all roles).
```

## Flows

### 1. New Customer Onboarding (via PFS Webhook)

```
Customer registers    PFS System              peppolbox.sk              Genesis Admin
on PFS portal         ──────────              ────────────              ─────────────
     │                     │                     │                          │
     │ Completes           │                     │                          │
     │ registration        │                     │                          │
     │───────────────────→ │                     │                          │
     │                     │ POST /api/webhooks/ │                          │
     │                     │ pfs (HMAC-SHA256)   │                          │
     │                     │───────────────────→ │                          │
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ 1. Verify  │                   │
     │                     │               │    HMAC    │                   │
     │                     │               │ 2. Log raw │                   │
     │                     │               │    webhook │                   │
     │                     │               │ 3. Create  │                   │
     │                     │               │    company │                   │
     │                     │               │    (0.01   │                   │
     │                     │               │    EUR/doc)│                   │
     │                     │               │ 4. Pre-    │                   │
     │                     │               │    create  │                   │
     │                     │               │    auth    │                   │
     │                     │               │    user    │                   │
     │                     │               │ 5. Create  │                   │
     │                     │               │    invite  │                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │                          │
     │                     │                     │ Email (Resend)           │
     │                     │                     │ Magic link               │
     │                     │                     │────────────────────────→ │
     │                     │                     │                          │
     │                     │                     │           Clicks link    │
     │                     │                     │ GET /invite/[token]/     │
     │                     │                     │ accept                   │
     │                     │                     │◄────────────────────────│
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ 1. Create  │                   │
     │                     │               │    session │                   │
     │                     │               │ 2. Upsert  │                   │
     │                     │               │    profile │                   │
     │                     │               │ 3. Create  │                   │
     │                     │               │    member- │                   │
     │                     │               │    ship    │                   │
     │                     │               │    (genesis│                   │
     │                     │               │     admin) │                   │
     │                     │               │ 4. Redirect│                   │
     │                     │               │    to      │                   │
     │                     │               │    /activate│                  │
     │                     │               └─────┬──────┘                   │
     │                     │                     │                          │
     │                     │                     │ /activate page           │
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ 1. Auto-   │                   │
     │                     │               │    activate│                   │
     │                     │               │    on ion-AP│                  │
     │                     │               │ 2. Create  │                   │
     │                     │               │    wallet  │                   │
     │                     │               │    (0.50   │                   │
     │                     │               │    EUR)    │                   │
     │                     │               │ 3. Set     │                   │
     │                     │               │    onboard-│                   │
     │                     │               │    ed_at   │                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │                          │
     │                     │                     │ "Active on Peppol!"      │
     │                     │                     │ → Go to Dashboard        │
     │                     │                     │────────────────────────→ │
```

### 2. User Authentication

```
                    ┌─────────────────────────────────┐
                    │       Sign In Modal              │
                    │  "Sign in to peppolbox.sk"       │
                    │                                  │
                    │  ┌───────────────────────────┐   │
                    │  │  Continue with Google     │   │
                    │  └───────────────────────────┘   │
                    │  ┌───────────────────────────┐   │
                    │  │  Continue with Apple      │   │
                    │  └───────────────────────────┘   │
                    │                                  │
                    │  ─────────── OR ──────────────   │
                    │                                  │
                    │  Email: [________________]       │
                    │  [  Continue with Email  ]       │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────┴───────────────────┐
                    │     Choose Verification           │
                    │                                   │
                    │  [ Send code to email ]            │
                    │                                   │
                    │  Phone: [+421 9XX XXX XXX]        │
                    │  [ Send code via SMS ]             │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────┴───────────────────┐
                    │     Enter 6-digit code            │
                    │                                   │
                    │     [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ]│
                    │                                   │
                    │     Auto-submits on 6th digit     │
                    │     ← Verified → Signed in        │
                    └──────────────────────────────────┘
```

### 3. Peppol Activation (Automatic on Genesis Accept)

```
Genesis Admin         peppolbox.sk              ion-AP              Peppol Network
─────────────         ────────────              ──────              ──────────────
     │                   │                        │                       │
     │ Clicks magic link │                        │                       │
     │ in invitation     │                        │                       │
     │─────────────────→ │                        │                       │
     │                   │                        │                       │
     │             ┌─────┴──────┐                 │                       │
     │             │ 1. Create  │                 │                       │
     │             │    session │                 │                       │
     │             │ 2. Create  │                 │                       │
     │             │    member- │                 │                       │
     │             │    ship    │                 │                       │
     │             │ 3. Redirect│                 │                       │
     │             │    /activate│                │                       │
     │             └─────┬──────┘                 │                       │
     │                   │                        │                       │
     │             ┌─────┴──────┐                 │                       │
     │             │ 1. Create  │                 │                       │
     │             │    org     │                 │                       │
     │             └─────┬──────┘                 │                       │
     │                   │ POST /organizations/   │                       │
     │                   │──────────────────────→ │                       │
     │                   │ ← org {id: 42}         │                       │
     │                   │                        │                       │
     │             ┌─────┴──────┐                 │                       │
     │             │ 2. Create  │                 │                       │
     │             │    ID      │                 │                       │
     │             │ 0245:DIC   │                 │                       │
     │             └─────┬──────┘                 │                       │
     │                   │ POST /orgs/42/ids/     │                       │
     │                   │──────────────────────→ │                       │
     │                   │                        │ Publish to SMP        │
     │                   │                        │─────────────────────→ │
     │                   │                        │                       │
     │             ┌─────┴──────┐                 │                       │
     │             │ 3. Create  │                 │                       │
     │             │    webhook │                 │                       │
     │             │    trigger │                 │                       │
     │             └─────┬──────┘                 │                       │
     │                   │                        │                       │
     │             ┌─────┴──────┐                 │                       │
     │             │ 4. Create  │                 │                       │
     │             │    wallet  │                 │                       │
     │             │    +0.50EUR│                 │                       │
     │             │ 5. Set     │                 │                       │
     │             │  onboarded │                 │                       │
     │             └─────┬──────┘                 │                       │
     │                   │                        │                       │
     │ ← "Active!" badge │                        │                       │
     │   → Go to Dash    │                        │                       │
     │◄─────────────────│                        │                       │
```

### 4. Receiving a Peppol Invoice

```
Sender               Sender's AP          ion-AP              peppolbox.sk        User
──────               ──────────           ──────              ────────────        ────
  │                      │                   │                   │                  │
  │ Sends invoice        │                   │                   │                  │
  │────────────────────→ │                   │                   │                  │
  │                      │ AS4 message       │                   │                  │
  │                      │─────────────────→ │                   │                  │
  │                      │                   │ Receive trigger   │                  │
  │                      │                   │ fires webhook     │                  │
  │                      │                   │─────────────────→ │                  │
  │                      │                   │             ┌─────┴──────┐           │
  │                      │                   │             │ 1. Fetch   │           │
  │                      │                   │             │    XML doc │           │
  │                      │                   │             │ 2. Store   │           │
  │                      │                   │             │    in blob │           │
  │                      │                   │             │ 3. Parse   │           │
  │                      │                   │             │    UBL     │           │
  │                      │                   │             │ 4. Charge  │           │
  │                      │                   │             │    wallet  │           │
  │                      │                   │             │    (0.01)  │           │
  │                      │                   │             │ 5. Email   │           │
  │                      │                   │             │    notify  │           │
  │                      │                   │             │ 6. Audit   │           │
  │                      │                   │             └─────┬──────┘           │
  │                      │                   │                   │ Email:           │
  │                      │                   │                   │ "New Invoice     │
  │                      │                   │                   │  from Supplier"  │
  │                      │                   │                   │────────────────→ │
  │                      │                   │                   │                  │
  │                      │                   │                   │ Opens Inbox      │
  │                      │                   │                   │◄────────────────│
  │                      │                   │                   │ Click row →      │
  │                      │                   │                   │ detail + auto-   │
  │                      │                   │                   │ mark read        │
  │                      │                   │                   │────────────────→ │
```

### 5. Prepaid Billing & Payment Flow

```
User                 peppolbox.sk              PayMe.sk            KVERKOM
────                 ────────────              ────────            ───────
  │                      │                       │                   │
  │ Clicks locked doc    │                       │                   │
  │─────────────────────→│                       │                   │
  │                      │                       │                   │
  │ ← QR payment modal   │                       │                   │
  │  (amount input +     │                       │                   │
  │   QR code)           │                       │                   │
  │◄────────────────────│                       │                   │
  │                      │                       │                   │
  │ Scans QR / opens     │                       │                   │
  │ banking app          │                       │                   │
  │─────────────────────────────────────────────→│                   │
  │                      │                       │                   │
  │  (client polls       │ GET /check-payment    │                   │
  │   every 4s)          │ checks KVERKOM        │                   │
  │                      │──────────────────────────────────────────→│
  │                      │                       │   ACCC status     │
  │                      │◄──────────────────────────────────────────│
  │                      │                       │                   │
  │                ┌─────┴──────┐                │                   │
  │                │ 1. Top-up  │                │                   │
  │                │    wallet  │                │                   │
  │                │ 2. Auto-   │                │                   │
  │                │    bill all│                │                   │
  │                │    docs    │                │                   │
  │                │ 3. Send    │                │                   │
  │                │    billing │                │                   │
  │                │    invoice │                │                   │
  │                │    (Peppol)│                │                   │
  │                └─────┬──────┘                │                   │
  │                      │                       │                   │
  │ ← "Payment received!"│                       │                   │
  │   docs unlocked       │                       │                   │
  │   → navigate to doc   │                       │                   │
  │◄────────────────────│                       │                   │
```

### 6. Company Deactivation & Reactivation

```
Super Admin           peppolbox.sk              ion-AP
───────────           ────────────              ──────

DEACTIVATION:
     │                   │                        │
     │ Danger Zone →     │                        │
     │ "Deactivate"      │                        │
     │─────────────────→ │                        │
     │                   │ PATCH /orgs/{id}/      │
     │                   │ {publish_in_smp:false} │
     │                   │──────────────────────→ │
     │                   │ DELETE /orgs/{id}/ids  │
     │                   │──────────────────────→ │
     │             ┌─────┴──────┐                 │
     │             │ 1. Deact.  │                 │
     │             │    members │                 │
     │             │ 2. Set     │                 │
     │             │    company │                 │
     │             │    deactiv.│                 │
     │             └─────┬──────┘                 │

REACTIVATION:
     │                   │                        │
     │ "Reactivate" →    │                        │
     │ edit name, email  │                        │
     │ genesis email     │                        │
     │─────────────────→ │                        │
     │             ┌─────┴──────┐                 │
     │             │ 1. Set     │                 │
     │             │    company │                 │
     │             │    active  │                 │
     │             │ 2. Send    │                 │
     │             │    genesis │                 │
     │             │    invite  │                 │
     │             └─────┬──────┘                 │
     │                   │                        │
     │   (Genesis accepts invite →                │
     │    auto-activation on /activate            │
     │    same as flow #3)                        │
```

## API Routes

| Route                             | Method | Auth          | Purpose                                                                                    |
| --------------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------ |
| `/api/webhooks/pfs`               | POST   | HMAC-SHA256   | PFS company registration webhook                                                           |
| `/api/webhooks/peppol-receive`    | POST   | None (ion-AP) | Incoming Peppol document webhook                                                           |
| `/api/webhooks/payment-received`  | POST   | Bearer token  | Payment confirmation webhook (fallback)                                                    |
| `/api/auth/send-code`             | POST   | None          | Send OTP code (email/SMS)                                                                  |
| `/api/auth/verify-code`           | POST   | None          | Verify OTP + create session                                                                |
| `/auth/callback`                  | GET    | OAuth         | OAuth callback (Google/Apple)                                                              |
| `/invite/[token]/accept`          | GET    | None          | Magic link invitation accept                                                               |
| `/api/invitations/accept`         | POST   | Session       | Manual invitation accept                                                                   |
| `/api/documents/list`             | GET    | Session       | List documents with filtering/pagination                                                   |
| `/api/documents/[id]/pdf`         | GET    | Session       | PDF proxy to ion-AP                                                                        |
| `/api/documents/[id]/xml`         | GET    | Session       | XML from blob storage                                                                      |
| `/api/departments/by-company`     | GET    | Session       | List departments for a company                                                             |
| `/api/departments/remove-member`  | POST   | Session       | Remove user from department                                                                |
| `/api/wallet/create-payment-link` | POST   | Session       | Generate QR payment link                                                                   |
| `/api/wallet/check-payment`       | GET    | None (UUID)   | Poll for payment confirmation                                                              |
| `/api/wallet/statement`           | GET    | Session       | Export transaction statement (CSV)                                                         |
| `/api/cron/maintenance`           | GET    | CRON_SECRET   | Auto-heal: retry docs, check payments, retry activations, retry billing, manage partitions |

## Dashboard Pages

| Route                          | Roles     | Purpose                                                                          |
| ------------------------------ | --------- | -------------------------------------------------------------------------------- |
| `/dashboard`                   | All       | Role-specific dashboard                                                          |
| `/dashboard/inbox`             | All       | Received Peppol documents (clickable rows, PDF hover, mass download)             |
| `/dashboard/inbox/[id]`        | All       | Document detail, metadata, PDF                                                   |
| `/dashboard/companies`         | All       | Companies list with Peppol status                                                |
| `/dashboard/companies/[id]`    | All       | Company detail, members, departments, Peppol activation, pricing                 |
| `/dashboard/users`             | SA, Admin | Users & invitations management, user detail drawer with direct assignment        |
| `/dashboard/webhooks`          | SA        | PFS webhook log (super admin only)                                               |
| `/dashboard/audit`             | All       | CEF audit log viewer (accessed via user avatar dropdown)                         |
| `/dashboard/settings`          | All       | Profile + system settings (SA) (accessed via user avatar dropdown)               |
| `/dashboard/wallet`            | All       | Wallet balance, top-up, transaction history, statement export                    |
| `/dashboard/wallet/[walletId]` | SA        | Wallet detail, adjust balance                                                    |
| `/dashboard/operations`        | SA, Admin | Operations Center — retry activations, documents, payments, billing, invitations |
| `/dashboard/test-tracker`      | SA        | Manual test progress tracker                                                     |
| `/activate`                    | Genesis   | Peppol activation landing page                                                   |
| `/pay/[token]`                 | Public    | Public payment page (QR, no login required)                                      |

## Audit Events (CEF Format)

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| AUTH_SIGN_IN                   | info     | User signed in (google/apple/otp/magic_link)     |
| AUTH_SIGN_OUT                  | info     | User signed out                                  |
| AUTH_OTP_SENT                  | info     | OTP code sent (email/sms)                        |
| AUTH_OTP_VERIFIED              | info     | OTP code verified                                |
| INVITE_CREATED                 | info     | Invitation created                               |
| INVITE_ACCEPTED                | info     | Invitation accepted                              |
| INVITATION_RESENT              | info     | Invitation resent                                |
| INVITATION_REVOKED             | warning  | Invitation revoked (expired early)               |
| MEMBERSHIP_CREATED             | info     | Company membership created                       |
| MEMBERSHIP_DEACTIVATED         | warning  | Company membership deactivated                   |
| MEMBERSHIP_REACTIVATED         | info     | Company membership reactivated                   |
| MEMBER_ROLE_UPDATED            | info     | Member role changed                              |
| MEMBER_ASSIGNED                | info     | User directly assigned to company (no invite)    |
| WEBHOOK_RECEIVED               | info     | PFS webhook received                             |
| PROFILE_UPDATED                | info     | Profile updated                                  |
| USER_ONBOARDED                 | info     | User completed onboarding                        |
| SUPER_ADMIN_GRANTED            | warning  | Super admin role granted                         |
| DEPARTMENT_CREATED             | info     | Department created                               |
| DEPARTMENT_RENAMED             | info     | Department renamed                               |
| DEPARTMENT_DELETED             | warning  | Department deleted                               |
| DEPARTMENT_MEMBER_ADDED        | info     | User added to department                         |
| DEPARTMENT_MEMBER_REMOVED      | info     | User removed from department                     |
| PEPPOL_COMPANY_ACTIVATED       | info     | Company activated on Peppol                      |
| PEPPOL_ACTIVATION_FAILED       | error    | Peppol activation failed                         |
| PEPPOL_DOCUMENT_RECEIVED       | info     | Peppol document received and processed           |
| DOCUMENT_PROCESSED             | info     | Document marked as processed (with note)         |
| DOCUMENTS_BULK_PROCESSED       | info     | Documents bulk exported (XML) and marked processed |
| DOCUMENT_NOTE_ADDED            | info     | Note added to document                           |
| DOCUMENT_ASSIGNED              | info     | Document assigned to department                  |
| DOCUMENTS_BULK_ASSIGNED        | info     | Documents bulk assigned                          |
| DOCUMENT_MANUAL_RETRY          | info     | Document processing manually retried             |
| DOCUMENT_PROCESSING_FAILED     | error    | Document processing failed (max retries)         |
| DOCUMENT_PROCESSING_RETRY      | warning  | Document processing failed, will retry           |
| DOCUMENT_CHARGED               | info     | Document charged to wallet                       |
| DOCUMENT_UNBILLED              | warning  | Document arrived but wallet insufficient         |
| COMPANY_DEACTIVATED            | warning  | Company deactivated                              |
| COMPANY_REACTIVATED            | info     | Company reactivated                              |
| COMPANY_UPDATED                | info     | Company details updated                          |
| COMPANY_PRICING_UPDATED        | info     | Company pricing changed                          |
| WALLET_TOPPED_UP               | info     | Wallet received funds                            |
| WALLET_ADJUSTED                | info     | Manual balance adjustment by super admin         |
| AUTO_BILL_COMPLETED            | info     | Auto-billing round completed                     |
| PAYMENT_LINK_CREATED           | info     | Payment link generated                           |
| PAYMENT_RECEIVED               | info     | QR payment confirmed and processed               |
| BILLING_INVOICE_SENT           | info     | Billing invoice sent via Peppol after payment    |
| ONBOARDING_REQUEST_SENT        | info     | Onboarding request sent to customer              |
| TEST_INVOICES_SENT             | info     | Test invoices sent to company                    |
| SYSTEM_SETTINGS_UPDATED        | info     | System settings changed                          |
| OPS_ACTIVATION_RETRIED         | warning  | Operator retried Peppol activation               |
| OPS_DOCUMENT_RETRIED           | warning  | Operator retried document processing             |
| OPS_DOCUMENTS_BULK_RETRIED     | warning  | Operator bulk retried failed documents           |
| OPS_DOCUMENT_STATUS_FORCED     | warning  | Super admin forced document status               |
| OPS_PAYMENT_FORCE_CHECKED      | warning  | Operator force-checked payment status            |
| OPS_PAYMENT_MANUALLY_COMPLETED | warning  | Super admin manually completed payment           |
| OPS_AUTOBILL_RETRIED           | warning  | Operator retried auto-billing                    |
| OPS_DOCUMENT_FORCE_BILLED      | warning  | Super admin force-billed document                |
| OPS_INVITATION_EXTENDED        | info     | Operator extended invitation expiry              |
| CRON_DOCUMENTS_RETRIED         | info     | Cron retried pending documents                   |
| CRON_AUDIT_ARCHIVED            | info     | Cron archived audit partitions                   |
| CRON_PAYMENTS_CONFIRMED        | info     | Cron confirmed pending payments                  |
| CRON_ACTIVATIONS_HEALED        | info     | Cron auto-healed failed Peppol activations       |
| CRON_BILLING_HEALED            | info     | Cron auto-billed documents with positive balance |

## Environment Variables

| Variable                        | Required | Description                                         |
| ------------------------------- | -------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anon key                                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Supabase service role key                           |
| `RESEND_API_KEY`                | Yes      | Resend email API key                                |
| `TWILIO_ACCOUNT_SID`            | Yes      | Twilio account SID                                  |
| `TWILIO_AUTH_TOKEN`             | Yes      | Twilio auth token                                   |
| `BLOB_READ_WRITE_TOKEN`         | Yes      | Vercel Blob storage token                           |
| `CRON_SECRET`                   | Yes      | Cron job authentication secret                      |
| `PAYME_IBAN`                    | Yes      | IBAN for QR payment links                           |
| `PAYMENT_WEBHOOK_SECRET`        | Yes      | HMAC secret for payment webhook                     |
| `KV_API_URL`                    | Yes      | KVERKOM API URL for payment verification            |
| `KV_CERT`                       | Yes      | mTLS client certificate (PEM)                       |
| `KV_KEY`                        | Yes      | mTLS client key (PEM)                               |
| `KV_CA_BUNDLE`                  | Yes      | mTLS CA bundle (PEM)                                |
| `ION_AP_TEST_SENDER_TOKEN`      | No       | ion-AP token for test invoices and billing invoices |
| `NEXT_PUBLIC_APP_URL`           | No       | App URL (default: www.peppolbox.sk)                 |
| `PAYME_CREDITOR_NAME`           | No       | Creditor name for QR (default: peppolbox.sk)        |

System settings (editable in dashboard, override env vars):
`resend_from_email`, `pfs_webhook_secret`, `pfs_activation_link`, `ion_ap_base_url`, `ion_ap_api_token`, `twilio_phone_number`

## Test Coverage (71 tests)

| File                 | Tests | Coverage                                                       |
| -------------------- | ----- | -------------------------------------------------------------- |
| billing.test.ts      | 32    | Wallet ops, charging, auto-billing, all-or-nothing, edge cases |
| ion-ap.test.ts       | 8     | API client, lazy activation, error handling                    |
| webhook.test.ts      | 6     | Signature validation, payload validation, DIC format           |
| navigation.test.ts   | 3     | Role-based nav items                                           |
| verification.test.ts | 5     | OTP code generation, verify, expiry                            |
| invitations.test.ts  | 4     | Create invite, pre-create user, genesis skip, URL format       |
| permissions.test.ts  | 5     | Deactivation permission rules                                  |
| departments.test.ts  | 5     | Department CRUD permissions                                    |
| audit.test.ts        | 3     | CEF format, severity mapping, fire-and-forget                  |
