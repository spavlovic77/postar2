# peppolbox.sk — Manual Test Cases

## Test Environment

| Role                    | Email                                 |
| ----------------------- | ------------------------------------- |
| Super Admin             | stanislav.pavlovic@fiinancnasprava.sk |
| Company Admin (Genesis) | peppolbox.sk@gmail.com                   |
| Operator                | operator@test.com                     |
| Processor               | jankouctovaník@gmail.com               |

**Prerequisites:**
- Fresh schema.sql executed in Supabase SQL Editor
- All env vars set in Vercel (Supabase, Resend, Twilio, ion-AP, ION_AP_TEST_SENDER_TOKEN)
- ion-AP test environment token configured
- PFS activation link set in System Settings

---

## Group 1: Landing Page & Initial Setup

### TC-1.1: Landing Page

| Step | Action                                            | Expected                                                                                             |
| ---- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | Open the app URL                                  | Landing page with animated peppolbox.sk logo (typewriter cycles between mailbox.sk and peppolbox.sk) |
| 2    | Observe tagline                                   | "Your electronic invoice mailbox on the Peppol network"                                              |
| 3    | Observe "Sign In" button                          | Button present                                                                                       |
| 4    | Observe "Register at your Digital Postman" button | Button present, links to PFS activation link from system settings                                    |
| 5    | Observe text under Register button                | "You will be redirected to the Tax Administration office portal"                                     |
| 6    | Observe footer                                    | Demo disclaimer, "Ask support at peppol(at)financnasprava.sk", GitHub link with icon                 |
| 7    | Observe bottom bar                                | Slovak flag accent (white, blue, red stripes)                                                        |
| 8    | Toggle dark mode (if accessible)                  | Logo .sk text switches from black to white, colors remain correct                                    |

### TC-1.2: First Sign-In (Super Admin)

| Step | Action                                                                                                                  | Expected                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Click "Sign In"                                                                                                         | Modal opens: "Sign in to peppolbox.sk" with Google, Apple, and email options                                    |
| 2    | Click "Continue with Google"                                                                                            | Google OAuth flow starts                                                                                        |
| 3    | Select stanislav.pavlovic@fiinancnasprava.sk                                                                            | Redirected back to app                                                                                          |
| 4    | Observe                                                                                                                 | Redirected to `/dashboard`, profile created                                                                     |
| 5    | Run in Supabase SQL Editor: `update profiles set is_super_admin = true where id = (select id from auth.users limit 1);` | Success                                                                                                         |
| 6    | Refresh the page                                                                                                        | Super Admin dashboard with stats cards, recent webhooks, recent invitations, and "Send Onboarding Request" card |

### TC-1.3: Configure System Settings

| Step | Action                                                     | Expected                                                              |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | Navigate to Settings (sidebar)                             | Settings page with Profile and System Settings                        |
| 2    | Observe "PFS Activation Link" field                        | Visible (super admin only)                                            |
| 3    | Enter: `https://kejwajsi.vercel.app/client?actlinkid=3047` | Field populated                                                       |
| 4    | Click "Save"                                               | "Saved" message appears                                               |
| 5    | Refresh page                                               | Link is persisted                                                     |
| 6    | Open app landing page in incognito                         | "Register at your Digital Postman" button links to the configured URL |

### TC-1.4: Update Profile

| Step | Action                                                   | Expected                        |
| ---- | -------------------------------------------------------- | ------------------------------- |
| 1    | On Settings page, fill "Full Name": `Stanislav Pavlovic` | Field populated                 |
| 2    | Fill "Phone": `+421900000000`                            | Field populated                 |
| 3    | Click "Save Changes"                                     | "Profile updated" message       |
| 4    | Refresh page                                             | Name and phone persisted        |
| 5    | Check avatar dropdown (top right)                        | Shows name "Stanislav Pavlovic" |

### TC-1.5: Dark Mode Toggle

| Step | Action                                 | Expected                          |
| ---- | -------------------------------------- | --------------------------------- |
| 1    | Click the sun/moon icon in the top bar | Theme switches to dark mode       |
| 2    | Click again                            | Theme switches back to light mode |
| 3    | Refresh page                           | Theme preference persisted        |

### TC-1.6: Sidebar Navigation (Desktop)

| Step | Action                           | Expected                                                                                             |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | Observe sidebar                  | Shows: Dashboard, Inbox, Companies, Users, Webhooks, Operations. Brand text: "peppolbox.sk" |
| 2    | Click each item                  | Navigates to correct page, active item highlighted                                                   |
| 3    | Click sidebar toggle (hamburger) | Sidebar collapses/expands                                                                            |

### TC-1.7: Bottom Tab Bar (Mobile)

| Step | Action                                  | Expected                                                           |
| ---- | --------------------------------------- | ------------------------------------------------------------------ |
| 1    | Resize browser to mobile width (<768px) | Sidebar hidden, bottom tab bar appears. Brand text: "peppolbox.sk" |
| 2    | Observe tab bar items                   | Shows nav items as icons with labels                               |
| 3    | Tap each tab                            | Navigates to correct page, active tab highlighted                  |

---

## Group 2: Company Onboarding via PFS Webhook

### TC-2.1: Trigger PFS Webhook (New Company)

| Step | Action                                                                                         | Expected                                               |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Go to PFS test environment and trigger a webhook for a test company (DIC: use a real test DIC) | Webhook sent to peppolbox.sk                           |
| 2    | In peppolbox.sk, navigate to Dashboard                                                         | "Webhooks" stat incremented                            |
| 3    | Check "Recent Webhooks" table                                                                  | New entry with DIC, company name, email                |
| 4    | Navigate to Companies page                                                                     | New company listed with Peppol status "Not registered" |
| 5    | Click company name                                                                             | Company detail page with DIC, email, phone, members    |

### TC-2.2: Verify Genesis Admin Invitation Sent

| Step | Action                                  | Expected                                                                                      |
| ---- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1    | Check "Recent Invitations" on Dashboard | New invitation for peppolbox.sk@gmail.com, role: company_admin, status: Pending                  |
| 2    | Check peppolbox.sk@gmail.com inbox         | Email: "You've been invited to peppolbox.sk as Company Admin" with "Accept Invitation" button |
| 3    | Navigate to Users page                  | Invitation visible in Invitations table                                                       |

### TC-2.3: Send Manual Onboarding Request (New Customer)

| Step | Action                                                          | Expected                                                       |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| 1    | On Super Admin Dashboard, find "Send Onboarding Request" card   | Card visible                                                   |
| 2    | Enter email: `test@example.com`, company name: `Test Manual Co` | Fields populated                                               |
| 3    | Click "Send Onboarding Link"                                    | "Onboarding request sent" message                              |
| 4    | Check recipient inbox                                           | Email: "Get started with peppolbox.sk — Register your company" |
| 5    | Check Audit Log page                                            | `ONBOARDING_REQUEST_SENT` event logged                         |

---

## Group 3: Genesis Admin Onboarding & Auto Peppol Activation

### TC-3.1: Accept Invitation — Auto Peppol Activation

| Step | Action                                           | Expected                                                                                        |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1    | Open the invitation email in peppolbox.sk@gmail.com | Email with "Accept Invitation" button                                                           |
| 2    | Click "Accept Invitation"                        | Redirected to `/activate` page (NOT welcome screen)                                             |
| 3    | Observe activation page                          | Spinner with "Activating [Company Name] on Peppol", message about registering on Peppol network |
| 4    | Wait for activation to complete                  | Green checkmark, "Your company is now active on Peppol!", Peppol ID shown (0245:DIC)            |
| 5    | Observe notification message                     | "You will receive email notifications when new invoices arrive in your inbox."                  |
| 6    | Click "Go to Dashboard"                          | Company Admin dashboard with company card (NO welcome screen)                                   |
| 7    | Check company card                               | Shows company name, DIC, Peppol status "Active"                                                 |
| 8    | Navigate to Wallet                               | Wallet exists with 0.03 EUR balance ("Welcome credit on Peppol activation")                     |
| 9    | Check Transaction History                        | One "Top Up" transaction: +0.03 EUR                                                             |

### TC-3.2: Verify Auto Activation Effects

