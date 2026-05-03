# postar2 — Architecture & Flow Documentation

A multi-tenant Peppol e-invoice platform: Slovak businesses register via the
PFS verification webhook, get auto-activated on the Peppol network through
ION AP, receive UBL invoices into a per-company inbox, and pay per document
from a prepaid wallet. The web app is the primary surface; a separate
**ePodatelna24** mobile app talks to the same backend over a Bearer-auth
API surface for the read-only inbox + wallet top-up + member management.

## Tech Stack

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| Frontend         | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui v4 (base-ui)   |
| Auth             | Supabase Auth — Google + Apple OAuth, passwordless OTP (email/SMS), magic links |
| Database         | Supabase PostgreSQL with RLS                                                |
| Email            | Resend                                                                      |
| SMS              | Twilio (Slovak +421)                                                        |
| Peppol AP        | ION AP (test: test.ion-ap.net)                                              |
| Payments         | KVERKOM mTLS API + PAY by square QR                                         |
| Blob Storage     | Vercel Blob (XMLs + cached PDFs)                                            |
| PDF Rendering    | Self-hosted **zobrazfakturu** (Bearer API key/secret); ION AP fallback for sent docs |
| Push (mobile)    | APNs HTTP/2 (iOS) + FCM v1 (Android), keyed via `device_tokens` table       |
| JWT signing      | `jose` — ES256 for APNs, RS256 for FCM service-account                      |
| Hosting          | Vercel (Node runtime; cron via `/api/cron/maintenance` every 5 min)         |
| Tests            | Vitest                                                                      |

## Database Schema

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    profiles       │     │    companies      │     │   departments    │
│──────────────────│     │──────────────────│     │──────────────────│
│ id (PK→auth)     │     │ id (PK)          │     │ id (PK)          │
│ full_name         │     │ dic (unique)     │     │ company_id (FK)  │
│ avatar_url        │     │ legal_name       │     │ parent_id (self) │
│ phone             │     │ company_email    │     │ name             │
│ is_super_admin    │     │ status           │     └──────────────────┘
│ onboarded_at      │     │ ion_ap_org_id    │              │
│ pfs_activation_   │     │ ion_ap_status    │     ┌────────┴─────────┐
│   link            │     │ ion_ap_activated │     │ department_      │
└──────────────────┘     │   _at            │     │ memberships      │
         │                │ price_per_doc    │     │──────────────────│
         │                │ deactivated_at   │     │ user_id (FK)     │
┌────────┴─────────┐     └──────────────────┘     │ department_id(FK)│
│ company_          │              │              └──────────────────┘
│ memberships       │              │
│──────────────────│     ┌────────┴─────────┐     ┌──────────────────┐
│ user_id (FK)      │     │   documents      │     │  device_tokens   │
│ company_id (FK)   │     │──────────────────│     │──────────────────│
│ role (enum)       │     │ id (PK)          │     │ user_id (FK→auth)│
│ is_genesis        │     │ company_id (FK)  │     │ expo_token       │
│ status            │     │ department_id(FK)│     │ platform         │
│ invited_by (FK)   │     │ direction        │     │   (ios/android)  │
└──────────────────┘     │ status           │     │ last_seen_at     │
                          │ ion_ap_trans_id  │     └──────────────────┘
┌──────────────────┐     │ document_type    │
│  invitations      │     │ document_id      │     ┌──────────────────┐
│──────────────────│     │ sender_id        │     │  audit_logs      │
│ email             │     │ receiver_id      │     │  (partitioned    │
│ roles[]           │     │ blob_url (XML)   │     │   monthly)       │
│ company_ids[]     │     │ pdf_blob_url     │     │──────────────────│
│ is_genesis        │     │ pdf_validation   │     │ event_id         │
│ token (unique)    │     │ metadata (jsonb) │     │ event_name       │
│ expires_at (48h)  │     │ billed_at        │     │ severity         │
│ accepted_at       │     │ wallet_txn_id(FK)│     │ actor_id/email   │
└──────────────────┘     │ retry_count      │     │ company_id/dic   │
                          │ last_error       │     │ source_ip        │
┌──────────────────┐     │ peppol_created   │     │ user_agent       │
│ pfs_verifications │     └──────────────────┘     │ details (jsonb)  │
│──────────────────│              │                │ cef (string)     │
│ verification_     │     ┌────────┴─────────┐     └──────────────────┘
│   token           │     │ document_notes   │
│ dic               │     │──────────────────│     ┌──────────────────┐
│ legal_name        │     │ document_id (FK) │     │  wallets          │
│ company_email     │     │ user_id (FK)     │     │──────────────────│
└──────────────────┘     │ note             │     │ owner_id (FK,    │
                          │ type             │     │   unique)        │
┌──────────────────┐     └──────────────────┘     │ available_       │
│ payment_links     │                              │   balance        │
│──────────────────│     ┌──────────────────┐     └──────────────────┘
│ wallet_id (FK)   │     │ wallet_          │              │
│ external_txn_id  │     │ transactions     │     ┌────────┴─────────┐
│ amount           │     │──────────────────│     │ wallet linked    │
│ status (enum)    │     │ wallet_id (FK)   │     │ via owner_id     │
│ payme_url        │     │ company_id (FK)  │     └──────────────────┘
│ expires_at (24h) │     │ document_id (FK) │
│ completed_at     │     │ type (enum)      │
└──────────────────┘     │ amount           │     ┌──────────────────┐
                          │ balance_after    │     │ system_settings  │
