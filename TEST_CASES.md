# peppolbox.sk — Manual Test Cases

## Test Environment

| Role | Email |
|---|---|
| Super Admin | stanislav.pavlovic@fiinancnasprava.sk |
| Company Admin (Genesis) | efabox.sk@gmail.com |
| Accountant | apartmentvir1@gmail.com |

**Prerequisites:**
- Fresh schema.sql executed in Supabase SQL Editor
- All env vars set in Vercel (Supabase, Resend, Twilio, ion-AP, ION_AP_TEST_SENDER_TOKEN)
- ion-AP test environment token configured
- PFS activation link set in System Settings

---

## Group 1: Landing Page & Initial Setup

### TC-1.1: Landing Page

| Step | Action | Expected |
|---|---|---|
| 1 | Open the app URL | Landing page with animated peppolbox.sk logo (typewriter cycles between mailbox.sk and peppolbox.sk) |
| 2 | Observe tagline | "Your electronic invoice mailbox on the Peppol network" |
| 3 | Observe "Sign In" button | Button present |
| 4 | Observe "Register at your Digital Postman" button | Button present, links to PFS activation link from system settings |
| 5 | Observe text under Register button | "You will be redirected to the Tax Administration office portal" |
| 6 | Observe footer | Demo disclaimer, "Ask support at peppol(at)financnasprava.sk", GitHub link with icon |
| 7 | Observe bottom bar | Slovak flag accent (white, blue, red stripes) |
| 8 | Toggle dark mode (if accessible) | Logo .sk text switches from black to white, colors remain correct |

### TC-1.2: First Sign-In (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Sign In" | Modal opens: "Sign in to peppolbox.sk" with Google, Apple, and email options |
| 2 | Click "Continue with Google" | Google OAuth flow starts |
| 3 | Select stanislav.pavlovic@fiinancnasprava.sk | Redirected back to app |
| 4 | Observe | Redirected to `/dashboard`, profile created |
| 5 | Run in Supabase SQL Editor: `update profiles set is_super_admin = true where id = (select id from auth.users limit 1);` | Success |
| 6 | Refresh the page | Super Admin dashboard with stats cards, recent webhooks, recent invitations, and "Send Onboarding Request" card |

### TC-1.3: Configure System Settings

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Settings (sidebar) | Settings page with Profile and System Settings |
| 2 | Observe "PFS Activation Link" field | Visible (super admin only) |
| 3 | Enter: `https://kejwajsi.vercel.app/client?actlinkid=3047` | Field populated |
| 4 | Click "Save" | "Saved" message appears |
| 5 | Refresh page | Link is persisted |
| 6 | Open app landing page in incognito | "Register at your Digital Postman" button links to the configured URL |

### TC-1.4: Update Profile

| Step | Action | Expected |
|---|---|---|
| 1 | On Settings page, fill "Full Name": `Stanislav Pavlovic` | Field populated |
| 2 | Fill "Phone": `+421900000000` | Field populated |
| 3 | Click "Save Changes" | "Profile updated" message |
| 4 | Refresh page | Name and phone persisted |
| 5 | Check avatar dropdown (top right) | Shows name "Stanislav Pavlovic" |

### TC-1.5: Dark Mode Toggle

| Step | Action | Expected |
|---|---|---|
| 1 | Click the sun/moon icon in the top bar | Theme switches to dark mode |
| 2 | Click again | Theme switches back to light mode |
| 3 | Refresh page | Theme preference persisted |

### TC-1.6: Sidebar Navigation (Desktop)

| Step | Action | Expected |
|---|---|---|
| 1 | Observe sidebar | Shows: Dashboard, Inbox, Companies, Users, Webhooks, Audit Log, Settings. Brand text: "peppolbox.sk" |
| 2 | Click each item | Navigates to correct page, active item highlighted |
| 3 | Click sidebar toggle (hamburger) | Sidebar collapses/expands |

### TC-1.7: Bottom Tab Bar (Mobile)