| Step | Action                                | Expected                                                                           |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Check Audit Log (as super admin)      | `PEPPOL_COMPANY_ACTIVATED` and `USER_ONBOARDED` events logged                      |
| 2    | Navigate to Companies → click company | Peppol status: "Active", Peppol ID, activation date, ion-AP Org ID shown           |
| 3    | Check ion-AP test environment         | Organization exists, identifier `0245:<DIC>` published, receive trigger configured |

### TC-3.3: Activation Failure Handling

| Step | Action                                                                | Expected                                                                                                                                              |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Temporarily break ion-AP token, trigger a new genesis invite + accept | `/activate` page shows error state                                                                                                                    |
| 2    | Observe error page                                                    | Red X icon, "Activation failed", error message, "Don't worry — your account is ready. A peppolbox.sk administrator can retry the activation for you." |
| 3    | Click "Go to Dashboard"                                               | Dashboard loads (account works despite activation failure)                                                                                            |
| 4    | Restore token, super admin manually activates via company detail page | Activation succeeds (fallback works)                                                                                                                  |

### TC-3.4: Verify Genesis Admin Membership

| Step | Action                     | Expected                                                                            |
| ---- | -------------------------- | ----------------------------------------------------------------------------------- |
| 1    | Navigate to Companies page | Company listed                                                                      |
| 2    | Click company              | Company detail page                                                                 |
| 3    | Check Members table        | peppolbox.sk@gmail.com listed as "company admin" with "Genesis" badge, status "Active" |

---

## Group 4: Peppol Activation (Manual Fallback)

### TC-4.1: Manual Activate Company on Peppol (Super Admin)

| Step | Action                                                                          | Expected                                                                             |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1    | Sign in as super admin                                                          | Super Admin dashboard                                                                |
| 2    | Navigate to Companies → click a company with status "Not registered" or "Error" | Company detail page                                                                  |
| 3    | Observe "Peppol Network" card                                                   | Shows "Activate on Peppol" button                                                    |
| 4    | Click "Activate on Peppol"                                                      | Confirmation dialog                                                                  |
| 5    | Confirm                                                                         | Loading spinner, then page refreshes                                                 |
| 6    | Observe company detail                                                          | Peppol status: "Active", Peppol ID shown, activation date shown, ion-AP Org ID shown |
| 7    | Check Audit Log                                                                 | `PEPPOL_COMPANY_ACTIVATED` event                                                     |

### TC-4.2: Verify ion-AP Registration

| Step | Action                                 | Expected                                                                 |
| ---- | -------------------------------------- | ------------------------------------------------------------------------ |
| 1    | Open ion-AP test environment UI or API | Organization exists with correct name and DIC                            |
| 2    | Check identifiers                      | `0245:<DIC>` identifier, verified: true, publish_receive_peppolbis: true |
| 3    | Check receive triggers                 | API_CALL trigger configured pointing to peppolbox.sk webhook URL         |

---

## Group 5: User Management & Invitations

### TC-5.1: Invite Company Admin (by Genesis Admin)

| Step | Action                                                                   | Expected                                                                |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | Sign in as peppolbox.sk@gmail.com (genesis admin)                           | Company Admin dashboard                                                 |
| 2    | Navigate to Users page                                                   | Users table and Invitations table visible, "Invite User" button visible |
| 3    | Click "Invite User"                                                      | Dialog opens with email, role, and company checkboxes                   |
| 4    | Enter email: `newadmin@test.com`, role: Company Admin, check the company | Form filled                                                             |
| 5    | Click "Send Invitation"                                                  | Dialog closes, invitation appears in table                              |
| 6    | Check Audit Log                                                          | `INVITE_CREATED` event                                                  |

### TC-5.2: Invite Operator (by Genesis Admin)

| Step | Action                                                              | Expected                                                                            |
| ---- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1    | On Users page, click "Invite User"                                  | Dialog opens                                                                        |
| 2    | Enter email: `operator@test.com`, role: Operator, check the company | Form filled                                                                         |
| 3    | Click "Send Invitation"                                             | Dialog closes, invitation appears                                                   |
| 4    | Check operator@test.com inbox                                       | Invitation email: "You've been invited to peppolbox.sk as Operator" with magic link |

### TC-5.3: Invite Processor (by Genesis Admin)

| Step | Action                                                                     | Expected                                                                             |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1    | On Users page, click "Invite User"                                         | Dialog opens                                                                         |
| 2    | Enter email: `jankouctovaník@gmail.com`, role: Processor, check the company | Form filled                                                                          |
| 3    | Click "Send Invitation"                                                    | Dialog closes, invitation appears                                                    |
| 4    | Check jankouctovaník@gmail.com inbox                                        | Invitation email: "You've been invited to peppolbox.sk as Processor" with magic link |

### TC-5.4: Processor Accepts Invitation

| Step | Action                                           | Expected                                                                |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | Open invitation email in jankouctovaník@gmail.com | Email with "Accept Invitation" button                                   |
| 2    | Click "Accept Invitation"                        | Redirected to peppolbox.sk, signed in                                   |
| 3    | Observe Welcome screen                           | "Welcome to peppolbox.sk!", role badge: "Processor", company name shown |
| 4    | Click "Go to Dashboard"                          | Redirected to Inbox (processor has no dashboard)                        |
| 5    | Observe sidebar                                  | Only "Inbox" and "Companies" items visible                              |

### TC-5.5: Operator Access & Triage

| Step | Action                                | Expected                                               |
| ---- | ------------------------------------- | ------------------------------------------------------ |
| 1    | Sign in as operator                   | Dashboard with company cards                           |
| 2    | Navigate to Inbox                     | Documents visible, Department column shown, can triage |
| 3    | Assign a document to a department     | Department picker works, document assigned             |
| 4    | Navigate to Users                     | NOT accessible (operator cannot manage users)          |
| 5    | Navigate to Companies → click company | Can view, cannot activate/deactivate                   |

### TC-5.6: Processor Access Restrictions

| Step | Action                                            | Expected                                            |
| ---- | ------------------------------------------------- | --------------------------------------------------- |
| 1    | As processor, observe Inbox                       | Only documents assigned to their department visible |
| 2    | Documents with no department or other departments | NOT visible                                         |
| 3    | Navigate to Companies                             | Company listed (read-only)                          |
| 4    | Navigate to Audit Log                             | Only own audit events visible                       |
| 5    | Try to access `/dashboard/users` directly         | Redirected away                                     |

### TC-5.7: Deactivate a Member (by Genesis Admin)

| Step | Action                                                | Expected                                              |
| ---- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1    | Sign in as peppolbox.sk@gmail.com                        | Company Admin dashboard                               |
| 2    | Navigate to Companies → click company → Members table | Operator and processor listed                         |
| 3    | Click "Deactivate" next to processor                  | Confirmation dialog                                   |
| 4    | Confirm                                               | Processor status changes to "Inactive"                |
| 5    | Sign in as jankouctovaník@gmail.com                    | Dashboard shows no companies (membership deactivated) |
| 6    | Check Audit Log (as super admin)                      | `MEMBERSHIP_DEACTIVATED` event                        |

### TC-5.8: Reactivate a Member (by Genesis Admin)

| Step | Action                                                | Expected                                               |
| ---- | ----------------------------------------------------- | ------------------------------------------------------ |
| 1    | Sign in as peppolbox.sk@gmail.com                        | Company Admin dashboard                                |
| 2    | Navigate to Companies → click company → Members table | Processor shows "Inactive" badge with "Reactivate" button |
| 3    | Click "Reactivate" next to processor                  | Confirmation dialog: "regain access with original roles" |
| 4    | Confirm                                               | Processor status changes back to "Active"              |
| 5    | Sign in as jankouctovaník@gmail.com                    | Dashboard shows company again (membership restored)    |
| 6    | Check Audit Log (as super admin)                      | `MEMBERSHIP_REACTIVATED` event                         |

### TC-5.9: Webhooks Access (Super Admin Only)

| Step | Action                                  | Expected                                                  |
| ---- | --------------------------------------- | --------------------------------------------------------- |
| 1    | Sign in as super admin                  | "Webhooks" visible in sidebar                             |
| 2    | Navigate to Webhooks                    | All webhooks visible (no company filter)                  |
| 3    | Sign in as company admin (genesis)      | "Webhooks" NOT visible in sidebar                         |
| 4    | Sign in as operator                     | "Webhooks" NOT visible in sidebar                         |