┌──────────────────┐     │ description      │     │──────────────────│
│ verification_    │     │ metadata (jsonb) │     │ key (PK)         │
│ codes (5min OTP) │     │ created_by (FK)  │     │ value            │
└──────────────────┘     └──────────────────┘     │ description      │
                                                   │ updated_by (FK)  │
┌──────────────────┐     ┌──────────────────┐     └──────────────────┘
│ magic_links      │     │ tos_acceptances  │
│ (7-day, 1-use)   │     │ (legal compliance)│
└──────────────────┘     └──────────────────┘
```

### Enums

- `company_role`: `company_admin` | `operator` | `processor`
- `invitation_role`: `super_admin` | `company_admin` | `operator` | `processor`
- `membership_status`: `active` | `inactive`
- `company_status`: `active` | `deactivated`
- `ion_ap_status`: `pending` | `active` | `error`
- `document_direction`: `received` | `sent`
- `document_status`: `pending` | `processing` | `new` | `read` | `assigned` | `processed` | `failed`
- `wallet_transaction_type`: `charge` | `top_up` | `refund` | `adjustment`
- `payment_link_status`: `pending` | `completed` | `expired`
- `verification_channel`: `email` | `sms`
- `audit_severity`: `info` | `warning` | `error`

### Notable PostgreSQL functions

- `wallet_deduct(wallet_id, amount) RETURNING numeric` — atomic, fails (returns NULL) if balance insufficient
- `wallet_credit(wallet_id, amount) RETURNING numeric` — atomic top-up
- `upsert_profile(user_id, full_name, avatar_url, phone)` — idempotent, called from auth callback (no DB trigger)
- `create_audit_partition(month_str)` — provisions monthly partition for `audit_logs`
- `archive_audit_partition(month_str)` — detaches old partition

### Recent additions

- **`device_tokens`** (May 2026): mobile push token storage; RLS so users only see their own; `expo_token` column name kept for migration history but stores raw native APNs/FCM tokens.
- **`documents.pdf_blob_url`** + **`documents.pdf_validation`** (May 2026): cache-once for self-hosted PDF rendering. `pdf_validation` is the JSON of `{ status, errors, warnings, documentType }` from the renderer's response headers, replayed on cache hits.

## Permission Model

Each user has a **single role per company** (`company_memberships.role`). Roles are hierarchical:
`company_admin > operator > processor`. Super admin is a global flag on the profile.

**Web and mobile now enforce identical matrices** after the May 2026 tightening:

```
Super Admin (global, profiles.is_super_admin)
├── See everything
├── Activate/deactivate companies on Peppol; reactivate
├── Send onboarding requests
├── Manage all users, invitations, wallets
├── Adjust wallet balances; refund
├── Set company pricing
├── View all audit logs
├── ONLY role that can deactivate or change a genesis admin
└── Nav: Dashboard, Inbox, Companies, Users, Webhooks, Operations, Audit, Settings

Genesis Company Admin (per company, is_genesis=true)
├── Created automatically from PFS webhook + first invitation accept
├── Cannot be removed or have role changed (except by super admin)
├── Invite other company admins (only role that can promote to admin)
├── Invite operators and processors
├── Deactivate non-genesis admins, operators, processors
├── Directly assign existing users to own companies
├── Create and manage departments
├── Manage department members
├── Triage documents (assign to departments)
├── Owns the wallet (one per genesis admin, shared across their companies)
└── Nav: Dashboard, Inbox, Companies, Users, Wallet, Operations

Company Admin (per company, non-genesis)
├── Invited by genesis admin or super admin
├── Invite operators and processors
├── Cannot promote to company_admin (genesis-only)
├── Cannot change another admin's role or deactivate another admin
├── Triage documents (assign to departments)
└── Nav: Dashboard, Inbox, Companies, Users, Wallet, Operations

Operator (per company)
├── Invited by company admin
├── Triage documents (assign to departments)
├── Manage department members
├── Can change roles BUT only between operator ↔ processor
└── Nav: Dashboard, Inbox, Companies, Users, Wallet

Processor (per company)
├── Invited by company admin
├── Sees only documents assigned to their department(s)
├── Read-only document access
├── Cannot change any roles
└── Nav: Inbox, Companies (redirected to /inbox from /dashboard)
```

**Universal guards** (enforced on every membership/role action):
- Never act on yourself.
- `is_genesis = true` is immutable except by super admin (support-case lever).

## Flows

### 1. New customer onboarding (PFS webhook)

```
Customer registers    PFS System              postar2                   Genesis Admin
on PFS portal         ──────────              ──────────                ─────────────
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
     │                     │               │    (rota-  │                   │
     │                     │               │    table)  │                   │
     │                     │               │ 2. Log raw │                   │
     │                     │               │    payload │                   │
     │                     │               │ 3. Upsert  │                   │
     │                     │               │    company │                   │
     │                     │               │    by dic  │                   │
     │                     │               │ 4. Pre-    │                   │
     │                     │               │    create  │                   │
     │                     │               │    auth    │                   │
     │                     │               │    user    │                   │
     │                     │               │ 5. Create  │                   │
     │                     │               │    invite  │                   │
     │                     │               │    is_     │                   │
     │                     │               │    genesis │                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │ Resend email             │
     │                     │                     │ with magic link          │
     │                     │                     │────────────────────────→ │
     │                     │                     │                          │
     │                     │                     │           Clicks link    │
     │                     │                     │ GET /invite/[token]/     │
     │                     │                     │ accept                   │
     │                     │                     │◄────────────────────────│
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ Session +  │                   │
     │                     │               │ profile +  │                   │
     │                     │               │ membership │                   │
     │                     │               │ → /activate│                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │                          │
     │                     │               ┌─────┴──────┐                   │
     │                     │               │ Auto-      │                   │
     │                     │               │ activate   │                   │
     │                     │               │ on ION AP  │                   │
     │                     │               │ Wallet +   │                   │
     │                     │               │ welcome    │                   │
     │                     │               │ credit     │                   │
     │                     │               │ Set        │                   │
     │                     │               │ onboarded  │                   │
     │                     │               └─────┬──────┘                   │
     │                     │                     │ "Active on Peppol!"      │
     │                     │                     │────────────────────────→ │
