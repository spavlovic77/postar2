export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/dal";
import { getSystemSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "./profile-form";
import { SystemSettingsForm } from "./system-settings-form";

export default async function SettingsPage() {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { profile, role, user, companies } = data;

  // Fetch system settings for super admin
  let systemSettings: Record<string, string> = {};
  if (profile.is_super_admin) {
    systemSettings = await getSystemSettings();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={profile.full_name ?? ""}
              phone={profile.phone ?? ""}
              email={user.email ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <div className="flex gap-2 pt-1">
                {profile.is_super_admin && <Badge>Super Admin</Badge>}
                {role === "company_admin" && !profile.is_super_admin && (
                  <Badge variant="secondary">Company Admin</Badge>
                )}
                {role === "accountant" && (
                  <Badge variant="outline">Accountant</Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Companies</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {companies.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  companies.map((c) => (
                    <Badge key={c.id} variant="outline" className="text-xs">
                      {c.legal_name ?? c.dic}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {profile.is_super_admin && (
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>
              Configure integration credentials and business settings.
              Changes take effect immediately without redeploying.
              Secrets and tokens are masked in audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SystemSettingsForm currentValues={systemSettings} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