---

## Group 6: OTP Sign-In Flow

### TC-6.1: Sign Up with Email OTP

| Step | Action                                   | Expected                                                                        |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| 1    | Sign out                                 | Redirected to landing page                                                      |
| 2    | Click "Sign In" → enter a new test email | Modal shows email field                                                         |
| 3    | Click "Continue with Email"              | Choose verification channel screen                                              |
| 4    | Click "Send code to [email]"             | Code input screen appears, "Code sent to..." message                            |
| 5    | Check email                              | 6-digit code received, subject: "[code] is your peppolbox.sk verification code" |
| 6    | Enter code digits one by one             | Each input auto-advances                                                        |
| 7    | On 6th digit                             | Auto-submits, signed in, redirected to dashboard                                |

### TC-6.2: Sign Up with SMS OTP

| Step | Action                                  | Expected                             |
| ---- | --------------------------------------- | ------------------------------------ |
| 1    | Sign out, click "Sign In" → enter email | Choose verification channel          |
| 2    | Enter phone number: `+421 9XX XXX XXX`  | Phone field populated                |
| 3    | Click "Send code via SMS"               | Code input screen appears            |
| 4    | Check phone                             | SMS with 6-digit code received       |
| 5    | Enter code                              | Auto-submits on 6th digit, signed in |

### TC-6.3: Sign In (Returning User via OTP)

| Step | Action                                   | Expected                                                     |
| ---- | ---------------------------------------- | ------------------------------------------------------------ |
| 1    | Sign out and sign in with the same email | Choose verification channel                                  |
| 2    | Observe phone option                     | Shows masked phone `****XXXX` (registered phone from signup) |
| 3    | Send code via email                      | Code received, enter it, signed in                           |

### TC-6.4: Wrong Code

| Step | Action                      | Expected                                 |
| ---- | --------------------------- | ---------------------------------------- |
| 1    | Request a code              | Code input screen                        |
| 2    | Enter `000000` (wrong code) | Error message: "Invalid or expired code" |
| 3    | Click "Resend code"         | New code sent, message: "New code sent!" |
| 4    | Enter correct code          | Signed in                                |

---

## Group 7: Test Invoices

### TC-7.1: Send Test Invoices

| Step | Action                                                          | Expected                                                                       |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | Sign in as company admin (genesis) with a Peppol-active company | Company Admin dashboard                                                        |
| 2    | Observe company card                                            | "Send test invoices" button visible (only on Peppol-active companies)          |
| 3    | Click "Send test invoices"                                      | Confirmation dialog: "This will send 3 real Peppol invoices to [Company Name]" |
| 4    | Confirm                                                         | Loading spinner, then "3 test invoices sent!" message                          |
| 5    | Wait 10-30 seconds for ion-AP to deliver                        | Invoices arrive via Peppol receive webhook                                     |
| 6    | Navigate to Inbox                                               | 3 new unread documents from "Maliar Palo s.r.o."                               |

### TC-7.2: Verify Test Invoice Content