```

### 2. Authentication

Three paths converge into a Supabase session:

- **Email/SMS OTP** — `POST /api/auth/send-code` → 6-digit code stored in `verification_codes` (5 min) → user types → auto-submit on 6th digit → `POST /api/auth/verify-code` → session.
- **Magic link** — generated for invitations and the "email me a sign-in link" flow → 7-day single-use token in `magic_links` → `GET /api/auth/magic?token=…` → idempotent re-use, preserves `next=` param for deep linking.
- **Google / Apple OAuth** — Supabase OAuth → `/auth/callback` → `upsert_profile` RPC → session.

### 3. Peppol activation (automatic on genesis accept)

```
Genesis Admin   postar2                ION AP                 Peppol Network
─────────────   ───────                 ──────                 ──────────────
     │ Magic        │                       │                       │
     │ link click   │                       │                       │
     │────────────→ │                       │                       │
     │        ┌─────┴──────┐                │                       │
     │        │ Session,   │                │                       │
     │        │ membership,│                │                       │
     │        │ /activate  │                │                       │
     │        └─────┬──────┘                │                       │
     │              │ POST /organizations/  │                       │
     │              │─────────────────────→ │                       │
     │              │ ← org {id}            │                       │
     │              │ POST /orgs/{id}/ids/  │                       │
     │              │   0245:dic            │                       │
     │              │─────────────────────→ │                       │
     │              │                       │ Publish to SMP        │
     │              │                       │─────────────────────→ │
     │              │ POST /orgs/{id}/      │                       │
     │              │   webhook-triggers/   │                       │
     │              │   (peppol-receive)    │                       │
     │              │─────────────────────→ │                       │
     │        ┌─────┴──────┐                │                       │
     │        │ Wallet +   │                │                       │
     │        │ welcome    │                │                       │
     │        │ credit;    │                │                       │
     │        │ ion_ap_    │                │                       │
     │        │ status =   │                │                       │
     │        │ active     │                │                       │
     │        └─────┬──────┘                │                       │
     │ "Active!"    │                       │                       │
     │◄────────────│                       │                       │
```

### 4. Receiving a Peppol document (ingestion + push)

```
Sender's AP        ION AP             postar2                       Active admins
──────────         ──────              ───────                       ─────────────
   │ AS4 message      │                    │                              │
   │────────────────→ │                    │                              │
   │                  │ POST /api/         │                              │
   │                  │ webhooks/peppol-   │                              │
   │                  │ receive            │                              │
   │                  │──────────────────→ │                              │
   │                  │              ┌─────┴──────┐                       │
   │                  │              │ Insert doc │                       │
   │                  │              │ row, queue │                       │
   │                  │              │ processing │                       │
   │                  │              └─────┬──────┘                       │
   │                  │              ┌─────┴──────┐                       │
   │                  │              │ Fetch XML  │                       │
   │                  │              │ → Vercel   │                       │
   │                  │              │ Blob       │                       │
   │                  │              │ Parse UBL  │                       │
   │                  │              │ (IBAN +    │                       │
   │                  │              │ payment    │                       │
   │                  │              │ symbols)   │                       │
   │                  │              │ Charge     │                       │
   │                  │              │ wallet     │                       │
   │                  │              │ (or mark   │                       │
   │                  │              │ unbilled)  │                       │
   │                  │              │ Resend     │                       │
   │                  │              │ email      │                       │
   │                  │              │ Push fan-  │                       │
   │                  │              │ out (APNs/ │                       │
   │                  │              │ FCM)       │                       │
   │                  │              │ Audit      │                       │
   │                  │              └─────┬──────┘                       │
   │                  │                    │ Push: "Nová faktúra"         │
   │                  │                    │ Od {supplier} — {amount}     │
   │                  │                    │ data.docId for deep-link     │
   │                  │                    │────────────────────────────→ │
```

### 5. Prepaid billing & QR top-up

```
User                postar2                KVERKOM                Bank app
────                ───────                ───────                ────────
 │ Open locked doc     │                      │                      │
 │───────────────────→ │                      │                      │
 │ ← QR + amount       │                      │                      │
 │  picker             │                      │                      │
 │◄──────────────────│                      │                      │
 │ POST /api/wallet/   │                      │                      │
 │ create-payment-link │                      │                      │
 │───────────────────→ │                      │                      │
 │                ┌────┴──────┐               │                      │
 │                │ KVERKOM   │ mTLS POST     │                      │
 │                │ creates   │──────────────→│                      │
 │                │ txn ID    │               │                      │
 │                │ Build     │               │                      │
 │                │ PayMe URL │               │                      │
 │                └────┬──────┘               │                      │
 │ ← paymeUrl + linkId │                      │                      │
 │◄──────────────────│                      │                      │
 │ Open PayMe URL ─────────────────────────────────────────────────→ │
 │                     │                      │                      │
 │ (poll /api/wallet/  │                      │                      │
 │  check-payment      │                      │                      │
 │  every 4 s)         │ GET status           │                      │
 │───────────────────→ │─────────────────────→│                      │
 │                     │ ← ACCC               │                      │
 │                ┌────┴──────┐               │                      │
 │                │ wallet_   │               │                      │
 │                │ credit;   │               │                      │
 │                │ auto-bill │               │                      │
 │                │ unbilled  │               │                      │
 │                │ docs;     │               │                      │
 │                │ send      │               │                      │
 │                │ billing   │               │                      │
 │                │ invoice   │               │                      │
 │                │ via Peppol│               │                      │
 │                └────┬──────┘               │                      │
 │ "Payment received!" │                      │                      │
 │◄──────────────────│                      │                      │