| Step | Action | Expected |
|---|---|---|
| 1 | Resize browser to mobile width (<768px) | Sidebar hidden, bottom tab bar appears. Brand text: "peppolbox.sk" |
| 2 | Observe tab bar items | Shows nav items as icons with labels |
| 3 | Tap each tab | Navigates to correct page, active tab highlighted |

---

## Group 2: Company Onboarding via PFS Webhook

### TC-2.1: Trigger PFS Webhook (New Company)

| Step | Action | Expected |
|---|---|---|
| 1 | Go to PFS test environment and trigger a webhook for a test company (DIC: use a real test DIC) | Webhook sent to peppolbox.sk |
| 2 | In peppolbox.sk, navigate to Dashboard | "Webhooks" stat incremented |
| 3 | Check "Recent Webhooks" table | New entry with DIC, company name, email |
| 4 | Navigate to Companies page | New company listed with Peppol status "Not registered" |
| 5 | Click company name | Company detail page with DIC, email, phone, members |

### TC-2.2: Verify Genesis Admin Invitation Sent

| Step | Action | Expected |
|---|---|---|
| 1 | Check "Recent Invitations" on Dashboard | New invitation for efabox.sk@gmail.com, role: company_admin, status: Pending |
| 2 | Check efabox.sk@gmail.com inbox | Email: "You've been invited to peppolbox.sk as Company Admin" with "Accept Invitation" button |
| 3 | Navigate to Users page | Invitation visible in Invitations table |

### TC-2.3: Send Manual Onboarding Request (New Customer)

| Step | Action | Expected |
|---|---|---|
| 1 | On Super Admin Dashboard, find "Send Onboarding Request" card | Card visible |
| 2 | Enter email: `test@example.com`, company name: `Test Manual Co` | Fields populated |
| 3 | Click "Send Onboarding Link" | "Onboarding request sent" message |
| 4 | Check recipient inbox | Email: "Get started with peppolbox.sk — Register your company" |
| 5 | Check Audit Log page | `ONBOARDING_REQUEST_SENT` event logged |

---

## Group 3: Genesis Admin Onboarding & Auto Peppol Activation

### TC-3.1: Accept Invitation — Auto Peppol Activation

| Step | Action | Expected |
|---|---|---|
| 1 | Open the invitation email in efabox.sk@gmail.com | Email with "Accept Invitation" button |
| 2 | Click "Accept Invitation" | Redirected to `/activate` page (NOT welcome screen) |
| 3 | Observe activation page | Spinner with "Activating [Company Name] on Peppol", message about registering on Peppol network |
| 4 | Wait for activation to complete | Green checkmark, "Your company is now active on Peppol!", Peppol ID shown (0245:DIC) |
| 5 | Observe notification message | "You will receive email notifications when new invoices arrive in your inbox." |
| 6 | Click "Go to Dashboard" | Company Admin dashboard with company card (NO welcome screen) |
| 7 | Check company card | Shows company name, DIC, Peppol status "Active" |

### TC-3.2: Verify Auto Activation Effects

| Step | Action | Expected |
|---|---|---|
| 1 | Check Audit Log (as super admin) | `PEPPOL_COMPANY_ACTIVATED` and `USER_ONBOARDED` events logged |
| 2 | Navigate to Companies → click company | Peppol status: "Active", Peppol ID, activation date, ion-AP Org ID shown |
| 3 | Check ion-AP test environment | Organization exists, identifier `0245:<DIC>` published, receive trigger configured |

### TC-3.3: Activation Failure Handling

| Step | Action | Expected |
|---|---|---|
| 1 | Temporarily break ion-AP token, trigger a new genesis invite + accept | `/activate` page shows error state |
| 2 | Observe error page | Red X icon, "Activation failed", error message, "Don't worry — your account is ready. A peppolbox.sk administrator can retry the activation for you." |
| 3 | Click "Go to Dashboard" | Dashboard loads (account works despite activation failure) |
| 4 | Restore token, super admin manually activates via company detail page | Activation succeeds (fallback works) |

### TC-3.4: Verify Genesis Admin Membership

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Companies page | Company listed |
| 2 | Click company | Company detail page |
| 3 | Check Members table | efabox.sk@gmail.com listed as "company admin" with "Genesis" badge, status "Active" |