| Step | Action                            | Expected                                                                             |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------ |
| 1    | Click first test invoice          | Document detail with correct metadata                                                |
| 2    | Observe sender                    | "Maliar Palo s.r.o." (9950:6878787887)                                               |
| 3    | Observe line items in From column | Slovak item names with correct diacritics (no &#XXX; entities)                       |
| 4    | Verify amounts                    | Mix of 23% and 10% VAT rates, totals calculated correctly                            |
| 5    | Check all 3 invoices              | Different content: office supplies (~€47), IT equipment (~€82), consulting (~€1,250) |

### TC-7.3: Verify Email Notification

| Step | Action                                          | Expected                                                                                                             |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | Check company email inbox (company_email field) | 3 notification emails received                                                                                       |
| 2    | Observe email content                           | Subject: "New Invoice received from Maliar Palo s.r.o.", amount, due date, up to 3 line items, "View Invoice" button |
| 3    | Click "View Invoice" button in email            | Opens document detail page in browser                                                                                |

---

## Group 8: Inbox & Document Viewing

### TC-8.1: Inbox List View

| Step | Action                          | Expected                                                                 |
| ---- | ------------------------------- | ------------------------------------------------------------------------ |
| 1    | Navigate to Inbox               | Documents listed with columns: checkbox, status icon, From, Amount, Date |
| 2    | Observe "new" documents         | Bold text, filled mail icon, subtle background highlight                 |
| 3    | Observe "assigned" documents    | Normal text, folder icon                                                 |
| 4    | Observe "processed" documents   | Normal text, check icon                                                  |
| 5    | Status filters available        | New, Assigned, Processed, Pending, Failed (no "Read" filter)             |

### TC-8.2: Click Row to Open Detail

| Step | Action                           | Expected                                                       |
| ---- | -------------------------------- | -------------------------------------------------------------- |
| 1    | Click anywhere on a document row | Navigates to document detail page                              |
| 2    | Observe cursor                   | Pointer cursor on hover, row highlights on hover               |
| 3    | Go back to Inbox                 | Document status unchanged (stays "new" until assigned/processed) |

### TC-8.3: PDF Hover Button

| Step | Action                    | Expected                                                |
| ---- | ------------------------- | ------------------------------------------------------- |
| 1    | Hover over a document row | Small PDF icon (FileText) appears on the right side     |
| 2    | Move mouse away           | Icon disappears                                         |
| 3    | Click the PDF icon        | New tab opens with PDF rendering of the invoice         |
| 4    | Observe                   | Clicking PDF icon does NOT also navigate to detail page |

### TC-8.4: View Document Detail

| Step | Action                           | Expected                                                          |
| ---- | -------------------------------- | ----------------------------------------------------------------- |
| 1    | Click on a document row          | Document detail page                                              |
| 2    | Observe status                   | Status stays "new" (no auto-mark-as-read)                         |
| 3    | Observe metadata cards           | Sender, Receiver, Company, Received date                          |
| 4    | Observe Transaction Details card | Transaction UUID, ion-AP Transaction ID, Document Type, Direction |
| 5    | Observe Activity & Notes section | Timeline of audit events + notes at the bottom                    |

### TC-8.5: Mark Document as Processed

| Step | Action                                               | Expected                                                      |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------- |
| 1    | On document detail, click "..." menu (top right)     | Dropdown opens with "Mark as Processed" and "Download PDF"    |
| 2    | Click "Mark as Processed"                            | Dialog opens with note field                                  |
| 3    | Enter note: "Payment verified, forwarded to accounting" | Note field populated                                       |
| 4    | Click "Mark as Processed"                            | Dialog closes, status badge changes to "processed" (green)    |
| 5    | Observe Activity & Notes timeline                    | New entry: "Marked as Processed" with the note               |
| 6    | Check Audit Log                                      | `DOCUMENT_PROCESSED` event logged                             |

### TC-8.6: Add Note to Document

| Step | Action                                       | Expected                                     |
| ---- | -------------------------------------------- | -------------------------------------------- |
| 1    | On document detail, find "Activity & Notes"  | Input field: "Add a note..." at the top      |
| 2    | Type a note and press Enter (or click Add)   | Note appears in the timeline                 |
| 3    | Add another note                             | Both notes visible, newest first             |
| 4    | Check Audit Log                              | `DOCUMENT_NOTE_ADDED` event logged           |

### TC-8.7: Download PDF from Detail

| Step | Action                                           | Expected                               |
| ---- | ------------------------------------------------ | -------------------------------------- |
| 1    | On document detail, click "..." → "Download PDF" | New tab opens                          |
| 2    | Observe                                          | PDF rendering of the invoice displayed |

### TC-8.8: Company Switcher Filtering

| Step | Action                                                      | Expected                                       |
| ---- | ----------------------------------------------------------- | ---------------------------------------------- |
| 1    | As super admin with multiple companies, go to Inbox         | All documents shown                            |
| 2    | Use company switcher (top bar) to select a specific company | Inbox filters to only that company's documents |
| 3    | Select "All Companies"                                      | All documents shown again                      |

---

## Group 9: Mass Download

### TC-9.1: Select Documents with Checkboxes

| Step | Action                                | Expected                                   |
| ---- | ------------------------------------- | ------------------------------------------ |
| 1    | Navigate to Inbox (any role)          | Checkboxes visible on every row            |
| 2    | Click checkbox on a row               | Row highlighted, selection toolbar appears |
| 3    | Click "Select All" checkbox in header | All documents selected                     |
| 4    | Click "Clear" in toolbar              | All deselected, toolbar disappears         |

### TC-9.2: Bulk Download XML Shows Confirmation

| Step | Action                                    | Expected                                                                     |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| 1    | Select 2 documents                        | Toolbar shows: "2 selected", Download button                                 |
| 2    | Click "Download" → "Download XML"         | Confirmation dialog: "Exporting XML marks 2 document(s) as processed"        |
| 3    | Observe note field                        | Required textarea, placeholder text                                          |
| 4    | Try clicking "Export XML & Process" empty  | Button disabled (note required)                                              |
| 5    | Enter note: "Batch export to SAP"         | Button enabled                                                               |
| 6    | Click "Export XML & Process"              | Files download, documents marked as processed                                |
| 7    | Check Inbox                               | Documents show "processed" status                                            |
| 8    | Check document timeline                   | Note "Batch export to SAP" visible with "processed" type                     |
| 9    | Check Audit Log                           | `DOCUMENTS_BULK_PROCESSED` event with note and document count                |

### TC-9.3: Bulk Download PDF Does NOT Mark as Processed

| Step | Action                                    | Expected                                             |
| ---- | ----------------------------------------- | ---------------------------------------------------- |
| 1    | Select 2 documents with status "new"      | Toolbar visible                                      |
| 2    | Click "Download" → "Download PDF"         | PDFs download directly — NO confirmation dialog      |
| 3    | Check Inbox                               | Documents still show "new" status (unchanged)        |

### TC-9.4: Bulk Download Both Shows Confirmation

| Step | Action                                    | Expected                                                       |
| ---- | ----------------------------------------- | -------------------------------------------------------------- |
| 1    | Select documents                          | Toolbar visible                                                |
| 2    | Click "Download" → "Download Both"        | Confirmation dialog (same as XML — because XML is included)    |
| 3    | Enter note, confirm                       | XML + PDF files download, documents marked as processed        |

### TC-9.5: Export XML & Process on Document Detail

| Step | Action                                           | Expected                                                              |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------- |
| 1    | Open a document with status "new" or "assigned"  | Document detail page                                                  |
| 2    | Click "..." menu                                 | "Export XML & Process", "Mark as Processed", "Download PDF" visible   |
| 3    | Click "Export XML & Process"                     | Dialog: "The XML file is the legally valid electronic invoice..."     |
| 4    | Enter note: "Imported to accounting"             | Note field populated                                                  |
| 5    | Click "Export XML & Process"                     | XML file downloads, status changes to "processed"                     |
| 6    | Check timeline                                   | Note visible with "processed" type                                    |

### TC-9.6: Download PDF from Detail Does NOT Mark as Processed

| Step | Action                                    | Expected                                       |
| ---- | ----------------------------------------- | ---------------------------------------------- |
| 1    | Open a document with status "new"         | Document detail page                           |
| 2    | Click "..." → "Download PDF"             | PDF opens in new tab                           |
| 3    | Go back, observe status                   | Still "new" (unchanged)                        |

### TC-9.7: Download Individual Files (1-4 selected)

| Step | Action                                                | Expected                                                    |
| ---- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Select 2 documents                                    | Toolbar shows: "2 selected", Download button                |
| 2    | Click "Download" → "Download PDF"                     | 2 PDF files downloaded individually with ~300ms delay       |
| 3    | Check filenames                                       | Named by document ID (e.g., `TEST-001.pdf`)                 |

### TC-9.8: Download as ZIP (5+ selected)

| Step | Action                            | Expected                                              |
| ---- | --------------------------------- | ----------------------------------------------------- |
| 1    | Select 5 or more documents        | Toolbar with Download button                          |
| 2    | Click "Download" → "Download XML" | Progress shown: "Downloading 3/5..."                  |
| 3    | Wait for completion               | Single ZIP file downloaded: `invoices-YYYY-MM-DD.zip` |
| 4    | Open ZIP                          | Contains all XML files named by document ID           |
| 5    | Repeat with "Download PDF"        | ZIP with PDF files                                    |
| 6    | Repeat with "Download Both"       | ZIP with both XML and PDF files                       |

### TC-9.9: Toolbar Layout for Triage Users

| Step | Action                                                 | Expected                                                                                              |                                              |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1    | Sign in as user with triage permission (company admin) | Inbox with Department column                                                                          |                                              |
| 2    | Select documents                                       | Toolbar shows: "N selected" → "Assign to" dropdown → vertical divider → "Download" dropdown → "Clear" |                                              |
| 3    | Observe visual separation                              | Clear `                                                                                               | ` divider between Assign and Download groups |
| 4    | Click "Assign to"                                      | Department dropdown (does NOT download)                                                               |                                              |
| 5    | Click "Download"                                       | File type dropdown (does NOT assign)                                                                  |                                              |

---

## Group 10: Audit Log

### TC-10.1: View Audit Logs (Super Admin)

| Step | Action                            | Expected                                                                                                                                    |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to Audit Log             | Table with all events                                                                                                                       |
| 2    | Observe columns                   | Time, Event (name + ID), Severity, Actor, Company DIC, Source IP                                                                            |
| 3    | Verify events from previous tests | AUTH_SIGN_IN, INVITE_CREATED, INVITE_ACCEPTED, PEPPOL_COMPANY_ACTIVATED, USER_ONBOARDED, TEST_INVOICES_SENT, PEPPOL_DOCUMENT_RECEIVED, etc. |
| 4    | Check severity badges             | info (blue), warning (yellow), error (red)                                                                                                  |

### TC-10.2: Audit Log Filtering by Company

| Step | Action                                   | Expected                                         |
| ---- | ---------------------------------------- | ------------------------------------------------ |
| 1    | Use company switcher to select a company | Audit log filters to company-related events only |
| 2    | Select "All Companies"                   | All events shown again                           |

### TC-10.3: Audit Log Visibility (Company Admin)

| Step | Action                                         | Expected                                            |
| ---- | ---------------------------------------------- | --------------------------------------------------- |
| 1    | Sign in as company admin (peppolbox.sk@gmail.com) | Dashboard                                           |
| 2    | Navigate to Audit Log                          | Only events for own companies + own actions visible |
| 3    | Verify super-admin-only events are NOT visible | No other company's events shown                     |

### TC-10.4: Audit Log Visibility (Operator)

| Step | Action                         | Expected                                                       |
| ---- | ------------------------------ | -------------------------------------------------------------- |
| 1    | Sign in as operator            | Dashboard                                                      |
| 2    | Open user avatar dropdown      | "Audit Log" menu item visible                                  |
| 3    | Click "Audit Log"              | Only own actions + assigned company events visible             |
| 4    | Verify other company events    | NOT visible                                                    |

---

## Group 11: Company Deactivation

### TC-11.1: Deactivate a Company (Super Admin)

| Step | Action                                              | Expected                                                            |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | Sign in as super admin                              | Dashboard                                                           |
| 2    | Navigate to Companies → click the activated company | Company detail                                                      |
| 3    | Scroll to "Danger Zone" card                        | "Deactivate Company" button visible                                 |
| 4    | Click "Deactivate Company"                          | Confirmation dialog with warning text                               |
| 5    | Confirm                                             | Redirected to Companies list                                        |
| 6    | Navigate back to company detail                     | Deactivated banner shown, "Deactivated" badge, no activation button |

### TC-11.2: Verify Deactivation Effects

| Step | Action                           | Expected                                              |
| ---- | -------------------------------- | ----------------------------------------------------- |
| 1    | Check company Peppol status      | "Not registered" (reset to pending)                   |
| 2    | Check Members table              | All members status: "Inactive"                        |
| 3    | Sign in as peppolbox.sk@gmail.com   | No companies visible (membership deactivated)         |
| 4    | Check Audit Log (as super admin) | `COMPANY_DEACTIVATED` event with details              |
| 5    | Check ion-AP                     | Organization unpublished from SMP, identifier removed |

### TC-11.3: Verify Deactivated Company in Companies List

| Step | Action                                | Expected                            |
| ---- | ------------------------------------- | ----------------------------------- |
| 1    | As super admin, navigate to Companies | Deactivated company still listed    |
| 2    | Observe Peppol column                 | Shows "Not registered"              |
| 3    | Click company                         | Detail page with deactivated banner |

---

## Group 12: Company Reactivation

### TC-12.1: Reactivate a Deactivated Company

| Step | Action                                               | Expected                                                                                              |
| ---- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1    | As super admin, open the deactivated company detail  | "Reactivate Company" card visible                                                                     |
| 2    | Observe pre-filled fields                            | DIC (read-only), Peppol ID (read-only), Company Name, Company Email, Genesis Admin Email              |
| 3    | Edit Company Name if needed                          | Field editable                                                                                        |
| 4    | Change Genesis Admin Email to: `peppolbox.sk@gmail.com` | Field updated                                                                                         |
| 5    | Click "Reactivate"                                   | Confirmation dialog                                                                                   |
| 6    | Confirm                                              | Loading spinner, company status set to active, genesis invite sent                                    |
| 7    | Observe company detail                               | Company status: active, Peppol status: still "Not registered" (activation deferred to genesis accept) |

### TC-12.2: Genesis Admin Triggers Reactivation Peppol Activation

| Step | Action                             | Expected                                                 |
| ---- | ---------------------------------- | -------------------------------------------------------- |
| 1    | Check peppolbox.sk@gmail.com inbox    | New genesis admin invitation email received              |
| 2    | Click "Accept Invitation" in email | Redirected to `/activate` page                           |
| 3    | Wait for Peppol activation         | Green checkmark, "Your company is now active on Peppol!" |
| 4    | Click "Go to Dashboard"            | Dashboard (no welcome screen)                            |
| 5    | Check company Peppol status        | "Active"                                                 |
| 6    | Check Audit Log                    | `COMPANY_REACTIVATED`, `PEPPOL_COMPANY_ACTIVATED` events |
| 7    | Check ion-AP                       | New organization created, identifier published in SMP    |

---

## Group 13: Departments

### TC-13.1: Create a Department (Company Admin)

| Step | Action                                         | Expected                                                   |
| ---- | ---------------------------------------------- | ---------------------------------------------------------- |
| 1    | Sign in as genesis admin (peppolbox.sk@gmail.com) | Company Admin dashboard                                    |
| 2    | Navigate to Companies → click company          | Company detail page                                        |
| 3    | Scroll to "Departments" section                | Department manager visible with "Create Department" button |
| 4    | Click "Create Department"                      | Dialog with name field                                     |
| 5    | Enter name: `Accounting`                       | Field populated                                            |
| 6    | Submit                                         | Department appears in list                                 |
| 7    | Create another: `IT Support`                   | Second department appears                                  |
| 8    | Check Audit Log                                | `DEPARTMENT_CREATED` events                                |

### TC-13.2: Create Sub-department

| Step | Action                                              | Expected                                       |
| ---- | --------------------------------------------------- | ---------------------------------------------- |
| 1    | In Departments section, click "Create Department"   | Dialog with name and optional parent           |
| 2    | Enter name: `Invoices`, select parent: `Accounting` | Form filled                                    |
| 3    | Submit                                              | Sub-department appears nested under Accounting |

### TC-13.3: Add Member to Department

| Step | Action                                  | Expected                        |
| ---- | --------------------------------------- | ------------------------------- |
| 1    | In a department row, click "Add member" | Dialog with user dropdown       |
| 2    | Select a company member                 | User selected                   |
| 3    | Submit                                  | Member appears under department |
| 4    | Check Audit Log                         | `DEPARTMENT_MEMBER_ADDED` event |

### TC-13.4: Remove Member from Department

| Step | Action                                                           | Expected                          |
| ---- | ---------------------------------------------------------------- | --------------------------------- |
| 1    | In department members list, click remove button next to a member | Confirmation                      |
| 2    | Confirm                                                          | Member removed from department    |
| 3    | Check Audit Log                                                  | `DEPARTMENT_MEMBER_REMOVED` event |

### TC-13.5: Document Triage — Assign to Department

| Step | Action                                           | Expected                                              |
| ---- | ------------------------------------------------ | ----------------------------------------------------- |
| 1    | Navigate to Inbox with documents (company admin) | Department column visible                             |
| 2    | Click department picker on a document row        | Dropdown shows departments                            |
| 3    | Select "Accounting"                              | Document assigned, badge changes to blue "Accounting" |
| 4    | Observe document status                          | Status changes to "assigned" (if was "read")          |

### TC-13.6: Processor Sees Only Department Documents

| Step | Action                                                             | Expected                                                   |
| ---- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1    | Invite a user as Processor, assign them to "Accounting" department | User created                                               |
| 2    | Sign in as processor                                               | Redirected to Inbox                                        |
| 3    | Observe                                                            | Only documents assigned to "Accounting" department visible |
| 4    | Documents with no department or other departments                  | NOT visible                                                |
| 5    | Try to access an unassigned document URL directly                  | 404                                                        |

---

## Group 14: Wallet & Prepaid Billing

### TC-14.1: Wallet Creation

| Step | Action                                     | Expected                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------ |
| 1    | As genesis admin, navigate to Wallet page  | "No wallet found" message if no documents received yet |
| 2    | Receive a document (or send test invoices) | Wallet auto-created for genesis admin                  |
| 3    | Navigate to Wallet page again              | Wallet visible with balance card, transaction history  |

### TC-14.2: Default Pricing & Configuration (Super Admin)

| Step | Action                                                | Expected                                                                          |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | Sign in as super admin                                | Dashboard                                                                         |
| 2    | Navigate to Companies → click a newly created company | Company detail                                                                    |
| 3    | Find "Pricing" card                                   | Shows "0.0100 EUR" (default for new companies via PFS webhook)                    |
| 4    | Click edit, enter: `0.04`                             | Price field populated                                                             |
| 5    | Save                                                  | "0.0400 EUR" displayed per document                                               |
| 6    | Check help text                                       | "Each document received via Peppol for this company will be charged at this rate" |

### TC-14.3: Document Auto-Charging (Sufficient Balance)

| Step | Action                                                                                  | Expected                                           |
| ---- | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | Ensure wallet has balance (e.g., 0.03 EUR welcome credit) and company price is 0.01 EUR | Prerequisites met (default after onboarding)       |
| 2    | Send test invoices (3 invoices)                                                         | Invoices arrive in inbox                           |
| 3    | Navigate to Wallet → Transaction History                                                | 3 "Charge" transactions, -0.01 EUR each            |
| 4    | Check balance                                                                           | Reduced by 0.03 EUR (3 × 0.01), balance = 0.47 EUR |
| 5    | Check Inbox                                                                             | Documents are NOT locked (all billed)              |

### TC-14.4: Document Locking (Insufficient Balance)

| Step | Action                                                   | Expected                                                                              |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1    | Set wallet balance to 0 EUR (via super admin adjustment) | Balance is 0                                                                          |
| 2    | Send test invoices (3 invoices)                          | Invoices arrive                                                                       |
| 3    | Navigate to Inbox (as non-super-admin)                   | Yellow warning banner: "Some documents are locked due to insufficient wallet balance" |
| 4    | Observe locked documents                                 | Dimmed rows, blurred text, lock icon                                                  |
| 5    | Hover over locked row                                    | No PDF icon but pointer cursor (clickable)                                            |
| 6    | Click a locked document                                  | QR payment modal opens (NOT a "Document Locked" page)                                 |
| 7    | Close modal without paying                               | Modal closes, back to inbox                                                           |
| 8    | Try to access locked document URL directly               | "Document Locked" page with "Go to Wallet" button                                     |
| 9    | Sign in as super admin, check same Inbox                 | All documents visible (super admin bypasses locks)                                    |

### TC-14.5: Wallet Top-Up via QR Payment

| Step | Action                                     | Expected                                                          |
| ---- | ------------------------------------------ | ----------------------------------------------------------------- |
| 1    | Navigate to Wallet page                    | Balance card with "Top Up" button                                 |
| 2    | Click "Top Up"                             | Dialog with amount input                                          |
| 3    | Enter amount: `5.00`                       | Field populated                                                   |
| 4    | Click "Generate Payment"                   | QR code displayed (desktop) or "Open Banking App" button (mobile) |
| 5    | Observe                                    | Transaction ID shown, "Waiting for payment..." pulsing indicator  |
| 6    | Complete payment via banking app (scan QR) | Dialog polls every 4 seconds                                      |
| 7    | Payment confirmed                          | Green checkmark: "Payment Received! 5.00 EUR has been added"      |
| 8    | Dialog closes, page refreshes              | Balance increased by 5.00 EUR                                     |
| 9    | Check Transaction History                  | "Top Up" transaction: +5.00 EUR                                   |

### TC-14.6: Payment Modal on Locked Document (Unlock Flow)

| Step | Action                                         | Expected                                                           |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Have locked documents in Inbox (balance = 0)   | Locked rows visible                                                |
| 2    | Click a locked document row                    | QR payment modal opens (amount input + generate)                   |
| 3    | Enter amount: `1.00`, click "Generate Payment" | QR code shown                                                      |
| 4    | Complete payment via banking app               | Modal shows "Payment Received!"                                    |
| 5    | Wait 1 second                                  | Page refreshes, then auto-navigates to the clicked document detail |
| 6    | Observe                                        | Document is viewable (unlocked), status "read"                     |
| 7    | Go back to Inbox                               | Previously locked documents now unlocked                           |

### TC-14.7: Peppol Billing Invoice After Payment

| Step | Action                                    | Expected                                                                                |
| ---- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | Complete a QR payment top-up (any amount) | Payment confirmed                                                                       |
| 2    | Wait 10-30 seconds                        | Billing invoice sent via Peppol                                                         |
| 3    | Check Inbox                               | New invoice from "peppolbox.sk" arrives                                                 |
| 4    | Click the billing invoice                 | Sender: peppolbox.sk (9950:6878787887), line: "peppolbox.sk - e-invoice service credit" |
| 5    | Verify amount                             | Amount matches the top-up amount, 23% VAT applied                                       |
| 6    | Check Audit Log                           | `BILLING_INVOICE_SENT` event logged                                                     |

### TC-14.8: Auto-Billing After Top-Up

| Step | Action                                                                      | Expected                                            |
| ---- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| 1    | Have 3 unbilled (locked) documents at 0.01 EUR each (total 0.03 EUR needed) | Documents locked                                    |
| 2    | Top up wallet with 1.00 EUR                                                 | Payment received                                    |
| 3    | Check Inbox immediately                                                     | All 3 documents unlocked (no longer blurred/locked) |
| 4    | Check Transaction History                                                   | Top-up (+1.00) followed by 3 charges (-0.01 each)   |
| 5    | Check balance                                                               | 1.00 - 0.03 = 0.97 EUR                              |

### TC-14.9: All-or-Nothing Billing

| Step | Action                                                                    | Expected                                             |
| ---- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Have 3 unbilled documents (0.01 each = 0.03 total), wallet balance: 0 EUR | All locked                                           |
| 2    | Top up with 0.01 EUR                                                      | Payment received                                     |
| 3    | Check Inbox                                                               | Documents still locked (0.01 < 0.03, can't bill all) |
| 4    | Top up with 0.03 EUR more (total 0.04 EUR)                                | Payment received                                     |
| 5    | Check Inbox                                                               | All 3 documents now unlocked (0.04 >= 0.03)          |
| 6    | Check balance                                                             | 0.04 - 0.03 = 0.01 EUR                               |

### TC-14.10: Super Admin Adjust Balance

| Step | Action                                                                                                  | Expected                                                |
| ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Sign in as super admin                                                                                  | Dashboard                                               |
| 2    | Navigate to Companies → click company → find wallet link, or directly to `/dashboard/wallet/[walletId]` | Wallet detail page (shows owner name)                   |
| 3    | Click "Adjust Balance"                                                                                  | Dialog with amount and description fields               |
| 4    | Enter amount: `10.00`, description: `Manual credit for testing`                                         | Fields populated                                        |
| 5    | Submit                                                                                                  | Balance increases by 10.00 EUR                          |
| 6    | Check Transaction History                                                                               | "Adjustment" transaction: +10.00 EUR, description shown |
| 7    | If unbilled documents exist                                                                             | Auto-billing triggered, documents unlocked              |

### TC-14.11: Negative Adjustment

| Step | Action                                                     | Expected                      |
| ---- | ---------------------------------------------------------- | ----------------------------- |
| 1    | As super admin on wallet detail, click "Adjust Balance"    | Dialog opens                  |
| 2    | Enter amount: `-5.00`, description: `Refund`               | Fields populated              |
| 3    | Submit                                                     | Balance decreases by 5.00 EUR |
| 4    | Try to adjust with amount that would make balance negative | Error: cannot go below zero   |

### TC-14.12: Free Company (No Pricing)

| Step | Action                                           | Expected                                               |
| ---- | ------------------------------------------------ | ------------------------------------------------------ |
| 1    | Set company pricing to `0` or leave as "Not set" | Price is free                                          |
| 2    | Send test invoices                               | Invoices arrive                                        |
| 3    | Check Inbox                                      | Documents NOT locked (free, auto-billed with 0 charge) |
| 4    | Check Transaction History                        | No charge transactions for these documents             |

### TC-14.13: Transaction History Filters

| Step | Action                                   | Expected                            |
| ---- | ---------------------------------------- | ----------------------------------- |
| 1    | Navigate to Wallet → Transaction History | All transactions shown              |
| 2    | Filter by Type: "Charge"                 | Only charge transactions shown      |
| 3    | Filter by Type: "Top Up"                 | Only top-up transactions shown      |
| 4    | Filter by Company (if multi-company)     | Only that company's charges shown   |
| 5    | Set Date From and Date To                | Transactions filtered by date range |
| 6    | Clear all filters                        | All transactions shown again        |

### TC-14.14: Export Statement (CSV)

| Step | Action                                   | Expected                                                                     |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 1    | On Wallet page, click "Export Statement" | Export dialog with filter options                                            |
| 2    | Optionally select company and date range | Filters applied                                                              |
| 3    | Click "Export"                           | CSV file downloaded                                                          |
| 4    | Open CSV                                 | Columns: Date, Type, Description, Company, Amount (EUR), Balance After (EUR) |
| 5    | Scroll to bottom of CSV                  | Summary: total charges, total top-ups, total adjustments                     |

### TC-14.15: Shared Wallet (Non-Genesis User)

| Step | Action                               | Expected                                               |
| ---- | ------------------------------------ | ------------------------------------------------------ |
| 1    | Sign in as non-genesis company admin | Dashboard                                              |
| 2    | Navigate to Wallet                   | Wallet page shows balance and transactions             |
| 3    | Observe                              | Badge: "Shared wallet (managed by your company admin)" |
| 4    | Top Up button                        | Still available (can top up shared wallet)             |

### TC-14.16: Multi-Company Shared Wallet

| Step | Action                                                                       | Expected                                   |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| 1    | Genesis admin has 2 companies, Company A (0.04/doc) and Company B (0.10/doc) | Both share one wallet                      |
| 2    | Receive documents in both companies                                          | Charges from both companies in same wallet |
| 3    | Check Wallet → "Companies" stat                                              | Shows "2 companies"                        |
| 4    | Filter Transaction History by company                                        | Shows only that company's charges          |

### TC-14.17: Public Payment Page

| Step | Action                                       | Expected                                                     |
| ---- | -------------------------------------------- | ------------------------------------------------------------ |
| 1    | Generate a payment link from Top Up dialog   | Payment link created                                         |
| 2    | Copy the public payment URL (`/pay/[token]`) | URL available                                                |
| 3    | Open in incognito browser (no login)         | Payment page with QR code, no auth required                  |
| 4    | Complete payment                             | Green checkmark: "Payment Received! X EUR has been credited" |
| 5    | Check wallet (logged in)                     | Balance increased                                            |

### TC-14.18: Super Admin Wallet Overview

| Step | Action                                              | Expected                                                                |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | Sign in as super admin                              | Dashboard                                                               |
| 2    | Navigate to Wallet                                  | Message directing to company pages (super admin has no personal wallet) |
| 3    | Navigate to Companies → click company → wallet link | Wallet detail page for that company's genesis admin                     |
| 4    | Can view balance, transactions, adjust balance      | Full access                                                             |

---

## Group 15: Edge Cases & Error Handling

### TC-15.1: Duplicate PFS Webhook (Same DIC)

| Step | Action                                     | Expected                                                  |
| ---- | ------------------------------------------ | --------------------------------------------------------- |
| 1    | Trigger PFS webhook again for the same DIC | Webhook returns 200 (company already exists)              |
| 2    | Check Companies list                       | No duplicate company created                              |
| 3    | Check invitation                           | New genesis invitation sent if not already genesis member |

### TC-15.2: Expired Invitation

| Step | Action                                                                                                                              | Expected                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1    | Create an invitation                                                                                                                | Invitation created                 |
| 2    | In Supabase, manually set `expires_at` to past: `update invitations set expires_at = now() - interval '1 hour' where email = '...'` | Updated                            |
| 3    | Click the invitation link                                                                                                           | "Invitation Expired" message shown |

### TC-15.3: Wrong Email for Invitation

| Step | Action                                                      | Expected                                                        |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Open invitation link while signed in with a different email | "This invitation was sent to a different email address" message |

### TC-15.4: Peppol Activation Failure

| Step | Action                                                        | Expected                                    |
| ---- | ------------------------------------------------------------- | ------------------------------------------- |
| 1    | Temporarily set `ION_AP_API_TOKEN` to invalid value in Vercel | Token invalid                               |
| 2    | Try to activate a company (manual or via genesis accept)      | Error message displayed                     |
| 3    | Check company detail                                          | Peppol status: "Error", error message shown |
| 4    | Restore correct token                                         | Token valid                                 |
| 5    | Click "Activate on Peppol" (manual fallback)                  | Activation succeeds                         |

### TC-15.5: Permission Enforcement

| Step | Action                                                | Expected                                                               |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | As processor, try to access `/dashboard/users`        | Redirected (no access)                                                 |
| 2    | As company admin, try to deactivate the genesis admin | Error: "Genesis admin can only be deactivated by a super admin"        |
| 3    | As non-genesis admin, try to deactivate another admin | Error: "Only genesis admin or super admin can deactivate other admins" |

### TC-15.6: Concurrent Sessions

| Step | Action                              | Expected        |
| ---- | ----------------------------------- | --------------- |
| 1    | Sign in as super admin in Chrome    | Dashboard       |
| 2    | Sign in as company admin in Firefox | Dashboard       |
| 3    | Both sessions work independently    | No interference |

### TC-15.7: Test Invoices Without Token

| Step | Action                                    | Expected                                        |
| ---- | ----------------------------------------- | ----------------------------------------------- |
| 1    | Remove `ION_AP_TEST_SENDER_TOKEN` env var | Env var missing                                 |
| 2    | Click "Send test invoices" on dashboard   | Error: "Test invoice sending is not configured" |

### TC-15.8: Billing Edge — Negative Adjustment Blocked

| Step | Action                                                   | Expected                          |
| ---- | -------------------------------------------------------- | --------------------------------- |
| 1    | As super admin, try to adjust wallet balance to negative | Error returned, balance unchanged |

### TC-15.9: Payment Link Expiry

| Step | Action                                                            | Expected                                       |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Generate a payment link                                           | Payment link created                           |
| 2    | In Supabase, manually set `expires_at` to past on `payment_links` | Updated                                        |
| 3    | Open the public payment URL                                       | "Expired" badge, message to request a new link |

---

## Group 16: Operations Center

### TC-16.1: Operations Center Access

| Step | Action                           | Expected                                                                                 |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | Sign in as super admin           | "Operations" visible in sidebar                                                          |
| 2    | Navigate to Operations           | Operations Center page with 5 tabs: Companies, Documents, Payments, Billing, Invitations |
| 3    | Observe issue count badge        | Shows total number of issues (or "All clear" if none)                                    |
| 4    | Sign in as company admin         | "Operations" visible in sidebar                                                          |
| 5    | Navigate to Operations           | Only own company's issues visible                                                        |
| 6    | Sign in as operator or processor | "Operations" NOT visible in sidebar                                                      |

### TC-16.2: Retry Failed Activation

| Step | Action                                      | Expected                              |
| ---- | ------------------------------------------- | ------------------------------------- |
| 1    | Have a company with ion_ap_status = "error" | Company shows in Companies tab        |
| 2    | Observe error message                       | Error detail visible in table         |
| 3    | Click "Retry"                               | Loading spinner, then page refreshes  |
| 4    | If ion-AP is now available                  | Company status changes to "active"    |
| 5    | Check Audit Log                             | `OPS_ACTIVATION_RETRIED` event logged |

### TC-16.3: Retry Failed Documents

| Step | Action                              | Expected                                                      |
| ---- | ----------------------------------- | ------------------------------------------------------------- |
| 1    | Have documents with status "failed" | Documents show in Documents tab                               |
| 2    | Observe retry count and last error  | Columns show "5/10" retries and error text                    |
| 3    | Click "Retry" on a single document  | Document reprocessed (retry count reset)                      |
| 4    | Click "Retry All Failed" button     | All failed documents reprocessed                              |
| 5    | Check Audit Log                     | `OPS_DOCUMENT_RETRIED` or `OPS_DOCUMENTS_BULK_RETRIED` events |

### TC-16.4: Force Document Status (Super Admin)

| Step | Action                                                  | Expected                                               |
| ---- | ------------------------------------------------------- | ------------------------------------------------------ |
| 1    | As super admin, find a failed document in Documents tab | "Force New" button visible                             |
| 2    | Click "Force New"                                       | Document status set to "new", bypassing processing     |
| 3    | Check Audit Log                                         | `OPS_DOCUMENT_STATUS_FORCED` event with from/to status |
| 4    | As company admin                                        | "Force New" button NOT visible (super admin only)      |

### TC-16.5: Force Check Payment

| Step | Action                              | Expected                                     |
| ---- | ----------------------------------- | -------------------------------------------- |
| 1    | Have a pending payment link         | Shows in Payments tab                        |
| 2    | Click "Check Now"                   | Forces KVERKOM API check                     |
| 3    | If payment was completed externally | Status changes to completed, wallet credited |
| 4    | Check Audit Log                     | `OPS_PAYMENT_FORCE_CHECKED` event            |

### TC-16.6: Manually Complete Payment (Super Admin)

| Step | Action                                                 | Expected                                                          |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 1    | As super admin, find a pending payment in Payments tab | "Mark Completed" button visible (red)                             |
| 2    | Click "Mark Completed"                                 | Payment marked completed, wallet credited, auto-billing triggered |
| 3    | Check Audit Log                                        | `OPS_PAYMENT_MANUALLY_COMPLETED` event with amount                |
| 4    | As company admin                                       | "Mark Completed" button NOT visible                               |

### TC-16.7: Billing Overview & Retry

| Step | Action                                                          | Expected                                                           |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Have unbilled documents                                         | Billing tab shows companies with unbilled count                    |
| 2    | Observe columns                                                 | Company, Unbilled count, Price/doc, Total Cost, Balance, Can Bill? |
| 3    | Company with sufficient balance shows "Yes" + "Bill Now" button | Button visible                                                     |
| 4    | Company with insufficient balance shows "Insufficient" badge    | No Bill Now button                                                 |
| 5    | Click "Bill Now"                                                | Documents billed, page refreshes                                   |
| 6    | Check Audit Log                                                 | `OPS_AUTOBILL_RETRIED` event                                       |

### TC-16.8: Extend Invitation Expiry

| Step | Action                                 | Expected                                      |
| ---- | -------------------------------------- | --------------------------------------------- |
| 1    | Have an expired invitation             | Shows in Invitations tab with "Expired" badge |
| 2    | Click "Extend 48h"                     | Expiry reset to 48h from now                  |
| 3    | Check Audit Log                        | `OPS_INVITATION_EXTENDED` event               |
| 4    | Click "Resend" on a pending invitation | Invitation email resent                       |

### TC-16.9: Auto-Heal Cron Verification

| Step | Action                                                                      | Expected                                                      |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Have a company with ion_ap_status = "error" and an active company status    | Cron should pick it up                                        |
| 2    | Wait for cron cycle (5 minutes) or manually trigger `/api/cron/maintenance` | Cron runs                                                     |
| 3    | Check company status                                                        | If ion-AP is available, status auto-healed to "active"        |
| 4    | Have wallets with positive balance and unbilled documents                   | Cron should auto-bill                                         |
| 5    | Check Audit Log                                                             | `CRON_ACTIVATIONS_HEALED` and/or `CRON_BILLING_HEALED` events |

---

## Group 17: Responsive Design

### TC-17.1: Mobile Layout

| Step | Action                                        | Expected                                                          |
| ---- | --------------------------------------------- | ----------------------------------------------------------------- |
| 1    | Open app on mobile device or resize to <768px | Bottom tab bar visible, sidebar hidden                            |
| 2    | Navigate using bottom tabs                    | All pages accessible                                              |
| 3    | Open company switcher                         | Compact dropdown works                                            |
| 4    | Open user avatar menu                         | Dropdown works, "Sign out" accessible                             |
| 5    | Open Inbox                                    | Table readable, some columns hidden on mobile, checkboxes visible |
| 6    | Open document detail                          | Cards stack vertically                                            |

### TC-17.2: Desktop Layout

| Step | Action                       | Expected                           |
| ---- | ---------------------------- | ---------------------------------- |
| 1    | Open app on desktop (>768px) | Sidebar visible, no bottom tab bar |
| 2    | Toggle sidebar               | Collapses/expands smoothly         |
| 3    | All tables show full columns | Amount, Date visible on desktop    |

---

## Group 18: User Detail Drawer & Direct Assignment

### TC-18.1: Open User Detail Drawer

| Step | Action                                  | Expected                                                              |
| ---- | --------------------------------------- | --------------------------------------------------------------------- |
| 1    | Navigate to Users → Team tab            | User cards listed                                                     |
| 2    | Click on a user card                    | Slide-out drawer opens from the right                                 |
| 3    | Observe drawer header                   | User name, email, Super Admin badge (if applicable)                   |
| 4    | Observe company assignments list        | Each company shown with role badge and Genesis badge where applicable |
| 5    | Close drawer (click outside or X)       | Drawer closes                                                         |

### TC-18.2: Edit Member Role via Drawer

| Step | Action                                              | Expected                                      |
| ---- | --------------------------------------------------- | --------------------------------------------- |
| 1    | Open user detail drawer for a non-current user      | Drawer opens with company assignments          |
| 2    | Hover over a membership row                         | Pencil (edit) and X (remove) icons appear     |
| 3    | Click pencil icon                                   | Role selector appears with radio-style buttons |
| 4    | Click a different role (e.g., switch to Operator)   | Role button highlighted                        |
| 5    | Click "Save"                                        | Toast: "Role updated for [company]"            |
| 6    | Observe membership row                              | Role badge updated to new role                 |

### TC-18.3: Remove Member via Drawer

| Step | Action                                        | Expected                                      |
| ---- | --------------------------------------------- | --------------------------------------------- |
| 1    | Open user detail drawer                       | Drawer with company assignments               |
| 2    | Hover over a non-genesis membership row       | X (remove) button visible                     |
| 3    | Click X                                       | Toast: "Removed from [company]"               |
| 4    | Membership disappears from drawer             | Assignment removed                            |
| 5    | Hover over genesis membership row             | No X button visible (protected)               |

### TC-18.4: Direct Assignment to Company

| Step | Action                                                 | Expected                                                |
| ---- | ------------------------------------------------------ | ------------------------------------------------------- |
| 1    | Open user detail drawer for a user NOT in all companies | "Assign to Company" button visible at bottom            |
| 2    | Click "Assign to Company"                              | Searchable company list appears                         |
| 3    | Type company name in search                            | List filters as you type                                |
| 4    | Click a company                                        | Company selected, role picker appears                   |
| 5    | Select role (radio buttons: Admin, Operator, Processor) | Role highlighted                                       |
| 6    | Click "Assign"                                         | Toast: "User assigned to [company]", drawer closes      |
| 7    | Reopen drawer                                          | New company assignment visible in list                  |

### TC-18.5: Direct Assignment — Permission Checks

| Step | Action                                                           | Expected                                                         |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | As non-genesis company admin, try to assign company_admin role   | Error: "Only genesis admin or super admin can assign..."         |
| 2    | As company admin, only companies you admin appear in the list    | Other companies not shown                                        |
| 3    | Try to assign a user who is already in the company               | Error: "User is already a member of this company"                |

---

## Group 19: Company Switcher & Context-Aware Roles

### TC-19.1: Company Switcher Shows Roles

| Step | Action                                          | Expected                                                    |
| ---- | ----------------------------------------------- | ----------------------------------------------------------- |
| 1    | Sign in as user with multiple company memberships | Company switcher visible in top bar                        |
| 2    | Click company switcher dropdown                 | Each company shows name + colored role badge                |
| 3    | Observe role colors                             | Blue = Admin, Purple = Operator, Orange = Processor         |

### TC-19.2: Role Changes on Company Selection

| Step | Action                                                      | Expected                                                 |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------- |
| 1    | User is admin in Company A, processor in Company B          | Default: highest role (admin), full sidebar nav          |
| 2    | Select Company B from switcher                              | Role badge changes to "Processor", sidebar reduces       |
| 3    | Observe sidebar                                             | Only Inbox and Companies visible                         |
| 4    | Select "All Companies"                                      | Role reverts to admin, full sidebar nav                  |

### TC-19.3: Role Badge in Top Bar

| Step | Action                     | Expected                                                     |
| ---- | -------------------------- | ------------------------------------------------------------ |
| 1    | Observe top bar (desktop)  | Colored role badge visible between company switcher and theme toggle |
| 2    | Select different company   | Role badge updates to match role in selected company         |
| 3    | On mobile                  | Role badge hidden (max-md:hidden)                            |

### TC-19.4: User Avatar Shows Role

| Step | Action                       | Expected                                           |
| ---- | ---------------------------- | -------------------------------------------------- |
| 1    | Click user avatar (top right) | Dropdown shows name, email, and colored role badge |
| 2    | Select different company      | Role badge in dropdown updates                     |

---

## Execution Checklist

| Group                                         | Tests               | Status |
| --------------------------------------------- | ------------------- | ------ |
| 1. Landing Page & Initial Setup               | TC-1.1 to TC-1.7    | [ ]    |
| 2. Company Onboarding via PFS                 | TC-2.1 to TC-2.3    | [ ]    |
| 3. Genesis Admin Onboarding & Auto Activation | TC-3.1 to TC-3.4    | [ ]    |
| 4. Peppol Activation (Manual Fallback)        | TC-4.1 to TC-4.2    | [ ]    |
| 5. User Management & Invitations              | TC-5.1 to TC-5.9    | [ ]    |
| 6. OTP Sign-In Flow                           | TC-6.1 to TC-6.4    | [ ]    |
| 7. Test Invoices                              | TC-7.1 to TC-7.3    | [ ]    |
| 8. Inbox & Document Viewing                   | TC-8.1 to TC-8.8    | [ ]    |
| 9. Mass Download & Export                      | TC-9.1 to TC-9.9    | [ ]    |
| 10. Audit Log                                 | TC-10.1 to TC-10.4  | [ ]    |
| 11. Company Deactivation                      | TC-11.1 to TC-11.3  | [ ]    |
| 12. Company Reactivation                      | TC-12.1 to TC-12.2  | [ ]    |
| 13. Departments                               | TC-13.1 to TC-13.6  | [ ]    |
| 14. Wallet & Prepaid Billing                  | TC-14.1 to TC-14.18 | [ ]    |
| 15. Edge Cases & Error Handling               | TC-15.1 to TC-15.9  | [ ]    |
| 16. Operations Center                         | TC-16.1 to TC-16.9  | [ ]    |
| 17. Responsive Design                         | TC-17.1 to TC-17.2  | [ ]    |
| 18. User Detail Drawer & Direct Assignment    | TC-18.1 to TC-18.5  | [ ]    |
| 19. Company Switcher & Context-Aware Roles    | TC-19.1 to TC-19.4  | [ ]    |
| **Total**                                     | **119 test cases**  |        |