```

### 6. PDF rendering pipeline (received docs)

```
Caller (web/mobile)        postar2 PDF route          Vercel Blob          zobrazfakturu
──────────────────         ─────────────────          ────────────          ─────────────
GET /api/documents/             │                          │                     │
  [id]/pdf                      │                          │                     │
  Bearer or cookie              │                          │                     │
─────────────────────────────→  │                          │                     │
                          ┌─────┴──────┐                   │                     │
                          │ Auth +     │                   │                     │
                          │ access +   │                   │                     │
                          │ billed_at  │                   │                     │
                          │ check      │                   │                     │
                          └─────┬──────┘                   │                     │
                          ┌─────┴──────┐                   │                     │
                          │ pdf_blob_  │                   │                     │
                          │ url set?   │                   │                     │
                          └──┬──────┬──┘                   │                     │
                          yes│      │ no                    │                     │
                             │      │                       │                     │
                             │      │ Fetch XML (self-      │                     │
                             │      │  heal blob_url       │                     │
                             │      │  from ION AP if       │                     │
                             │      │  missing)            │                     │
                             │      │─────────────────────→ │                     │
                             │      │ ← XML bytes          │                     │
                             │      │                       │                     │
                             │      │ POST /api/v1/render  │                     │
                             │      │ X-API-Key/Secret     │                     │
                             │      │ X-Language: sk       │                     │
                             │      │ body: XML           │                     │
                             │      │──────────────────────────────────────────→ │
                             │      │ ← PDF bytes +       │                     │
                             │      │   X-Peppol-*        │                     │
                             │      │   headers           │                     │
                             │      │                       │                     │
                             │      │ Cache PDF + JSON    │                     │
                             │      │ to Blob, save       │                     │
                             │      │ pdf_blob_url +     │                     │
                             │      │ pdf_validation     │                     │
                             │      │─────────────────────→│                     │
                             │      │                       │                     │
                          ┌──┴──────┴──┐                   │                     │
                          │ Stream PDF │                   │                     │
                          │ + replay   │                   │                     │
                          │ X-Peppol-* │                   │                     │
                          │ headers    │                   │                     │
                          └─────┬──────┘                   │                     │
   PDF bytes                    │                          │                     │
←──────────────────────────────│                          │                     │
```

Sent documents still go via ION AP's PDF endpoint
(`getSendTransactionPdf`) until outbound XMLs are also mirrored to Blob.

### 7. Push notifications (mobile fan-out)

```
Mobile sign-in     device_tokens         postar2 receive        APNs/FCM        Active admins
──────────────     ──────────────         ───────────────        ────────         ──────────────
  Cold start              │                      │                  │                  │
  Notifications.          │                      │                  │                  │
  getDevicePush           │                      │                  │                  │
  TokenAsync              │                      │                  │                  │
  Upsert (user, token)    │                      │                  │                  │
  ──────────────────────→│                      │                  │                  │
                                                                                         
  ────── (later, Peppol webhook fires) ──────                                            
                                                                                         
                          │ Query active         │                  │                  │
                          │ company_admin        │                  │                  │
                          │ members of           │                  │                  │
                          │ receiving company    │                  │                  │
                          │ → device_tokens      │                  │                  │
                          │◄────────────────────│                  │                  │
                                                                                         
                                                 │ Sign ES256 JWT  │                  │
                                                 │ (cached 55min). │                  │
                                                 │ HTTP/2 POST     │                  │
                                                 │ to api.push.    │                  │
                                                 │ apple.com per   │                  │
                                                 │ token in        │                  │
                                                 │ parallel.       │                  │
                                                 │ FCM v1 OAuth    │                  │
                                                 │ JWT for         │                  │
                                                 │ Android.        │                  │
                                                 │────────────────→│                  │
                                                 │ ← 200 / 410 /   │                  │
                                                 │   400/404       │                  │
                                                 │                 │                  │
                                                 │ Prune dead      │                  │
                                                 │ tokens (410     │                  │
                                                 │ Unregistered,   │                  │
                                                 │ 400 BadDevice,  │                  │
                                                 │ FCM 404/UNREG)  │                  │
                                                 │                 │ Notification     │
                                                 │                 │ delivered        │
                                                 │                 │────────────────→│
                                                 │                                    │ Tap → deep link
                                                 │                                    │ /document/{docId}
