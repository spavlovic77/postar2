# Postar — Manual Test Cases

## Test Environment

| Role | Email |
|---|---|
| Super Admin | stanislav.pavlovic@fiinancnasprava.sk |
| Company Admin (Genesis) | efabox.sk@gmail.com |
| Accountant | apartmentvir1@gmail.com |

**Prerequisites:**
- Fresh schema.sql executed in Supabase SQL Editor
- All env vars set in Vercel (Supabase, Resend, Twilio, ion-AP)
- ion-AP test environment token configured

---

## Group 1: Initial Setup & Super Admin

### TC-1.1: First Sign-In (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Open the app URL | Sign-in page with "Postar" title and "Sign In" button |
| 2 | Click "Sign In" | Modal opens with Google, Apple, and email options |
| 3 | Click "Continue with Google" | Google OAuth flow starts |
| 4 | Select stanislav.pavlovic@fiinancnasprava.sk | Redirected back to app |
| 5 | Observe | Redirected to `/dashboard`, profile created |
| 6 | Run in Supabase SQL Editor: `update profiles set is_super_admin = true where id = (select id from auth.users limit 1);` | Success |
| 7 | Refresh the page | Super Admin dashboard with stats cards, recent webhooks, recent invitations, and "Send Onboarding Request" card |

### TC-1.2: Configure PFS Activation Link

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Settings (sidebar) | Settings page with Profile and Account cards |
| 2 | Observe "PFS Activation Link" card | Visible (super admin only) |
| 3 | Enter: `https://kejwajsi.vercel.app/client?actlinkid=3030` | Field populated |
| 4 | Click "Save" | "Saved" message appears |
| 5 | Refresh page | Link is persisted |

### TC-1.3: Update Profile

| Step | Action | Expected |
|---|---|---|
| 1 | On Settings page, fill "Full Name": `Stanislav Pavlovic` | Field populated |
| 2 | Fill "Phone": `+421900000000` | Field populated |
| 3 | Click "Save Changes" | "Profile updated" message |
| 4 | Refresh page | Name and phone persisted |
| 5 | Check avatar dropdown (top right) | Shows name "Stanislav Pavlovic" |

### TC-1.4: Dark Mode Toggle

| Step | Action | Expected |
|---|---|---|
| 1 | Click the sun/moon icon in the top bar | Theme switches to dark mode |
| 2 | Click again | Theme switches back to light mode |
| 3 | Refresh page | Theme preference persisted |

### TC-1.5: Sidebar Navigation (Desktop)

| Step | Action | Expected |
|---|---|---|
| 1 | Observe sidebar | Shows: Dashboard, Inbox, Companies, Users, Webhooks, Audit Log, Settings |
| 2 | Click each item | Navigates to correct page, active item highlighted |
| 3 | Click sidebar toggle (hamburger) | Sidebar collapses/expands |

### TC-1.6: Bottom Tab Bar (Mobile)

| Step | Action | Expected |
|---|---|---|
| 1 | Resize browser to mobile width (<768px) | Sidebar hidden, bottom tab bar appears |
| 2 | Observe tab bar items | Shows nav items as icons with labels |
| 3 | Tap each tab | Navigates to correct page, active tab highlighted |

---

## Group 2: Company Onboarding via PFS Webhook

### TC-2.1: Trigger PFS Webhook (New Company)

| Step | Action | Expected |
|---|---|---|
| 1 | Go to PFS test environment and trigger a webhook for a test company (DIC: use a real test DIC) | Webhook sent to Postar |
| 2 | In Postar, navigate to Dashboard | "Webhooks" stat incremented |
| 3 | Check "Recent Webhooks" table | New entry with DIC, company name, email |
| 4 | Navigate to Companies page | New company listed with Peppol status "Not registered" |
| 5 | Click company name | Company detail page with DIC, email, phone, members |

### TC-2.2: Verify Genesis Admin Invitation Sent

| Step | Action | Expected |
|---|---|---|
| 1 | Check "Recent Invitations" on Dashboard | New invitation for efabox.sk@gmail.com, role: company_admin, status: Pending |
| 2 | Check efabox.sk@gmail.com inbox | Email with "Accept Invitation" button received |
| 3 | Navigate to Users page | Invitation visible in Invitations table |

### TC-2.3: Send Manual Onboarding Request (New Customer)