---

## Group 4: Peppol Activation (Manual Fallback)

### TC-4.1: Manual Activate Company on Peppol (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin | Super Admin dashboard |
| 2 | Navigate to Companies → click a company with status "Not registered" or "Error" | Company detail page |
| 3 | Observe "Peppol Network" card | Shows "Activate on Peppol" button |
| 4 | Click "Activate on Peppol" | Confirmation dialog |
| 5 | Confirm | Loading spinner, then page refreshes |
| 6 | Observe company detail | Peppol status: "Active", Peppol ID shown, activation date shown, ion-AP Org ID shown |
| 7 | Check Audit Log | `PEPPOL_COMPANY_ACTIVATED` event |

### TC-4.2: Verify ion-AP Registration

| Step | Action | Expected |
|---|---|---|
| 1 | Open ion-AP test environment UI or API | Organization exists with correct name and DIC |
| 2 | Check identifiers | `0245:<DIC>` identifier, verified: true, publish_receive_peppolbis: true |
| 3 | Check receive triggers | API_CALL trigger configured pointing to peppolbox.sk webhook URL |

---

## Group 5: User Management & Invitations

### TC-5.1: Invite Company Admin (by Genesis Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as efabox.sk@gmail.com (genesis admin) | Company Admin dashboard |
| 2 | Navigate to Users page | Users table and Invitations table visible, "Invite User" button visible |
| 3 | Click "Invite User" | Dialog opens with email, role, and company checkboxes |
| 4 | Enter email: `newadmin@test.com`, role: Company Admin, check the company | Form filled |
| 5 | Click "Send Invitation" | Dialog closes, invitation appears in table |
| 6 | Check Audit Log | `INVITE_CREATED` event |

### TC-5.2: Invite Accountant (by Genesis Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | On Users page, click "Invite User" | Dialog opens |
| 2 | Enter email: `apartmentvir1@gmail.com`, role: Accountant, check the company | Form filled |
| 3 | Click "Send Invitation" | Dialog closes, invitation appears |
| 4 | Check apartmentvir1@gmail.com inbox | Invitation email: "You've been invited to peppolbox.sk as Accountant" with magic link |

### TC-5.3: Accountant Accepts Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Open invitation email in apartmentvir1@gmail.com | Email with "Accept Invitation" button |
| 2 | Click "Accept Invitation" | Redirected to peppolbox.sk, signed in |
| 3 | Observe Welcome screen | "Welcome to peppolbox.sk!", role badge: "Accountant", company name shown |
| 4 | Click "Go to Dashboard" | Accountant dashboard with company card |
| 5 | Observe sidebar | No "Users" or "Webhooks" items (accountant limited nav) |

### TC-5.4: Accountant Access Restrictions