```

## API Routes

### Web + mobile (Bearer or cookie)

| Route                                 | Method | Auth                | Purpose                                                                |
| ------------------------------------- | ------ | ------------------- | ---------------------------------------------------------------------- |
| `/api/documents/[id]/pdf`             | GET    | Bearer or cookie    | Render received doc via zobraz + cache; sent docs via ION AP fallback  |
| `/api/documents/[id]/xml`             | GET    | Bearer or cookie    | Stream raw XML from Blob; locked if `!billed_at`                       |
| `/api/wallet/create-payment-link`     | POST   | Bearer or cookie    | Generate KVERKOM/PayMe QR link                                         |
| `/api/wallet/statement`               | GET    | Cookie (web)        | CSV transaction export                                                 |

### Mobile-only (Bearer)

| Route                                 | Method | Auth   | Purpose                                                                |
| ------------------------------------- | ------ | ------ | ---------------------------------------------------------------------- |
| `/api/wallet`                         | GET    | Bearer | Wallet summary: balance, owner display, `pricePerDocument`             |
| `/api/invitations`                    | POST   | Bearer | Mobile invite flow with machine-readable error codes                   |
| `/api/companies/[id]/members`         | GET    | Bearer | Active members of a company, with email pulled from `auth.users`       |
| `/api/memberships/[id]/role`          | POST   | Bearer | Change role per the tightened mobile matrix                            |
| `/api/memberships/[id]/deactivate`    | POST   | Bearer | Deactivate membership (genesis-protected except super_admin)           |
| `/api/account/delete`                 | POST   | Bearer | App Store/Play Store account deletion; refuses on positive wallet balance or genesis |

### Web-only (cookie session)

| Route                                 | Method | Auth     | Purpose                                                  |
| ------------------------------------- | ------ | -------- | -------------------------------------------------------- |
| `/api/invitations/accept`             | POST   | Cookie   | Server-action style accept (web fallback)                |
| `/api/documents/list`                 | GET    | Cookie   | Inbox listing with filtering + pagination                |
| `/api/departments/by-company`         | GET    | Cookie   | List departments under a company                         |
| `/api/departments/remove-member`      | POST   | Cookie   | Remove user from department                              |

### Auth (public)

| Route                                 | Method | Auth   | Purpose                                                  |
| ------------------------------------- | ------ | ------ | -------------------------------------------------------- |
| `/api/auth/send-code`                 | POST   | Public | Send 6-digit OTP via email or SMS                        |
| `/api/auth/verify-code`               | POST   | Public | Verify OTP and create session                            |
| `/api/auth/magic`                     | GET    | Public | Single-use magic-link sign-in with `next=` deep linking  |
| `/auth/callback`                      | GET    | OAuth  | Google/Apple OAuth callback; runs `upsert_profile` RPC   |
| `/invite/[token]/accept`              | GET    | Public | Magic-link invitation acceptance                         |

### Webhooks

| Route                                 | Method | Auth                  | Purpose                                              |
| ------------------------------------- | ------ | --------------------- | ---------------------------------------------------- |
| `/api/webhooks/pfs`                   | POST   | HMAC-SHA256 (rotatable) | PFS company registration                          |
| `/api/webhooks/peppol-receive`        | POST   | None (ION AP only)    | Inbound Peppol document delivery                     |
| `/api/webhooks/payment-received`      | POST   | Bearer secret         | Optional MQTT/payment callback (fallback path)       |

### Cron

| Route                                 | Method | Auth         | Purpose                                                                   |
| ------------------------------------- | ------ | ------------ | ------------------------------------------------------------------------- |
| `/api/cron/maintenance`               | GET    | CRON_SECRET  | 5-min loop: retry pending docs, partition audit, poll payments, heal Peppol activations, auto-bill positive wallets |

### Misc

| Route                                 | Method | Auth                       | Purpose                                          |
| ------------------------------------- | ------ | -------------------------- | ------------------------------------------------ |
| `/api/wallet/check-payment`           | GET    | None (paymentLinkId is UUID) | Mobile/web client polling for payment status   |
| `/api/auction/update-bid`             | POST   | AUCTION_ADMIN_PASSWORD     | Charity-auction admin bid update                 |

## Pages

### Dashboard

| Route                            | Roles            | Purpose                                                                              |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `/dashboard`                     | All              | Role-specific home; processors auto-redirect to `/dashboard/inbox`                   |
| `/dashboard/inbox`               | All              | Received-document inbox with filters, sort, mass actions, optimistic assign          |
| `/dashboard/inbox/[id]`          | All with access  | Detail: inline PDF, XML download, notes, retry, status changes                       |
| `/dashboard/companies`           | SA, CA           | Company list with Peppol status                                                      |
| `/dashboard/companies/[id]`      | SA, CA           | Members, departments, Peppol activation, pricing, deactivation                       |
| `/dashboard/users`               | SA, CA           | User + invitation management; user detail drawer with direct assignment              |
| `/dashboard/webhooks`            | SA               | PFS webhook log                                                                      |
| `/dashboard/audit`               | All              | CEF audit log viewer (RLS-scoped per role)                                           |
| `/dashboard/settings`            | All              | Profile + system settings (SA-only)                                                  |
| `/dashboard/wallet`              | CA, Op           | Wallet balance, top-up, transactions, statement export                               |
| `/dashboard/wallet/[walletId]`   | SA, owner        | Per-wallet detail; manual adjust by SA                                               |
| `/dashboard/operations`          | SA, CA           | Operations Center: retry failed docs/activations/billing/payments; force overrides   |
| `/dashboard/test-tracker`        | SA               | Manual test progress tracker; trigger ION AP test invoices                           |

### Public

| Route                            | Purpose                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| `/`                              | Landing page; signed-in users redirect to `/dashboard`                   |
| `/activate`                      | Genesis-admin Peppol-activation landing                                  |
| `/pay/[token]`                   | Public payment page (QR, no login)                                       |
| `/auction`                       | Charity auction display (Plamienok)                                      |
| `/auction/admin`                 | Admin bid update (password)                                              |
| `/legal/vop`                     | Slovak Terms of Service                                                  |
| `/legal/ochrana-udajov`          | Slovak Privacy Policy                                                    |
| `/legal/dpa`                     | Data Processing Agreement                                                |

## Mobile API surface

The ePodatelna24 mobile app uses Supabase Auth client-side and stores
session tokens in iOS Keychain / Android Keystore. All postar2 calls
include `Authorization: Bearer <supabase-access-token>`. Mobile reads
most data directly via Supabase JS (RLS-gated); only mutations or
multi-step workflows go through postar2 routes.

**Bearer-auth routes** (see API table for the complete list):
- `GET /api/wallet`
- `POST /api/wallet/create-payment-link`
- `POST /api/invitations`
- `GET /api/companies/[id]/members`
- `POST /api/memberships/[id]/role`
- `POST /api/memberships/[id]/deactivate`
- `POST /api/account/delete`
- `GET /api/documents/[id]/pdf` (also accepts cookies)
- `GET /api/documents/[id]/xml` (also accepts cookies)

**Error code convention**: machine-readable strings (`unauthorized`, `forbidden`, `not_found`, `cannot_change_own_role`, `cannot_deactivate_genesis`, `wallet_not_empty`, `genesis_admin`, `already_member`, `invalid_role`, `no_change`, `internal`). Mobile maps each to a localized alert.

**Push tokens** are kept in `device_tokens.expo_token` (column name historic; holds raw native APNs hex / FCM token strings). Mobile upserts on every cold start; signs out delete the row.

## PDF rendering

- **Service**: self-hosted [zobrazfakturu](https://github.com/spavlovic77/zobrazfakturu) (separate Vercel project, `@react-pdf/renderer` server-side).
- **Auth**: API key + secret (`ZOBRAZ_API_KEY`, `ZOBRAZ_API_SECRET`) minted in zobraz UI.
- **Caps** (configurable on zobraz side): 10 MB body, 5000 lines, 10K chars per text field.
- **Validation**: zobraz calls a Peppol validator and surfaces results via `X-Peppol-Validator-Status`, `X-Peppol-Errors`, `X-Peppol-Warnings`, `X-Peppol-Document-Type` response headers (and the full result base64-encoded in `X-Peppol-Validation`).
- **Caching**: postar2 uploads the rendered PDF to Vercel Blob at `peppol/rendered/{documentId}.pdf` and saves the URL on `documents.pdf_blob_url` plus the validation JSON on `documents.pdf_validation`. Subsequent reads stream from Blob and replay validation headers — zero zobraz hits.
- **Self-heal**: legacy rows missing `blob_url` lazy-fetch from ION AP via `getReceiveTransactionDocument`, upload to Blob, then continue rendering.
- **Locked docs**: PDF endpoint refuses non-super-admin reads when `billed_at IS NULL` and status ∈ {new, read, assigned, processed}.

## Push notifications

- **Library**: native APNs HTTP/2 (Node `node:http2`) and FCM v1 REST. No Expo Push Service involved.
- **JWT signing**: `jose` — APNs `ES256` (key ID + team ID; cached 55 min, APNs caps lifetime at 1 h); FCM `RS256` service-account assertion exchanged for an OAuth access token (cached until expiry).
- **Fan-out**: on Peppol document receive, query active `company_admin` members of the receiving company → join `device_tokens` → send one push per token in parallel. Failures are caught and logged — they never abort the receive transaction.
- **Payload**: title `"Nová faktúra"`, body `"Od {supplier} — {amount} €"`, `data.docId` for deep-linking.
- **Dead-token cleanup**: APNs 410 Unregistered or 400 BadDeviceToken → delete row; FCM 404 / UNREGISTERED / INVALID_ARGUMENT → delete row.
- **Sandbox vs prod APNs**: configurable via `APNS_HOST` (default `api.push.apple.com`).

## Audit events

Logged to the partitioned `audit_logs` table in CEF format:
`CEF:0|Postar|Postar|1.0|{eventId}|{eventName}|{severity}|{extensions}`.

### Auth & onboarding

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `AUTH_SIGN_IN`                 | info     | User signed in (google / apple / otp / magic_link) |
| `AUTH_SIGN_OUT`                | info     | User signed out                                  |
| `AUTH_OTP_SENT`                | info     | OTP code sent (email / sms)                      |
| `AUTH_OTP_VERIFIED`            | info     | OTP code verified                                |
| `AUTH_ACCOUNT_DELETED`         | warning  | User account deleted (App Store / Play Store)    |
| `USER_ONBOARDED`               | info     | User completed onboarding                        |
| `TOS_ACCEPTED`                 | info     | Terms + privacy accepted                         |
| `PROFILE_UPDATED`              | info     | Profile updated                                  |

### Invitations & memberships

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `INVITE_CREATED`               | info     | Invitation created                               |
| `INVITE_ACCEPTED`              | info     | Invitation accepted                              |
| `INVITATION_RESENT`            | info     | Invitation resent                                |
| `INVITATION_REVOKED`           | warning  | Invitation revoked                               |
| `MEMBERSHIP_CREATED`           | info     | Company membership created                       |
| `MEMBERSHIP_DEACTIVATED`       | warning  | Company membership deactivated                   |
| `MEMBERSHIP_REACTIVATED`       | info     | Company membership reactivated                   |
| `MEMBER_ROLE_UPDATED`          | info     | Member role changed                              |
| `MEMBER_ASSIGNED`              | info     | User directly assigned to company (no invite)    |
| `SUPER_ADMIN_GRANTED`          | warning  | Super admin role granted                         |

### Departments

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `DEPARTMENT_CREATED`           | info     | Department created                               |
| `DEPARTMENT_RENAMED`           | info     | Department renamed                               |
| `DEPARTMENT_DELETED`           | warning  | Department deleted                               |
| `DEPARTMENT_MEMBER_ADDED`      | info     | User added to department                         |
| `DEPARTMENT_MEMBER_REMOVED`    | info     | User removed from department                     |

### Documents

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `WEBHOOK_RECEIVED`             | info     | PFS webhook received                             |
| `PEPPOL_DOCUMENT_RECEIVED`     | info     | Peppol document received and processed           |
| `DOCUMENT_PROCESSED`           | info     | Document marked as processed (with note)         |
| `DOCUMENTS_BULK_PROCESSED`     | info     | Bulk export + processed                          |
| `DOCUMENT_STATUS_UPDATED`      | info     | Status changed (read / assigned / processed)     |
| `DOCUMENT_NOTE_ADDED`          | info     | Note added to document                           |
| `DOCUMENT_ASSIGNED`            | info     | Document assigned to department                  |
| `DOCUMENTS_BULK_ASSIGNED`      | info     | Documents bulk assigned                          |
| `DOCUMENT_RETURNED_TO_TRIAGE`  | info     | Document unassigned back to triage               |
| `DOCUMENT_MANUAL_RETRY`        | info     | Document processing manually retried             |
| `DOCUMENT_PROCESSING_FAILED`   | error    | Document processing failed (max retries)         |
| `DOCUMENT_PROCESSING_RETRY`    | warning  | Document processing failed, will retry           |

### Companies & Peppol

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `COMPANY_DEACTIVATED`          | warning  | Company deactivated                              |
| `COMPANY_REACTIVATED`          | info     | Company reactivated                              |
| `COMPANY_UPDATED`              | info     | Company details updated                          |
| `COMPANY_PRICING_UPDATED`      | info     | Company pricing changed                          |
| `PEPPOL_COMPANY_ACTIVATED`     | info     | Company activated on Peppol                      |
| `PEPPOL_ACTIVATION_FAILED`     | error    | Peppol activation failed                         |
| `ONBOARDING_REQUEST_SENT`      | info     | Onboarding request sent to customer              |
| `TEST_INVOICES_SENT`           | info     | Test invoices sent to company                    |

### Wallet & billing

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `DOCUMENT_CHARGED`             | info     | Document charged to wallet                       |
| `DOCUMENT_UNBILLED`            | warning  | Document arrived but wallet insufficient         |
| `WALLET_TOPPED_UP`             | info     | Wallet received funds                            |
| `WALLET_ADJUSTED`              | info     | Manual balance adjustment by super admin         |
| `WALLET_REFUNDED`              | info     | Refund recorded against wallet                   |
| `AUTO_BILL_COMPLETED`          | info     | Auto-billing round completed                     |
| `PAYMENT_LINK_CREATED`         | info     | Payment link generated                           |
| `PAYMENT_RECEIVED`             | info     | QR payment confirmed and processed               |
| `BILLING_INVOICE_SENT`         | info     | Billing invoice sent via Peppol after payment    |

### System & operations

| Event ID                          | Severity | Description                                         |
| --------------------------------- | -------- | --------------------------------------------------- |
| `SYSTEM_SETTINGS_UPDATED`         | info     | System settings changed                             |
| `OPS_ACTIVATION_RETRIED`          | warning  | Operator retried Peppol activation                  |
| `OPS_DOCUMENT_RETRIED`            | warning  | Operator retried document processing                |
| `OPS_DOCUMENTS_BULK_RETRIED`      | warning  | Operator bulk retried failed documents              |
| `OPS_DOCUMENT_STATUS_FORCED`      | warning  | Super admin forced document status                  |
| `OPS_PAYMENT_FORCE_CHECKED`       | warning  | Operator force-checked payment status               |
| `OPS_PAYMENT_MANUALLY_COMPLETED`  | warning  | Super admin manually completed payment              |
| `OPS_AUTOBILL_RETRIED`            | warning  | Operator retried auto-billing                       |
| `OPS_DOCUMENT_FORCE_BILLED`       | warning  | Super admin force-billed document                   |
| `OPS_INVITATION_EXTENDED`         | info     | Operator extended invitation expiry                 |

### Cron

| Event ID                       | Severity | Description                                      |
| ------------------------------ | -------- | ------------------------------------------------ |
| `CRON_DOCUMENTS_RETRIED`       | info     | Cron retried pending documents                   |
| `CRON_AUDIT_ARCHIVED`          | info     | Cron archived audit partitions                   |
| `CRON_PAYMENTS_CONFIRMED`      | info     | Cron confirmed pending payments                  |
| `CRON_ACTIVATIONS_HEALED`      | info     | Cron auto-healed failed Peppol activations       |
| `CRON_BILLING_HEALED`          | info     | Cron auto-billed documents with positive balance |

## Lib modules

Path: `src/lib/`.

| File                       | Purpose                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `actions.ts`               | Web server actions: onboarding, invitations, TOS, departments, company updates, refund               |
| `audit.ts`                 | CEF audit logging — `audit()` + domain-specific helpers (`auditSignIn`, `auditMembershipDeactivated`, …) |
| `billing.ts`               | Wallet lifecycle: get/create wallet, top-up, charge, auto-billing, transaction history               |
| `billing-invoice.ts`       | Generate billing invoices via ION AP (sent direction)                                                |
| `dal.ts`                   | Data access for dashboards: stats, company data, role resolution, wallet lookup                      |
| `document-processor.ts`    | Peppol receive: fetch XML, upload to Blob, parse UBL, charge wallet, push fan-out, retries           |
| `email.ts`                 | Resend transactional templates: OTP, invitation, document received, billing invoice                  |
| `invitations.ts`           | `createInvitation` (pre-creates auth user if missing), `getInviteUrl`                                |
| `magic-link.ts`            | Generate + verify single-use magic-link tokens                                                       |
| `navigation.ts`            | Role-based nav config                                                                                |
| `payment.ts`               | KVERKOM mTLS client + PayMe URL builder + payment-link polling                                       |
| `push.ts`                  | APNs HTTP/2 + FCM v1 client, dead-token cleanup, fan-out                                             |
| `rate-limit.ts`            | OTP send/verify rate limiting                                                                        |
| `settings.ts`              | `system_settings` KV store with 60 s in-memory cache                                                 |
| `sms.ts`                   | Twilio SMS for OTP                                                                                    |
| `test-invoices.ts`         | ION AP test document factory                                                                          |
| `test-invoices-action.ts`  | Server action wrapping test invoice injection                                                         |
| `types.ts`                 | Shared TS interfaces                                                                                  |
| `ubl-parser.ts`            | Extract supplier, amount, line items, **IBAN, payment symbols** from UBL XML                         |
| `utils.ts`                 | `cn()` Tailwind merge                                                                                 |
| `verification.ts`          | 6-digit OTP generate, store, verify                                                                  |
| `zobraz.ts`                | Self-hosted PDF render client (POST `/api/v1/render`)                                                |
| `ion-ap/`                  | ION AP REST client + Peppol activation flow + types                                                  |
| `supabase/`                | `client.ts` (browser), `server.ts` (cookie session), `admin.ts` (service-role)                       |

## Environment variables

| Variable                          | Required | Description                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes      | Supabase project URL                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | yes      | Supabase anon key                                            |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes      | Service-role key (server-only)                               |
| `RESEND_API_KEY`                  | yes      | Resend transactional email                                   |
| `TWILIO_ACCOUNT_SID`              | yes      | Twilio account                                               |
| `TWILIO_AUTH_TOKEN`               | yes      | Twilio auth                                                  |
| `BLOB_READ_WRITE_TOKEN`           | yes      | Vercel Blob R/W                                              |
| `CRON_SECRET`                     | yes      | Bearer for `/api/cron/maintenance`                           |
| `PAYME_IBAN`                      | yes      | IBAN used in PayMe URLs                                      |
| `PAYMENT_WEBHOOK_SECRET`          | yes      | HMAC for the payment webhook                                 |
| `KV_API_URL`                      | yes      | KVERKOM REST endpoint                                        |
| `KV_CERT` / `KV_KEY` / `KV_CA_BUNDLE` | yes  | mTLS material for KVERKOM                                    |
| `ZOBRAZ_BASE_URL`                 | yes      | zobrazfakturu deployment URL                                 |
| `ZOBRAZ_API_KEY` / `ZOBRAZ_API_SECRET` | yes | zobrazfakturu API credentials                                |
| `APNS_AUTH_KEY`                   | iOS push | Contents of the `.p8` key (`\n` literals OK)                 |
| `APNS_KEY_ID`                     | iOS push | 10-char Apple key ID                                         |
| `APNS_TEAM_ID`                    | iOS push | Apple developer team ID                                      |
| `APNS_BUNDLE_ID`                  | iOS push | Bundle ID, e.g. `sk.epodatelna24.mobile`                     |
| `APNS_HOST`                       | optional | Default `api.push.apple.com`; switch to sandbox for dev      |
| `FCM_SERVICE_ACCOUNT_JSON`        | Android push | Raw JSON or base64-wrapped service-account                |
| `ION_AP_TEST_SENDER_TOKEN`        | optional | Token for test invoice + billing invoice sender              |
| `NEXT_PUBLIC_APP_URL`             | optional | App URL (default `https://www.v0-postar2.vercel.app`)        |
| `PAYME_CREDITOR_NAME`             | optional | Creditor name for QR (default `peppolbox.sk`)                |
| `AUCTION_ADMIN_PASSWORD`          | optional | Charity-auction admin gate                                   |