| Step | Action | Expected |
|---|---|---|
| 1 | On Super Admin Dashboard, find "Send Onboarding Request" card | Card visible |
| 2 | Enter email: `test@example.com`, company name: `Test Manual Co` | Fields populated |
| 3 | Click "Send Onboarding Link" | "Onboarding request sent" message |
| 4 | Check Audit Log page | `ONBOARDING_REQUEST_SENT` event logged |

---

## Group 3: Genesis Admin Onboarding

### TC-3.1: Accept Invitation via Magic Link

| Step | Action | Expected |
|---|---|---|
| 1 | Open the invitation email in efabox.sk@gmail.com | Email with "Accept Invitation" button |
| 2 | Click "Accept Invitation" | Redirected to Postar, automatically signed in |
| 3 | Observe | Welcome screen: "Welcome to Postar!", role badge "Company Admin", company name shown |
| 4 | Click "Go to Dashboard" | Company Admin dashboard with company card |
| 5 | Check company card | Shows company name, DIC, Peppol status "Not registered" |

### TC-3.2: Verify Genesis Admin Membership

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Companies page | Company listed |
| 2 | Click company | Company detail page |
| 3 | Check Members table | efabox.sk@gmail.com listed as "company admin" with "Genesis" badge, status "Active" |

---

## Group 4: Peppol Activation

### TC-4.1: Activate Company on Peppol (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin | Super Admin dashboard |
| 2 | Navigate to Companies → click the company | Company detail page |
| 3 | Observe "Peppol Network" card | Shows "Activate on Peppol" button, Peppol ID preview `0245:<DIC>` |
| 4 | Click "Activate on Peppol" | Confirmation dialog |
| 5 | Confirm | Loading spinner, then page refreshes |
| 6 | Observe company detail | Peppol status: "Active", Peppol ID shown, activation date shown, ion-AP Org ID shown |
| 7 | Navigate to Companies list | Peppol column shows "Active" badge |
| 8 | Check Audit Log | `PEPPOL_COMPANY_ACTIVATED` event with org ID and identifier details |

### TC-4.2: Verify ion-AP Registration

| Step | Action | Expected |
|---|---|---|
| 1 | Open ion-AP test environment UI or API | Organization exists with correct name and DIC |
| 2 | Check identifiers | `0245:<DIC>` identifier, verified: true, publish_receive_peppolbis: true |
| 3 | Check receive triggers | API_CALL trigger configured pointing to Postar webhook URL |

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
| 4 | Check apartmentvir1@gmail.com inbox | Invitation email with magic link received |

### TC-5.3: Accountant Accepts Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Open invitation email in apartmentvir1@gmail.com | Email with "Accept Invitation" button |
| 2 | Click "Accept Invitation" | Redirected to Postar, signed in |
| 3 | Observe Welcome screen | Role badge: "Accountant", company name shown |
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
| 1 | Sign out | Redirected to sign-in page |
| 2 | Click "Sign In" → enter a new test email | Modal shows email field |
| 3 | Click "Continue with Email" | Choose verification channel screen |
| 4 | Click "Send code to [email]" | Code input screen appears, "Code sent to..." message |
| 5 | Check email | 6-digit code received in clean format |
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

## Group 7: Inbox & Document Viewing

### TC-7.1: Receive a Peppol Document

| Step | Action | Expected |
|---|---|---|
| 1 | From ion-AP test environment, send a test invoice to the activated company's Peppol ID (`0245:<DIC>`) | Document sent via Peppol network |
| 2 | Wait for ion-AP to process and trigger webhook | Webhook hits Postar |
| 3 | Sign in as company admin or super admin | Dashboard |
| 4 | Navigate to Inbox | Document listed as unread (bold, mail icon) |
| 5 | Observe document row | Sender identifier, document type, document ID, date shown |

### TC-7.2: View Document Detail

| Step | Action | Expected |
|---|---|---|
| 1 | Click on the unread document in Inbox | Document detail page |
| 2 | Observe status | Auto-marked as "read", badge shows "read" |
| 3 | Observe metadata cards | Sender, Receiver, Company, Received date |
| 4 | Observe XML Document card | XML content displayed in code block |
| 5 | Observe Transaction Details card | Transaction UUID, ion-AP Transaction ID, Document Type, Direction |
| 6 | Go back to Inbox | Document now shows as read (lighter, open mail icon) |

