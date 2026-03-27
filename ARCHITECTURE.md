# Postar — Architecture & Flow Documentation

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui v4 |
| Auth | Supabase Auth (Google, Apple OAuth + passwordless OTP) |
| Database | Supabase (PostgreSQL with RLS) |
| Email | Resend |
| SMS | Twilio |
| Peppol AP | ion-AP (test: test.ion-ap.net) |
| Hosting | Vercel |
| Tests | Vitest (39 tests) |

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
│ pfs_activation_   │     │ status           │              │
│   link            │     │ deactivated_at   │     ┌────────┴─────────┐
│ onboarded_at      │     │ ion_ap_org_id    │     │ department_      │
└──────────────────┘     │ ion_ap_status    │     │ memberships      │
         │                │ ion_ap_activated │     │──────────────────│
         │                │   _at            │     │ user_id (FK)     │
┌────────┴─────────┐     └──────────────────┘     │ department_id(FK)│
│ company_          │              │                └──────────────────┘
│ memberships       │              │
│──────────────────│     ┌────────┴─────────┐
│ user_id (FK)      │     │   documents      │
│ company_id (FK)   │     │──────────────────│
│ role              │     │ company_id (FK)  │
│ is_genesis        │     │ department_id(FK)│
│ status            │     │ assigned_to_     │
│ invited_by (FK)   │     │   company_id(FK) │
└──────────────────┘     │ direction        │
                          │ status           │
┌──────────────────┐     │ ion_ap_trans_id  │
│  invitations      │     │ document_type    │
│──────────────────│     │ document_id      │
│ email             │     │ sender_id        │
│ role              │     │ receiver_id      │
│ company_ids[]     │     │ xml_content      │
│ is_genesis        │     └──────────────────┘
│ token (unique)    │
│ expires_at (48h)  │     ┌──────────────────┐
│ accepted_at       │     │  audit_logs       │
└──────────────────┘     │  (partitioned)    │
                          │──────────────────│
┌──────────────────┐     │ event_id          │
│ pfs_verifications │     │ event_name        │
│──────────────────│     │ severity          │
│ verification_     │     │ actor_id/email    │
│   token           │     │ company_id/dic   │
│ dic               │     │ source_ip         │
│ legal_name        │     │ details (jsonb)   │
│ company_email     │     │ cef (string)      │
└──────────────────┘     └──────────────────┘
```

## Permission Model

```
Super Admin (global)
├── See everything
├── Create other super admins
├── Activate/deactivate companies on Peppol
├── Reactivate deactivated companies
├── Send onboarding requests
├── Manage all users and invitations
└── View all audit logs

Genesis Company Admin (per company)
├── Invited automatically from PFS webhook
├── Cannot be removed by other company admins
├── Invite other company admins (for own companies)
├── Invite accountants
├── Deactivate non-genesis admins and accountants
├── Create departments
└── Manage department members

Company Admin (per company)
├── Invited by genesis admin or super admin
├── Invite accountants
├── Cannot deactivate other admins
└── View own company data

Accountant (per company)
├── Invited by company admin
├── Cannot invite anyone
├── Read-only access to assigned companies
└── View documents for assigned companies
```

## Flows

### 1. New Customer Onboarding (via PFS Webhook)

```
Customer registers    PFS System              Postar                    Genesis Admin
on PFS portal         ──────────              ──────                    ─────────────
     │                     │                     │                          │
     │ Completes           │                     │                          │
     │ registration        │                     │                          │
     │───────────────────→ │                     │                          │
     │                     │                     │                          │
     │                     │ POST /api/webhooks/ │                          │
     │                     │ pfs                 │                          │
     │                     │ (HMAC-SHA256)       │                          │
     │                     │───────────────────→ │                          │
     │                     │                     │                          │
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ 1. Verify  │                   │
     │                     │               │    HMAC    │                   │
     │                     │               │ 2. Log raw │                   │
     │                     │               │    webhook │                   │
     │                     │               │ 3. Create/ │                   │
     │                     │               │    find    │                   │
     │                     │               │    company │                   │
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
     │                     │                     │                          │
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ 1. Upsert  │                   │
     │                     │               │    profile │                   │
     │                     │               │ 2. Create  │                   │
     │                     │               │    member- │                   │
     │                     │               │    ship    │                   │
     │                     │               │    (genesis│                   │
     │                     │               │     admin) │                   │
     │                     │               │ 3. Create  │                   │
     │                     │               │    session │                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │                          │
     │                     │                     │ Redirect → /dashboard    │
     │                     │                     │ Welcome screen           │
     │                     │                     │────────────────────────→ │