System settings (DB, editable in dashboard, override env vars):
`resend_from_email`, `pfs_webhook_secret`, `pfs_activation_link`,
`ion_ap_base_url`, `ion_ap_api_token`, `twilio_phone_number`,
`welcome_credit_amount`, `auction_current_bid`.

## Cron healing (`/api/cron/maintenance`, every 5 min)

Best-effort, idempotent, non-fatal — every leg catches and logs:

1. **Documents retry** (≤ 20): pending/processing rows → re-fetch XML, parse, charge.
2. **Audit partitioning**: ensure current + next 2 months exist; archive partitions older than 6 months.
3. **Payment polling** (≤ 10): pending `payment_links` → KVERKOM status check → top-up wallet on `ACCC`, expire after 24 h.
4. **Peppol activation healing** (≤ 5): companies with `ion_ap_status='error'` → retry org/identifier/trigger creation.
5. **Auto-bill** (≤ 10 wallets): wallets with `available_balance > 0` and unbilled docs → atomic deduct, send billing invoice via Peppol.

## Tests

Vitest under `tests/`. Mock Supabase client at `tests/mocks/supabase.ts`.

| File                  | Scope                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `audit.test.ts`       | CEF format, severity mapping, fire-and-forget                        |
| `billing.test.ts`     | Wallet ops, charging, auto-billing, all-or-nothing, edge cases       |
| `departments.test.ts` | Department CRUD permissions                                          |
| `invitations.test.ts` | Create invite, pre-create user, genesis skip, URL format             |
| `ion-ap.test.ts`      | API client, lazy activation, error handling                          |
| `navigation.test.ts`  | Role-based nav items                                                 |
| `permissions.test.ts` | Deactivation permission rules                                        |
| `verification.test.ts`| OTP code generation, verify, expiry                                  |
| `webhook.test.ts`     | Signature validation, payload validation, DIC format                 |