### TC-7.3: Mark Document as Unread

| Step | Action | Expected |
|---|---|---|
| 1 | On document detail, click the "..." menu (top right) | Dropdown opens |
| 2 | Click "Mark as unread" | Page refreshes, status badge shows "new" |
| 3 | Go back to Inbox | Document shows as unread again |

### TC-7.4: Download PDF

| Step | Action | Expected |
|---|---|---|
| 1 | On document detail, click "..." → "Download PDF" | New tab opens |
| 2 | Observe | PDF rendering of the invoice displayed |

### TC-7.5: Company Switcher Filtering

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin with multiple companies, go to Inbox | All documents shown |
| 2 | Use company switcher (top bar) to select a specific company | Inbox filters to only that company's documents |
| 3 | Select "All Companies" | All documents shown again |

---

## Group 8: Audit Log

### TC-8.1: View Audit Logs (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Navigate to Audit Log | Table with all events |
| 2 | Observe columns | Time, Event (name + ID), Severity, Actor, Company DIC, Source IP |
| 3 | Verify events from previous tests are logged | AUTH_SIGN_IN, INVITE_CREATED, INVITE_ACCEPTED, PEPPOL_COMPANY_ACTIVATED, USER_ONBOARDED, etc. |
| 4 | Check severity badges | info (blue), warning (yellow), error (red) |

### TC-8.2: Audit Log Filtering by Company

| Step | Action | Expected |
|---|---|---|
| 1 | Use company switcher to select a company | Audit log filters to company-related events only |
| 2 | Select "All Companies" | All events shown again |

### TC-8.3: Audit Log Visibility (Company Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as company admin (efabox.sk@gmail.com) | Dashboard |
| 2 | Navigate to Audit Log | Only events for own companies + own actions visible |
| 3 | Verify super-admin-only events are NOT visible | No other company's events shown |

### TC-8.4: Audit Log Visibility (Accountant)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as accountant (if still active) | Dashboard |
| 2 | Navigate to Audit Log | Only own actions + assigned company events |

---

## Group 9: Company Deactivation

### TC-9.1: Deactivate a Company (Super Admin)

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin | Dashboard |
| 2 | Navigate to Companies → click the activated company | Company detail |
| 3 | Scroll to "Danger Zone" card | "Deactivate Company" button visible |
| 4 | Click "Deactivate Company" | Confirmation dialog with warning text |
| 5 | Confirm | Redirected to Companies list |
| 6 | Navigate back to company detail | Deactivated banner shown, "Deactivated" badge, no activation button |

### TC-9.2: Verify Deactivation Effects

| Step | Action | Expected |
|---|---|---|
| 1 | Check company Peppol status | "Not registered" (reset to pending) |
| 2 | Check Members table | All members status: "Inactive" |
| 3 | Sign in as efabox.sk@gmail.com | No companies visible (membership deactivated) |
| 4 | Check Audit Log (as super admin) | `COMPANY_DEACTIVATED` event with details |
| 5 | Check ion-AP | Organization unpublished from SMP, identifier removed |

### TC-9.3: Verify Deactivated Company in Companies List

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin, navigate to Companies | Deactivated company still listed |
| 2 | Observe Peppol column | Shows "Not registered" |
| 3 | Click company | Detail page with deactivated banner |

---

## Group 10: Company Reactivation

### TC-10.1: Reactivate a Deactivated Company

| Step | Action | Expected |
|---|---|---|
| 1 | As super admin, open the deactivated company detail | "Reactivate Company" card visible |
| 2 | Observe pre-filled fields | DIC (read-only), Peppol ID (read-only), Company Name, Company Email, Genesis Admin Email |
| 3 | Edit Company Name if needed | Field editable |
| 4 | Change Genesis Admin Email to: `efabox.sk@gmail.com` | Field updated |
| 5 | Click "Reactivate on Peppol" | Confirmation dialog |
| 6 | Confirm | Loading spinner, then page refreshes |
| 7 | Observe company detail | Peppol status: "Active", company status: active, deactivated banner gone |

### TC-10.2: Verify Reactivation Effects

| Step | Action | Expected |
|---|---|---|
| 1 | Check ion-AP | New organization created, identifier published in SMP |
| 2 | Check efabox.sk@gmail.com inbox | New genesis admin invitation email received |
| 3 | Accept invitation (click magic link) | Signed in, membership created as genesis admin |
| 4 | Check Audit Log | `COMPANY_REACTIVATED` and `PEPPOL_COMPANY_ACTIVATED` events |

