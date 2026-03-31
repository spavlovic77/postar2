"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Activity, Building2, FileText, CreditCard, Receipt, Mail,
  RefreshCw, AlertTriangle, CheckCircle2, Zap, ArrowRight,
} from "lucide-react";
import {
  opsRetryActivation,
  opsRetryDocument,
  opsRetryAllFailedDocuments,
  opsForceDocumentStatus,
  opsForceCheckPayment,
  opsMarkPaymentCompleted,
  opsRetryAutoBill,
  opsForceBillDocument,
  opsExtendInvitation,
} from "./ops-actions";
import { resendInvitation } from "@/lib/actions";

function formatDate(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  };
  return <Badge className={styles[status] ?? ""}>{status}</Badge>;
}

const TABS = [
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "invitations", label: "Invitations", icon: Mail },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  companies: any[];
  documents: any[];
  payments: any[];
  billing: any[];
  invitations: any[];
  isSuperAdmin: boolean;
}

export function OpsCenter({ companies, documents, payments, billing, invitations, isSuperAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("companies");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const { toast } = useToast();

  const setItemLoading = (id: string, val: boolean) => setLoading((p) => ({ ...p, [id]: val }));

  const counts: Record<TabId, number> = {
    companies: companies.length,
    documents: documents.length,
    payments: payments.length,
    billing: billing.length,
    invitations: invitations.length,
  };

  const totalIssues = Object.values(counts).reduce((s, n) => s + n, 0);

  async function handleAction(id: string, fn: () => Promise<any>, successMsg: string) {
    setItemLoading(id, true);
    try {
      const result = await fn();
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(successMsg);
        router.refresh();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    }
    setItemLoading(id, false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Operations Center</h1>
          {totalIssues > 0 ? (
            <Badge variant="destructive">{totalIssues} issues</Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle2 className="mr-1 h-3 w-3" /> All clear
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "companies" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Companies with Peppol activation issues (status: error or pending).</p>
          {companies.length === 0 ? (
            <EmptyState icon={Building2} message="No activation issues" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>DIC</TableHead>
                    <TableHead>Peppol Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.legal_name ?? "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.dic}</TableCell>
                      <TableCell><StatusBadge status={c.ion_ap_status} /></TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{c.ion_ap_error ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!loading[c.id]}
                          onClick={() => handleAction(c.id, () => opsRetryActivation(c.id), "Activation retried")}
                        >
                          {loading[c.id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Documents stuck in pending, processing, or failed state.</p>
            {documents.filter((d: any) => d.status === "failed").length > 0 && (
              <Button
                size="sm"
                disabled={!!loading["bulk-retry"]}
                onClick={() => handleAction("bulk-retry", async () => {
                  const r = await opsRetryAllFailedDocuments();
                  return r.retried !== undefined ? { success: true, message: `${r.succeeded}/${r.retried} succeeded` } : r;
                }, "Bulk retry completed")}
              >
                {loading["bulk-retry"] ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />}
                Retry All Failed
              </Button>
            )}
          </div>
          {documents.length === 0 ? (
            <EmptyState icon={FileText} message="No document processing issues" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Last Error</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="font-mono text-sm">{d.document_id ?? d.ion_ap_transaction_id ?? d.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{d.sender_identifier ?? "-"}</TableCell>
                      <TableCell className="text-sm">{d.retry_count}/10</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{d.last_error ?? "-"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm" variant="outline"
                          disabled={!!loading[d.id]}
                          onClick={() => handleAction(d.id, () => opsRetryDocument(d.id), "Document retried")}
                        >
                          {loading[d.id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Retry"}
                        </Button>
                        {d.status === "failed" && isSuperAdmin && (
                          <Button
                            size="sm" variant="ghost"
                            disabled={!!loading[`force-${d.id}`]}
                            onClick={() => handleAction(`force-${d.id}`, () => opsForceDocumentStatus(d.id, "new"), "Status forced to new")}
                          >
                            Force New
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pending or expired payment links.</p>
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} message="No payment issues" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="font-medium">{p.amount} EUR</TableCell>
                      <TableCell className="font-mono text-xs">{p.external_transaction_id}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.created_at)}</TableCell>
                      <TableCell className="text-sm">{formatDate(p.expires_at)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {p.status === "pending" && (
                          <Button
                            size="sm" variant="outline"
                            disabled={!!loading[p.id]}
                            onClick={() => handleAction(p.id, () => opsForceCheckPayment(p.id), "Payment checked")}
                          >
                            {loading[p.id] ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Check Now"}
                          </Button>
                        )}
                        {isSuperAdmin && p.status === "pending" && (
                          <Button
                            size="sm" variant="destructive"
                            disabled={!!loading[`mark-${p.id}`]}
                            onClick={() => handleAction(`mark-${p.id}`, () => opsMarkPaymentCompleted(p.id), `Payment ${p.amount} EUR marked completed`)}
                          >
                            Mark Completed
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === "billing" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Companies with unbilled documents. Auto-billing uses all-or-nothing: total cost must be covered.</p>
          {billing.length === 0 ? (
            <EmptyState icon={Receipt} message="No billing issues" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Unbilled</TableHead>
                    <TableHead className="text-right">Price/doc</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Can Bill?</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.map((b: any) => (
                    <TableRow key={b.companyId}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{b.legalName ?? "-"}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{b.dic}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{b.unbilledCount}</TableCell>
                      <TableCell className="text-right text-sm">{b.pricePerDoc.toFixed(4)} EUR</TableCell>
                      <TableCell className="text-right font-medium">{b.totalCost.toFixed(4)} EUR</TableCell>
                      <TableCell className={cn("text-right font-medium", b.walletBalance < b.totalCost && "text-red-600 dark:text-red-400")}>
                        {b.walletBalance.toFixed(4)} EUR
                      </TableCell>
                      <TableCell>
                        {b.canBill ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Yes</Badge>
                        ) : (
                          <Badge variant="destructive">Insufficient</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.walletId && b.canBill && (
                          <Button
                            size="sm" variant="outline"
                            disabled={!!loading[b.companyId]}
                            onClick={() => handleAction(b.companyId, () => opsRetryAutoBill(b.walletId), `Billed ${b.unbilledCount} documents`)}
                          >
                            {loading[b.companyId] ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Bill Now"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pending and expired invitations that have not been accepted.</p>
          {invitations.length === 0 ? (
            <EmptyState icon={Mail} message="No pending invitations" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Genesis</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv: any) => {
                    const expired = new Date(inv.expires_at) < new Date();
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{(inv.roles ?? []).map((r: string) => r.replace(/_/g, " ")).join(", ")}</Badge>
                        </TableCell>
                        <TableCell>{inv.is_genesis ? "Yes" : "-"}</TableCell>
                        <TableCell className="text-sm">{formatDate(inv.expires_at)}</TableCell>
                        <TableCell>
                          {expired ? <Badge variant="destructive">Expired</Badge> : <Badge variant="secondary">Pending</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm" variant="outline"
                            disabled={!!loading[`resend-${inv.id}`]}
                            onClick={() => handleAction(`resend-${inv.id}`, () => resendInvitation(inv.id), "Invitation resent")}
                          >
                            Resend
                          </Button>
                          {expired && (
                            <Button
                              size="sm" variant="outline"
                              disabled={!!loading[`extend-${inv.id}`]}
                              onClick={() => handleAction(`extend-${inv.id}`, () => opsExtendInvitation(inv.id), "Expiry extended 48h")}
                            >
                              Extend 48h
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <CheckCircle2 className="h-8 w-8 text-green-500" />
      <p>{message}</p>
    </div>
  );
}
