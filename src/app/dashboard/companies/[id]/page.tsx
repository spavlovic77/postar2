import { redirect, notFound } from "next/navigation";
import { getUserWithRole, getCompanyWithMembers } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeppolStatusBadge } from "@/components/dashboard/peppol-status-badge";
import { DeactivateButton } from "./deactivate-button";
import { PeppolActivateButton } from "./peppol-activate-button";
import { DeactivateCompanyButton } from "./deactivate-company-button";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getUserWithRole();
  if (!data) redirect("/");

  const { id } = await params;
  const { role, user, memberships } = data;

  if (role !== "super_admin") {
    const hasAccess = memberships.some((m) => m.company_id === id);
    if (!hasAccess) notFound();
  }

  const { company, members } = await getCompanyWithMembers(id);
  if (!company) notFound();

  const myMembership = memberships.find((m) => m.company_id === id);
  const canManageMembers =
    role === "super_admin" || myMembership?.role === "company_admin";
  const isDeactivated = company.status === "deactivated";
  const canActivatePeppol =
    !isDeactivated && company.ion_ap_status !== "active" && canManageMembers;

  return (
    <div className="space-y-6">
      {isDeactivated && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">This company has been deactivated</p>
          <p className="text-sm text-destructive/80">
            Deactivated on {company.deactivated_at ? new Date(company.deactivated_at).toLocaleDateString("sk-SK") : "unknown"}.
            All memberships and documents have been archived. Onboarding must be repeated to reactivate.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{company.legal_name ?? company.dic}</h1>
        <div className="flex items-center gap-2">
          {isDeactivated && <Badge variant="destructive">Deactivated</Badge>}
          {!isDeactivated && <PeppolStatusBadge status={company.ion_ap_status} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DIC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg font-bold">{company.dic}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peppol ID</CardTitle>
          </CardHeader>
          <CardContent>
            {company.ion_ap_status === "active" ? (
              <p className="font-mono text-sm">0245:{company.dic}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Not registered</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{company.company_email ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {members.filter((m) => m.status === "active").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Peppol Activation */}
      {canActivatePeppol && (
        <Card>
          <CardHeader>
            <CardTitle>Peppol Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.ion_ap_status === "error" && company.ion_ap_error && (
              <p className="text-sm text-destructive">{company.ion_ap_error}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Register this company on the Peppol network to send and receive electronic invoices.
              The Peppol identifier will be <span className="font-mono font-medium">0245:{company.dic}</span>.
            </p>
            <PeppolActivateButton companyId={company.id} />
          </CardContent>
        </Card>
      )}

      {company.ion_ap_status === "active" && company.ion_ap_activated_at && (
        <Card>
          <CardHeader>
            <CardTitle>Peppol Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Peppol ID:</span>{" "}
              <span className="font-mono font-medium">0245:{company.dic}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Activated:</span>{" "}
              {formatDate(company.ion_ap_activated_at)}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">ion-AP Org ID:</span>{" "}
              <span className="font-mono">{company.ion_ap_org_id}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                {canManageMembers && <TableHead className="w-[100px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageMembers ? 5 : 4}
                    className="text-center text-muted-foreground"
                  >
                    No members
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const profile = (m as { profile: { full_name: string | null } }).profile;
                  const canDeactivate =
                    canManageMembers && m.status === "active" && m.user_id !== user.id;

                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <span className="font-medium">
                          {profile?.full_name ?? "Unnamed"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {m.role.replace("_", " ")}
                          </Badge>
                          {m.is_genesis && (
                            <Badge variant="secondary" className="text-xs">
                              Genesis
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.status === "active" ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {formatDate(m.created_at)}
                      </TableCell>
                      {canManageMembers && (
                        <TableCell>
                          {canDeactivate && <DeactivateButton membershipId={m.id} />}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Danger Zone - Super admin only */}
      {role === "super_admin" && !isDeactivated && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deactivating this company will remove it from the Peppol network, deactivate all members,
              and archive all documents. This action cannot be reversed.
            </p>
            <DeactivateCompanyButton
              companyId={company.id}
              companyName={company.legal_name ?? company.dic}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