| Step | Action | Expected |
|---|---|---|
| 1 | As accountant, navigate to Companies | Company listed (read-only) |
| 2 | Click company | Company detail visible, no "Activate on Peppol" button, no "Deactivate" button |
| 3 | Navigate to Inbox | Empty inbox (no documents yet) |
| 4 | Navigate to Audit Log | Only own audit events visible |
| 5 | Try to access `/dashboard/users` directly | Redirected away (accountant can't see Users page) |

### TC-5.5: Deactivate a Member (by Genesis Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as efabox.sk@gmail.com | Company Admin dashboard |
| 2 | Navigate to Companies → click company → Members table | Accountant listed |
| 3 | Click "Deactivate" next to accountant | Confirmation dialog |
| 4 | Confirm | Accountant status changes to "Inactive" |
| 5 | Sign in as apartmentvir1@gmail.com | Dashboard shows no companies (membership deactivated) |
| 6 | Check Audit Log (as super admin) | `MEMBERSHIP_DEACTIVATED` event |

---

## Group 6: OTP Sign-In Flow

### TC-6.1: Sign Up with Email OTP

| Step | Action | Expected |
|---|---|---|
| 1 | Sign out | Redirected to landing page |
| 2 | Click "Sign In" → enter a new test email | Modal shows email field |
| 3 | Click "Continue with Email" | Choose verification channel screen |
| 4 | Click "Send code to [email]" | Code input screen appears, "Code sent to..." message |
| 5 | Check email | 6-digit code received, subject: "[code] is your peppolbox.sk verification code" |
| 6 | Enter code digits one by one | Each input auto-advances |
| 7 | On 6th digit | Auto-submits, signed in, redirected to dashboard |

### TC-6.2: Sign Up with SMS OTP

| Step | Action | Expected |
|---|---|---|
| 1 | Sign out, click "Sign In" → enter email | Choose verification channel |
| 2 | Enter phone number: `+421 9XX XXX XXX` | Phone field populated |
| 3 | Click "Send code via SMS" | Code input screen appears |
| 4 | Check phone | SMS with 6-digit code received |
| 5 | Enter code | Auto-submits on 6th digit, signed in |

### TC-6.3: Sign In (Returning User via OTP)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign out and sign in with the same email | Choose verification channel |
| 2 | Observe phone option | Shows masked phone `****XXXX` (registered phone from signup) |
| 3 | Send code via email | Code received, enter it, signed in |

### TC-6.4: Wrong Code

| Step | Action | Expected |
|---|---|---|
| 1 | Request a code | Code input screen |
| 2 | Enter `000000` (wrong code) | Error message: "Invalid or expired code" |
| 3 | Click "Resend code" | New code sent, message: "New code sent!" |
| 4 | Enter correct code | Signed in |

---

## Group 7: Test Invoices

### TC-7.1: Send Test Invoices

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as company admin (genesis) with a Peppol-active company | Company Admin dashboard |
| 2 | Observe company card | "Send test invoices" button visible (only on Peppol-active companies) |
| 3 | Click "Send test invoices" | Confirmation dialog: "This will send 3 real Peppol invoices to [Company Name]" |
| 4 | Confirm | Loading spinner, then "3 test invoices sent!" message |
| 5 | Wait 10-30 seconds for ion-AP to deliver | Invoices arrive via Peppol receive webhook |
| 6 | Navigate to Inbox | 3 new unread documents from "Maliar Palo s.r.o." |

### TC-7.2: Verify Test Invoice Content

| Step | Action | Expected |
|---|---|---|
| 1 | Click first test invoice | Document detail with correct metadata |
| 2 | Observe sender | "Maliar Palo s.r.o." (9950:6878787887) |
| 3 | Observe line items in From column | Slovak item names with correct diacritics (no &#XXX; entities) |
| 4 | Verify amounts | Mix of 23% and 10% VAT rates, totals calculated correctly |
| 5 | Check all 3 invoices | Different content: office supplies (~€47), IT equipment (~€82), consulting (~€1,250) |

### TC-7.3: Verify Email Notification

| Step | Action | Expected |
|---|---|---|
| 1 | Check company email inbox (company_email field) | 3 notification emails received |
| 2 | Observe email content | Subject: "New Invoice received from Maliar Palo s.r.o.", amount, due date, up to 3 line items, "View Invoice" button |
| 3 | Click "View Invoice" button in email | Opens document detail page in browser |

---

## Group 8: Inbox & Document Viewing

### TC-8.1: Inbox List View

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Inbox | Documents listed with columns: checkbox, status icon, From, Amount, Date |
| 2 | Observe unread documents | Bold text, filled mail icon, subtle background highlight |
| 3 | Observe read documents | Normal text, open mail icon |
| 4 | Observe no "Document ID" column | Column removed from list view |

### TC-8.2: Click Row to Open Detail

| Step | Action | Expected |
|---|---|---|
| 1 | Click anywhere on a document row | Navigates to document detail page |
| 2 | Observe cursor | Pointer cursor on hover, row highlights on hover |
| 3 | Go back to Inbox | Document now marked as read |

### TC-8.3: PDF Hover Button

| Step | Action | Expected |
|---|---|---|
| 1 | Hover over a document row | Small PDF icon (FileText) appears on the right side |
| 2 | Move mouse away | Icon disappears |
| 3 | Click the PDF icon | New tab opens with PDF rendering of the invoice |
| 4 | Observe | Clicking PDF icon does NOT also navigate to detail page |

### TC-8.4: View Document Detail

| Step | Action | Expected |
|---|---|---|
| 1 | Click on a document row | Document detail page |
| 2 | Observe status | Auto-marked as "read", badge shows "read" |
| 3 | Observe metadata cards | Sender, Receiver, Company, Received date |
| 4 | Observe NO XML viewer | XML viewer card is not present |
| 5 | Observe Transaction Details card | Transaction UUID, ion-AP Transaction ID, Document Type, Direction |

### TC-8.5: Mark Document as Unread

| Step | Action | Expected |
|---|---|---|
| 1 | On document detail, click the "..." menu (top right) | Dropdown opens |
| 2 | Click "Mark as unread" | Page refreshes, status badge shows "new" |
| 3 | Go back to Inbox | Document shows as unread again |

### TC-8.6: Download PDF from Detail

| Step | Action | Expected |
|---|---|---|
| 1 | On document detail, click "..." → "Download PDF" | New tab opens |
| 2 | Observe | PDF rendering of the invoice displayed |

### TC-8.7: Company Switcher Filtering

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin with multiple companies, go to Inbox | All documents shown |
| 2 | Use company switcher (top bar) to select a specific company | Inbox filters to only that company's documents |
| 3 | Select "All Companies" | All documents shown again |

---

## Group 9: Mass Download

### TC-9.1: Select Documents with Checkboxes

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Inbox (any role) | Checkboxes visible on every row |
| 2 | Click checkbox on a row | Row highlighted, selection toolbar appears |
| 3 | Click "Select All" checkbox in header | All documents selected |
| 4 | Click "Clear" in toolbar | All deselected, toolbar disappears |

### TC-9.2: Download Individual Files (1-4 selected)

| Step | Action | Expected |
|---|---|---|
| 1 | Select 2 documents | Toolbar shows: "2 selected", Download button |
| 2 | Click "Download" → "Download XML" | 2 XML files downloaded individually with ~300ms delay |
| 3 | Select 2 documents, click "Download" → "Download PDF" | 2 PDF files downloaded individually |
| 4 | Select 2 documents, click "Download" → "Download Both" | 4 files downloaded (2 XML + 2 PDF) |
| 5 | Check filenames | Named by document ID (e.g., `TEST-001.xml`, `TEST-001.pdf`) |

### TC-9.3: Download as ZIP (5+ selected)

| Step | Action | Expected |
|---|---|---|
| 1 | Select 5 or more documents | Toolbar with Download button |
| 2 | Click "Download" → "Download XML" | Progress shown: "Downloading 3/5..." |
| 3 | Wait for completion | Single ZIP file downloaded: `invoices-YYYY-MM-DD.zip` |
| 4 | Open ZIP | Contains all XML files named by document ID |
| 5 | Repeat with "Download PDF" | ZIP with PDF files |
| 6 | Repeat with "Download Both" | ZIP with both XML and PDF files |

### TC-9.4: Toolbar Layout for Triage Users

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as user with triage permission (company admin) | Inbox with Department column |
| 2 | Select documents | Toolbar shows: "N selected" → "Assign to" dropdown → vertical divider → "Download" dropdown → "Clear" |
| 3 | Observe visual separation | Clear `|` divider between Assign and Download groups |
| 4 | Click "Assign to" | Department dropdown (does NOT download) |
| 5 | Click "Download" | File type dropdown (does NOT assign) |

---

## Group 10: Audit Log

### TC-10.1: View Audit Logs (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Audit Log | Table with all events |
| 2 | Observe columns | Time, Event (name + ID), Severity, Actor, Company DIC, Source IP |
| 3 | Verify events from previous tests | AUTH_SIGN_IN, INVITE_CREATED, INVITE_ACCEPTED, PEPPOL_COMPANY_ACTIVATED, USER_ONBOARDED, TEST_INVOICES_SENT, PEPPOL_DOCUMENT_RECEIVED, etc. |
| 4 | Check severity badges | info (blue), warning (yellow), error (red) |

### TC-10.2: Audit Log Filtering by Company

| Step | Action | Expected |
|---|---|---|
| 1 | Use company switcher to select a company | Audit log filters to company-related events only |
| 2 | Select "All Companies" | All events shown again |

### TC-10.3: Audit Log Visibility (Company Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as company admin (efabox.sk@gmail.com) | Dashboard |
| 2 | Navigate to Audit Log | Only events for own companies + own actions visible |
| 3 | Verify super-admin-only events are NOT visible | No other company's events shown |

### TC-10.4: Audit Log Visibility (Accountant)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as accountant (if still active) | Dashboard |
| 2 | Navigate to Audit Log | Only own actions + assigned company events |

---

## Group 11: Company Deactivation

### TC-11.1: Deactivate a Company (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin | Dashboard |
| 2 | Navigate to Companies → click the activated company | Company detail |
| 3 | Scroll to "Danger Zone" card | "Deactivate Company" button visible |
| 4 | Click "Deactivate Company" | Confirmation dialog with warning text |
| 5 | Confirm | Redirected to Companies list |
| 6 | Navigate back to company detail | Deactivated banner shown, "Deactivated" badge, no activation button |

### TC-11.2: Verify Deactivation Effects

| Step | Action | Expected |
|---|---|---|
| 1 | Check company Peppol status | "Not registered" (reset to pending) |
| 2 | Check Members table | All members status: "Inactive" |
| 3 | Sign in as efabox.sk@gmail.com | No companies visible (membership deactivated) |
| 4 | Check Audit Log (as super admin) | `COMPANY_DEACTIVATED` event with details |
| 5 | Check ion-AP | Organization unpublished from SMP, identifier removed |

### TC-11.3: Verify Deactivated Company in Companies List

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin, navigate to Companies | Deactivated company still listed |
| 2 | Observe Peppol column | Shows "Not registered" |
| 3 | Click company | Detail page with deactivated banner |

---

## Group 12: Company Reactivation

### TC-12.1: Reactivate a Deactivated Company

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin, open the deactivated company detail | "Reactivate Company" card visible |
| 2 | Observe pre-filled fields | DIC (read-only), Peppol ID (read-only), Company Name, Company Email, Genesis Admin Email |
| 3 | Edit Company Name if needed | Field editable |
| 4 | Change Genesis Admin Email to: `efabox.sk@gmail.com` | Field updated |
| 5 | Click "Reactivate" | Confirmation dialog |
| 6 | Confirm | Loading spinner, company status set to active, genesis invite sent |
| 7 | Observe company detail | Company status: active, Peppol status: still "Not registered" (activation deferred to genesis accept) |

### TC-12.2: Genesis Admin Triggers Reactivation Peppol Activation

| Step | Action | Expected |
|---|---|---|
| 1 | Check efabox.sk@gmail.com inbox | New genesis admin invitation email received |
| 2 | Click "Accept Invitation" in email | Redirected to `/activate` page |
| 3 | Wait for Peppol activation | Green checkmark, "Your company is now active on Peppol!" |
| 4 | Click "Go to Dashboard" | Dashboard (no welcome screen) |
| 5 | Check company Peppol status | "Active" |
| 6 | Check Audit Log | `COMPANY_REACTIVATED`, `PEPPOL_COMPANY_ACTIVATED` events |
| 7 | Check ion-AP | New organization created, identifier published in SMP |

---

## Group 13: Edge Cases & Error Handling

### TC-13.1: Duplicate PFS Webhook (Same DIC)

| Step | Action | Expected |
|---|---|---|
| 1 | Trigger PFS webhook again for the same DIC | Webhook returns 200 (company already exists) |
| 2 | Check Companies list | No duplicate company created |
| 3 | Check invitation | New genesis invitation sent if not already genesis member |

### TC-13.2: Expired Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Create an invitation | Invitation created |
| 2 | In Supabase, manually set `expires_at` to past: `update invitations set expires_at = now() - interval '1 hour' where email = '...'` | Updated |
| 3 | Click the invitation link | "Invitation Expired" message shown |

### TC-13.3: Wrong Email for Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Open invitation link while signed in with a different email | "This invitation was sent to a different email address" message |

### TC-13.4: Peppol Activation Failure

| Step | Action | Expected |
|---|---|---|
| 1 | Temporarily set `ION_AP_API_TOKEN` to invalid value in Vercel | Token invalid |
| 2 | Try to activate a company (manual or via genesis accept) | Error message displayed |
| 3 | Check company detail | Peppol status: "Error", error message shown |
| 4 | Restore correct token | Token valid |
| 5 | Click "Activate on Peppol" (manual fallback) | Activation succeeds |

### TC-13.5: Permission Enforcement

| Step | Action | Expected |
|---|---|---|
| 1 | As accountant, try to access `/dashboard/users` | Redirected (no access) |
| 2 | As company admin, try to deactivate the genesis admin | Error: "Genesis admin can only be deactivated by a super admin" |
| 3 | As non-genesis admin, try to deactivate another admin | Error: "Only genesis admin or super admin can deactivate other admins" |

### TC-13.6: Concurrent Sessions

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin in Chrome | Dashboard |
| 2 | Sign in as company admin in Firefox | Dashboard |
| 3 | Both sessions work independently | No interference |

### TC-13.7: Test Invoices Without Token

| Step | Action | Expected |
|---|---|---|
| 1 | Remove `ION_AP_TEST_SENDER_TOKEN` env var | Env var missing |
| 2 | Click "Send test invoices" on dashboard | Error: "Test invoice sending is not configured" |

### TC-13.8: Locked Documents (Insufficient Wallet)

| Step | Action | Expected |
|---|---|---|
| 1 | As non-super-admin with unbilled documents in Inbox | Locked rows shown with blur, lock icon, reduced opacity |
| 2 | Click a locked row | Nothing happens (not clickable) |
| 3 | Hover over locked row | No PDF icon, no pointer cursor |
| 4 | Try to access locked document URL directly | "Document Locked" page with "Go to Wallet" button |

---

## Group 14: Responsive Design

### TC-14.1: Mobile Layout

| Step | Action | Expected |
|---|---|---|
| 1 | Open app on mobile device or resize to <768px | Bottom tab bar visible, sidebar hidden |
| 2 | Navigate using bottom tabs | All pages accessible |
| 3 | Open company switcher | Compact dropdown works |
| 4 | Open user avatar menu | Dropdown works, "Sign out" accessible |
| 5 | Open Inbox | Table readable, some columns hidden on mobile, checkboxes visible |
| 6 | Open document detail | Cards stack vertically |

### TC-14.2: Desktop Layout

| Step | Action | Expected |
|---|---|---|
| 1 | Open app on desktop (>768px) | Sidebar visible, no bottom tab bar |
| 2 | Toggle sidebar | Collapses/expands smoothly |
| 3 | All tables show full columns | Amount, Date visible on desktop |

---

## Execution Checklist

| Group | Tests | Status |
|---|---|---|
| 1. Landing Page & Initial Setup | TC-1.1 to TC-1.7 | [ ] |
| 2. Company Onboarding via PFS | TC-2.1 to TC-2.3 | [ ] |
| 3. Genesis Admin Onboarding & Auto Activation | TC-3.1 to TC-3.4 | [ ] |
| 4. Peppol Activation (Manual Fallback) | TC-4.1 to TC-4.2 | [ ] |
| 5. User Management & Invitations | TC-5.1 to TC-5.5 | [ ] |
| 6. OTP Sign-In Flow | TC-6.1 to TC-6.4 | [ ] |
| 7. Test Invoices | TC-7.1 to TC-7.3 | [ ] |
| 8. Inbox & Document Viewing | TC-8.1 to TC-8.7 | [ ] |
| 9. Mass Download | TC-9.1 to TC-9.4 | [ ] |
| 10. Audit Log | TC-10.1 to TC-10.4 | [ ] |
| 11. Company Deactivation | TC-11.1 to TC-11.3 | [ ] |
| 12. Company Reactivation | TC-12.1 to TC-12.2 | [ ] |
| 13. Edge Cases & Error Handling | TC-13.1 to TC-13.8 | [ ] |
| 14. Responsive Design | TC-14.1 to TC-14.2 | [ ] |
| **Total** | **62 test cases** | |