---

## Group 11: Edge Cases & Error Handling

### TC-11.1: Duplicate PFS Webhook (Same DIC)

| Step | Action | Expected |
|---|---|---|
| 1 | Trigger PFS webhook again for the same DIC | Webhook returns 200 (company already exists) |
| 2 | Check Companies list | No duplicate company created |
| 3 | Check invitation | New genesis invitation sent if not already genesis member |

### TC-11.2: Expired Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Create an invitation | Invitation created |
| 2 | In Supabase, manually set `expires_at` to past: `update invitations set expires_at = now() - interval '1 hour' where email = '...'` | Updated |
| 3 | Click the invitation link | "Invitation Expired" message shown |

### TC-11.3: Wrong Email for Invitation

| Step | Action | Expected |
|---|---|---|
| 1 | Open invitation link while signed in with a different email | "This invitation was sent to a different email address" message |

### TC-11.4: Peppol Activation Failure

| Step | Action | Expected |
|---|---|---|
| 1 | Temporarily set `ION_AP_API_TOKEN` to invalid value in Vercel | Token invalid |
| 2 | Try to activate a company | Error message displayed |
| 3 | Check company detail | Peppol status: "Error", error message shown |
| 4 | Restore correct token | Token valid |
| 5 | Click "Activate on Peppol" again | Activation succeeds |

### TC-11.5: Permission Enforcement

| Step | Action | Expected |
|---|---|---|
| 1 | As accountant, try to access `/dashboard/users` | Redirected (no access) |
| 2 | As company admin, try to deactivate the genesis admin | Error: "Genesis admin can only be deactivated by a super admin" |
| 3 | As non-genesis admin, try to deactivate another admin | Error: "Only genesis admin or super admin can deactivate other admins" |

### TC-11.6: Concurrent Sessions

| Step | Action | Expected |
|---|---|---|
| 1 | Sign in as super admin in Chrome | Dashboard |
| 2 | Sign in as company admin in Firefox | Dashboard |
| 3 | Both sessions work independently | No interference |

---

## Group 12: Responsive Design

### TC-12.1: Mobile Layout

| Step | Action | Expected |
|---|---|---|
| 1 | Open app on mobile device or resize to <768px | Bottom tab bar visible, sidebar hidden |
| 2 | Navigate using bottom tabs | All pages accessible |
| 3 | Open company switcher | Compact dropdown works |
| 4 | Open user avatar menu | Dropdown works, "Sign out" accessible |
| 5 | Open Inbox | Table readable, some columns hidden on mobile |
| 6 | Open document detail | Cards stack vertically, XML scrollable |

### TC-12.2: Desktop Layout

| Step | Action | Expected |
|---|---|---|
| 1 | Open app on desktop (>768px) | Sidebar visible, no bottom tab bar |
| 2 | Toggle sidebar | Collapses/expands smoothly |
| 3 | All tables show full columns | Phone, Created date visible on desktop |

---

## Execution Checklist

| Group | Tests | Status |
|---|---|---|
| 1. Initial Setup & Super Admin | TC-1.1 to TC-1.6 | [ ] |
| 2. Company Onboarding via PFS | TC-2.1 to TC-2.3 | [ ] |
| 3. Genesis Admin Onboarding | TC-3.1 to TC-3.2 | [ ] |
| 4. Peppol Activation | TC-4.1 to TC-4.2 | [ ] |
| 5. User Management & Invitations | TC-5.1 to TC-5.5 | [ ] |
| 6. OTP Sign-In Flow | TC-6.1 to TC-6.4 | [ ] |
| 7. Inbox & Document Viewing | TC-7.1 to TC-7.5 | [ ] |
| 8. Audit Log | TC-8.1 to TC-8.4 | [ ] |
| 9. Company Deactivation | TC-9.1 to TC-9.3 | [ ] |
| 10. Company Reactivation | TC-10.1 to TC-10.2 | [ ] |
| 11. Edge Cases & Error Handling | TC-11.1 to TC-11.6 | [ ] |
| 12. Responsive Design | TC-12.1 to TC-12.2 | [ ] |
| **Total** | **48 test cases** | |
