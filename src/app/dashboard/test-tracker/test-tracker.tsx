"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TestCase {
  id: string;
  name: string;
}

interface TestGroup {
  name: string;
  tests: TestCase[];
}

const TEST_GROUPS: TestGroup[] = [
  {
    name: "1. Initial Setup & Super Admin",
    tests: [
      { id: "1.1", name: "First Sign-In (Super Admin)" },
      { id: "1.2", name: "Configure PFS Activation Link" },
      { id: "1.3", name: "Update Profile" },
      { id: "1.4", name: "Dark Mode Toggle" },
      { id: "1.5", name: "Sidebar Navigation (Desktop)" },
      { id: "1.6", name: "Bottom Tab Bar (Mobile)" },
    ],
  },
  {
    name: "2. Company Onboarding via PFS",
    tests: [
      { id: "2.1", name: "Trigger PFS Webhook (New Company)" },
      { id: "2.2", name: "Verify Genesis Admin Invitation Sent" },
      { id: "2.3", name: "Send Manual Onboarding Request" },
    ],
  },
  {
    name: "3. Genesis Admin Onboarding",
    tests: [
      { id: "3.1", name: "Accept Invitation via Magic Link" },
      { id: "3.2", name: "Verify Genesis Admin Membership" },
    ],
  },
  {
    name: "4. Peppol Activation",
    tests: [
      { id: "4.1", name: "Activate Company on Peppol" },
      { id: "4.2", name: "Verify ion-AP Registration" },
    ],
  },
  {
    name: "5. User Management & Invitations",
    tests: [
      { id: "5.1", name: "Invite Company Admin (by Genesis)" },
      { id: "5.2", name: "Invite Accountant (by Genesis)" },
      { id: "5.3", name: "Accountant Accepts Invitation" },
      { id: "5.4", name: "Accountant Access Restrictions" },
      { id: "5.5", name: "Deactivate a Member (by Genesis)" },
    ],
  },
  {
    name: "6. OTP Sign-In Flow",
    tests: [
      { id: "6.1", name: "Sign Up with Email OTP" },
      { id: "6.2", name: "Sign Up with SMS OTP" },
      { id: "6.3", name: "Sign In (Returning User)" },
      { id: "6.4", name: "Wrong Code" },
    ],
  },
  {
    name: "7. Inbox & Document Viewing",
    tests: [
      { id: "7.1", name: "Receive a Peppol Document" },
      { id: "7.2", name: "View Document Detail" },
      { id: "7.3", name: "Mark Document as Unread" },
      { id: "7.4", name: "Download PDF" },
      { id: "7.5", name: "Company Switcher Filtering" },
    ],
  },
  {
    name: "8. Audit Log",
    tests: [
      { id: "8.1", name: "View Audit Logs (Super Admin)" },
      { id: "8.2", name: "Audit Log Filtering by Company" },
      { id: "8.3", name: "Audit Log Visibility (Company Admin)" },
      { id: "8.4", name: "Audit Log Visibility (Accountant)" },
    ],
  },
  {
    name: "9. Company Deactivation",
    tests: [
      { id: "9.1", name: "Deactivate a Company" },
      { id: "9.2", name: "Verify Deactivation Effects" },
      { id: "9.3", name: "Deactivated Company in List" },
    ],
  },
  {
    name: "10. Company Reactivation",
    tests: [
      { id: "10.1", name: "Reactivate a Deactivated Company" },
      { id: "10.2", name: "Verify Reactivation Effects" },
    ],
  },
  {
    name: "11. Edge Cases & Error Handling",
    tests: [
      { id: "11.1", name: "Duplicate PFS Webhook (Same DIC)" },
      { id: "11.2", name: "Expired Invitation" },
      { id: "11.3", name: "Wrong Email for Invitation" },
      { id: "11.4", name: "Peppol Activation Failure" },
      { id: "11.5", name: "Permission Enforcement" },
      { id: "11.6", name: "Concurrent Sessions" },
    ],
  },
  {
    name: "12. Responsive Design",
    tests: [
      { id: "12.1", name: "Mobile Layout" },
      { id: "12.2", name: "Desktop Layout" },
    ],
  },
];

const STORAGE_KEY = "postar-test-tracker";

export function TestTracker() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setChecked(JSON.parse(saved));
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetAll = () => {
    if (confirm("Reset all test results?")) {
      setChecked({});
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const totalTests = TEST_GROUPS.reduce((sum, g) => sum + g.tests.length, 0);
  const passedTests = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Click a test case to mark it as done. Progress is saved in your browser.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {passedTests} / {totalTests}
          </Badge>
          <button
            onClick={resetAll}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Reset all
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-green-500 transition-all"
          style={{ width: `${totalTests > 0 ? (passedTests / totalTests) * 100 : 0}%` }}
        />
      </div>

      {TEST_GROUPS.map((group) => {
        const groupPassed = group.tests.filter((t) => checked[t.id]).length;

        return (
          <Card key={group.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{group.name}</CardTitle>
                <Badge
                  variant={groupPassed === group.tests.length ? "default" : "outline"}
                  className={
                    groupPassed === group.tests.length
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : ""
                  }
                >
                  {groupPassed}/{group.tests.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.tests.map((test) => (
                <button
                  key={test.id}
                  onClick={() => toggle(test.id)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                      checked[test.id]
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-input"
                    }`}
                  >
                    {checked[test.id] && "✓"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    TC-{test.id}
                  </span>
                  <span className={checked[test.id] ? "line-through text-muted-foreground" : ""}>
                    {test.name}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