```

### 2. New Customer Onboarding (Manual by Super Admin)

```
Customer calls        Super Admin              Postar                    Customer
──────────────        ───────────              ──────                    ────────
     │                     │                     │                          │
     │ "I want to join"    │                     │                          │
     │───────────────────→ │                     │                          │
     │                     │                     │                          │
     │                     │ Dashboard →         │                          │
     │                     │ "Send Onboarding    │                          │
     │                     │  Request"           │                          │
     │                     │ Enters customer     │                          │
     │                     │ email + company     │                          │
     │                     │ name                │                          │
     │                     │───────────────────→ │                          │
     │                     │                     │                          │
     │                     │                     │ Email (Resend)           │
     │                     │                     │ "Register Your Company"  │
     │                     │                     │ PFS portal link          │
     │                     │                     │────────────────────────→ │
     │                     │                     │                          │
     │                     │                     │        Visits PFS portal │
     │                     │                     │        Registers company │
     │                     │                     │        (triggers webhook)│
     │                     │                     │                          │
     │                     │                     │ ← PFS webhook fires      │
     │                     │                     │ (same as flow #1)        │
```

### 3. User Authentication

```
                    ┌─────────────────────────────────┐
                    │         Sign In Modal            │
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

### 4. Peppol Activation

```
Company Admin         Postar                    ion-AP              Peppol Network
─────────────         ──────                    ──────              ──────────────
     │                   │                        │                       │
     │ Company detail    │                        │                       │
     │ → "Activate on    │                        │                       │
     │    Peppol"        │                        │                       │
     │─────────────────→ │                        │                       │
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
     │             │    receive │                 │                       │
     │             │    trigger │                 │                       │
     │             │    → POST  │                 │                       │
     │             │    to our  │                 │                       │
     │             │    webhook │                 │                       │
     │             └─────┬──────┘                 │                       │
     │                   │                        │                       │
     │                   │ Update company:        │                       │
     │                   │ ion_ap_status=active   │                       │
     │                   │                        │                       │
     │ ← "Active" badge  │                        │                       │
     │◄─────────────────│                        │                       │
```

### 5. Receiving a Peppol Invoice

```
Sender               Sender's AP          ion-AP              Postar              User
──────               ──────────           ──────              ──────              ────
  │                      │                   │                   │                  │
  │ Sends invoice        │                   │                   │                  │
  │────────────────────→ │                   │                   │                  │
  │                      │                   │                   │                  │
  │                      │ AS4 message       │                   │                  │
  │                      │─────────────────→ │                   │                  │
  │                      │                   │                   │                  │
  │                      │                   │ Receive trigger   │                  │
  │                      │                   │ fires:            │                  │
  │                      │                   │ POST /api/webhooks│                  │
  │                      │                   │ /peppol-receive   │                  │
  │                      │                   │─────────────────→ │                  │
  │                      │                   │                   │                  │
  │                      │                   │             ┌─────┴──────┐           │
  │                      │                   │             │ 1. Fetch   │           │
  │                      │                   │             │    trans.  │           │
  │                      │                   │ GET /recv/  │    details │           │
  │                      │                   │ {id}        │            │           │
  │                      │                   │◄────────────│            │           │
  │                      │                   │──────────→  │            │           │
  │                      │                   │             │ 2. Fetch   │           │
  │                      │                   │ GET /recv/  │    XML doc │           │
  │                      │                   │ {id}/doc    │            │           │
  │                      │                   │◄────────────│            │           │
  │                      │                   │──────────→  │            │           │
  │                      │                   │             │ 3. Find    │           │
  │                      │                   │             │    company │           │
  │                      │                   │             │    by DIC  │           │
  │                      │                   │             │ 4. Store   │           │
  │                      │                   │             │    in docs │           │
  │                      │                   │             │    table   │           │
  │                      │                   │             │ 5. Audit   │           │
  │                      │                   │             │    log     │           │
  │                      │                   │             └─────┬──────┘           │
  │                      │                   │                   │                  │
  │                      │                   │                   │ User opens inbox │
  │                      │                   │                   │◄────────────────│
  │                      │                   │                   │                  │
  │                      │                   │                   │ Inbox shows      │
  │                      │                   │                   │ unread document  │
  │                      │                   │                   │────────────────→ │
  │                      │                   │                   │                  │
  │                      │                   │                   │ Clicks document  │
  │                      │                   │                   │◄────────────────│
  │                      │                   │                   │                  │
  │                      │                   │                   │ Auto-mark read   │
  │                      │                   │                   │ Show: metadata,  │
  │                      │                   │                   │ XML, PDF button  │
  │                      │                   │                   │────────────────→ │
```

### 6. Company Deactivation & Reactivation

```
Super Admin           Postar                    ion-AP
───────────           ──────                    ──────

DEACTIVATION:
     │                   │                        │
     │ Company detail    │                        │
     │ → Danger Zone     │                        │
     │ → "Deactivate"    │                        │
     │─────────────────→ │                        │
     │                   │ PATCH /orgs/{id}/      │
     │                   │ {publish_in_smp:false} │
     │                   │──────────────────────→ │
     │                   │                        │
     │                   │ DELETE /orgs/{id}/     │
     │                   │ identifiers/{id}       │
     │                   │──────────────────────→ │
     │                   │                        │
     │             ┌─────┴──────┐                 │
     │             │ 1. Deact.  │                 │
     │             │    all     │                 │
     │             │    members │                 │
     │             │ 2. Archive │                 │
     │             │    all docs│                 │
     │             │ 3. Set     │                 │
     │             │    company │                 │
     │             │    status= │                 │
     │             │    deactiv.│                 │
     │             └─────┬──────┘                 │
     │                   │                        │

REACTIVATION:
     │                   │                        │
     │ Company detail    │                        │
     │ → "Reactivate"    │                        │
     │ Edit: name, email │                        │
     │ genesis admin     │                        │
     │─────────────────→ │                        │
     │                   │                        │
     │                   │ (Same as activation    │
     │                   │  flow #4: create org   │
     │                   │  + identifier +        │
     │                   │  receive trigger)      │
     │                   │──────────────────────→ │
     │                   │                        │
     │             ┌─────┴──────┐                 │
     │             │ 1. Set     │                 │
     │             │    company │                 │
     │             │    active  │                 │
     │             │ 2. Send    │                 │
     │             │    genesis │                 │
     │             │    admin   │                 │
     │             │    invite  │                 │
     │             └─────┬──────┘                 │
     │                   │                        │
```

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/webhooks/pfs` | POST | HMAC-SHA256 | PFS company registration webhook |
| `/api/webhooks/peppol-receive` | POST | None (ion-AP) | Incoming Peppol document webhook |
| `/api/auth/send-code` | POST | None | Send OTP code (email/SMS) |
| `/api/auth/verify-code` | POST | None | Verify OTP + create session |
| `/api/documents/[id]/pdf` | GET | Session | PDF proxy to ion-AP |
| `/api/invitations/accept` | POST | Session | Manual invitation accept |
| `/auth/callback` | GET | OAuth | OAuth callback (Google/Apple) |
| `/invite/[token]/accept` | GET | None | Magic link invitation accept |

## Dashboard Pages

| Route | Roles | Purpose |
|---|---|---|
| `/dashboard` | All | Role-specific dashboard |
| `/dashboard/inbox` | All | Received Peppol documents (Outlook-style) |
| `/dashboard/inbox/[id]` | All | Document detail, XML, PDF |
| `/dashboard/companies` | All | Companies list with Peppol status |
| `/dashboard/companies/[id]` | All | Company detail, members, Peppol activation |
| `/dashboard/users` | SA, Admin | Users & invitations management |
| `/dashboard/webhooks` | SA | Webhooks log (placeholder) |
| `/dashboard/audit` | All | CEF audit log viewer |
| `/dashboard/settings` | All | Profile, PFS activation link (SA) |

## Audit Events (CEF Format)

| Event ID | Severity | Description |
|---|---|---|
| AUTH_SIGN_IN | info | User signed in (google/apple/otp/magic_link) |
| AUTH_SIGN_OUT | info | User signed out |
| AUTH_OTP_SENT | info | OTP code sent (email/sms) |
| AUTH_OTP_VERIFIED | info | OTP code verified |
| INVITE_CREATED | info | Invitation created |
| INVITE_ACCEPTED | info | Invitation accepted |
| MEMBERSHIP_CREATED | info | Company membership created |
| MEMBERSHIP_DEACTIVATED | warning | Company membership deactivated |
| WEBHOOK_RECEIVED | info | PFS webhook received |
| PROFILE_UPDATED | info | Profile updated |
| USER_ONBOARDED | info | User completed onboarding |
| SUPER_ADMIN_GRANTED | warning | Super admin role granted |
| DEPARTMENT_CREATED | info | Department created |
| DEPARTMENT_MEMBER_ADDED | info | User added to department |
| DEPARTMENT_MEMBER_REMOVED | info | User removed from department |
| PEPPOL_COMPANY_ACTIVATED | info | Company activated on Peppol |
| PEPPOL_ACTIVATION_FAILED | error | Peppol activation failed |
| PEPPOL_DOCUMENT_RECEIVED | info | Peppol document received |
| DOCUMENT_READ | info | Document marked as read |
| DOCUMENT_UNREAD | info | Document marked as unread |
| COMPANY_DEACTIVATED | warning | Company deactivated |
| COMPANY_REACTIVATED | info | Company reactivated |
| ONBOARDING_REQUEST_SENT | info | Onboarding request sent to customer |
| REONBOARDING_REQUEST_SENT | info | Re-onboarding request sent |
| PFS_LINK_UPDATED | info | PFS activation link updated |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `PFS_WEBHOOK_SECRET` | Yes | HMAC secret for PFS webhook |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `RESEND_FROM_EMAIL` | Yes | Sender email address |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio phone number |
| `ION_AP_BASE_URL` | Yes | ion-AP API URL (default: test.ion-ap.net) |
| `ION_AP_API_TOKEN` | Yes | ion-AP super admin API token |
| `NEXT_PUBLIC_APP_URL` | No | App URL for webhooks (default: www.peppolbox.sk) |

## Test Coverage (39 tests)

| File | Tests | Coverage |
|---|---|---|
| navigation.test.ts | 3 | Role-based nav items |
| verification.test.ts | 5 | OTP code generation, verify, expiry |
| invitations.test.ts | 4 | Create invite, pre-create user, genesis skip, URL format |
| webhook.test.ts | 6 | Signature validation, payload validation, DIC format |
| permissions.test.ts | 5 | Deactivation permission rules |
| departments.test.ts | 5 | Department CRUD permissions |
| audit.test.ts | 3 | CEF format, severity mapping, fire-and-forget |
| ion-ap.test.ts | 8 | API client, lazy activation, error handling |
