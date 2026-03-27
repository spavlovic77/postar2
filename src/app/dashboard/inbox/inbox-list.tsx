"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, MailOpen, FileText, AlertCircle, Loader2, FolderInput, ChevronDown, Check, Lock, RefreshCw, Download } from "lucide-react";
import { LoadMore } from "@/components/ui/load-more";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { assignDocumentToDepartment, bulkAssignDocuments } from "./triage-actions";

function formatDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function documentTypeLabel(type: string | null) {
  if (!type) return "Document";
  switch (type) {
    case "Invoice": return "Invoice";
    case "CreditNote": return "Credit Note";
    default: return type;
  }
}

interface Department {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Props {
  initialDocuments: any[];
  total: number;
  unreadCount: number;
  nextCursor: string | null;
  companyFilter: string | null;
  canTriage: boolean;
  isSuperAdmin: boolean;
  filters?: React.ReactNode;
}

function DeptPicker({
  documentId,
  companyId,
  currentDeptId,
  departments,
  onAssigned,
}: {
  documentId: string;
  companyId: string;
  currentDeptId: string | null;
  departments: Department[];
  onAssigned: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const currentDept = departments.find((d) => d.id === currentDeptId);

  const handleAssign = async (deptId: string) => {
    setIsLoading(true);
    const result = await assignDocumentToDepartment(documentId, deptId);
    setIsLoading(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      const dept = departments.find((d) => d.id === deptId);
      toast(`Assigned to ${dept?.name ?? "department"}`);
      onAssigned();
    }
  };

  if (isLoading) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
              currentDeptId
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <FolderInput className="h-3 w-3" />
            <span>{currentDept?.name ?? "Unassigned"}</span>
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-[200px]">
        {departments.length === 0 ? (
          <DropdownMenuItem disabled>No departments</DropdownMenuItem>
        ) : (
          departments.map((d) => (
            <DropdownMenuItem key={d.id} onClick={() => handleAssign(d.id)}>
              <Check className={cn("mr-2 h-3.5 w-3.5", currentDeptId === d.id ? "opacity-100" : "opacity-0")} />
              {d.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ZIP_THRESHOLD = 5;

function triggerBlobDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function fetchFileBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function downloadIndividual(
  ids: string[],
  type: "xml" | "pdf" | "both",
  documents: any[],
  onProgress: (done: number, total: number) => void
) {
  const total = ids.length * (type === "both" ? 2 : 1);
  let done = 0;

  for (const id of ids) {
    const doc = documents.find((d: any) => d.id === id);
    const label = doc?.document_id ?? doc?.ion_ap_transaction_id ?? id.slice(0, 8);

    if (type === "xml" || type === "both") {
      const blob = await fetchFileBlob(`/api/documents/${id}/xml`);
      if (blob) triggerBlobDownload(blob, `${label}.xml`);
      done++;
      onProgress(done, total);
      await new Promise((r) => setTimeout(r, 300));
    }
    if (type === "pdf" || type === "both") {
      const blob = await fetchFileBlob(`/api/documents/${id}/pdf`);
      if (blob) triggerBlobDownload(blob, `${label}.pdf`);
      done++;
      onProgress(done, total);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

async function downloadAsZip(
  ids: string[],
  type: "xml" | "pdf" | "both",
  documents: any[],
  onProgress: (done: number, total: number) => void
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const total = ids.length * (type === "both" ? 2 : 1);
  let done = 0;

  for (const id of ids) {
    const doc = documents.find((d: any) => d.id === id);
    const label = doc?.document_id ?? doc?.ion_ap_transaction_id ?? id.slice(0, 8);

    if (type === "xml" || type === "both") {
      const blob = await fetchFileBlob(`/api/documents/${id}/xml`);
      if (blob) zip.file(`${label}.xml`, blob);
      done++;
      onProgress(done, total);
    }
    if (type === "pdf" || type === "both") {
      const blob = await fetchFileBlob(`/api/documents/${id}/pdf`);
      if (blob) zip.file(`${label}.pdf`, blob);
      done++;
      onProgress(done, total);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().split("T")[0];
  triggerBlobDownload(zipBlob, `invoices-${date}.zip`);
}

export function InboxList({
  initialDocuments,
  total,
  unreadCount,
  nextCursor: initialCursor,
  companyFilter,
  canTriage,
  isSuperAdmin,
  filters,
}: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [cursor, setCursor] = useState(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [departments, setDepartments] = useState<Record<string, Department[]>>({});
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const { toast } = useToast();

  // Sync with server data when props change (after router.refresh)
  useEffect(() => {
    setDocuments(initialDocuments);
    setCursor(initialCursor);
    setIsRefreshing(false);
  }, [initialDocuments, initialCursor]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
  }, [router]);

  useEffect(() => {
    const companyIds = [...new Set(documents.map((d: any) => d.company_id).filter(Boolean))];
    for (const cid of companyIds) {
      if (!departments[cid]) {
        fetch(`/api/departments/by-company?companyId=${cid}`)
          .then((r) => r.json())
          .then((data) => setDepartments((prev) => ({ ...prev, [cid]: data })))
          .catch(() => {});
      }
    }
  }, [documents]);

  const loadMore = async () => {
    if (!cursor) return;
    setIsLoadingMore(true);
    const params = new URLSearchParams();
    params.set("cursor", cursor);
    params.set("limit", "20");
    if (companyFilter) params.set("company", companyFilter);
    const res = await fetch(`/api/documents/list?${params}`);
    const data = await res.json();
    setDocuments((prev: any[]) => [...prev, ...data.documents]);
    setCursor(data.nextCursor);
    setIsLoadingMore(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(documents.map((d: any) => d.id)));
  };

  const handleBulkAssign = async (departmentId: string) => {
    setIsBulkAssigning(true);
    const result = await bulkAssignDocuments(Array.from(selectedIds), departmentId);
    setIsBulkAssigning(false);
    if (result.error) { toast(result.error, "error"); } else {
      toast(`${result.count} document(s) assigned`);
      setSelectedIds(new Set());
      window.location.reload();
    }
  };

  const handleBulkDownload = async (type: "xml" | "pdf" | "both") => {
    const ids = Array.from(selectedIds);
    setIsDownloading(true);
    setDownloadProgress("");

    const onProgress = (done: number, total: number) => {
      setDownloadProgress(`${done}/${total}`);
    };

    try {
      if (ids.length >= ZIP_THRESHOLD) {
        await downloadAsZip(ids, type, documents, onProgress);
        toast(`Downloaded ${ids.length} document(s) as ZIP`);
      } else {
        await downloadIndividual(ids, type, documents, onProgress);
        toast(`Downloaded ${ids.length} document(s)`);
      }
    } catch {
      toast("Some downloads failed", "error");
    }
    setIsDownloading(false);
    setDownloadProgress("");
  };

  const allDepts = Object.values(departments).flat();
  const uniqueDepts = allDepts.filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inbox</h1>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} unread</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{total} documents</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {filters}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>

          {/* Triage actions — left side */}
          {canTriage && (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button size="sm" disabled={isBulkAssigning}>
                  <FolderInput className="mr-2 h-4 w-4" />
                  {isBulkAssigning ? "Assigning..." : "Assign to"}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              } />
              <DropdownMenuContent align="start" className="w-[200px]">
                {uniqueDepts.length === 0 ? (
                  <DropdownMenuItem disabled>No departments</DropdownMenuItem>
                ) : (
                  uniqueDepts.map((d) => (
                    <DropdownMenuItem key={d.id} onClick={() => handleBulkAssign(d.id)}>
                      {d.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Divider between triage and download */}
          {canTriage && <div className="h-5 w-px bg-border" />}

          {/* Download actions — right side */}
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button size="sm" variant="outline" disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? `Downloading ${downloadProgress}...` : "Download"}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            } />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkDownload("xml")}>
                Download XML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkDownload("pdf")}>
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkDownload("both")}>
                Download Both
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground underline">Clear</button>
        </div>
      )}

      {!isSuperAdmin && documents.some((d: any) => !d.billed_at && ["new", "read", "assigned", "processed"].includes(d.status)) && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-900 dark:bg-yellow-950">
          <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Some documents are locked due to insufficient wallet balance.
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">Top up your wallet to unlock all documents.</p>
          </div>
          <Link href="/dashboard/wallet" className="shrink-0">
            <Button size="sm" variant="outline">Top Up</Button>
          </Link>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Mail className="h-12 w-12" />
          <p className="text-lg">No documents received yet</p>
          <p className="text-sm">Documents will appear here when your companies receive Peppol invoices.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]">
                    <input type="checkbox" checked={selectedIds.size === documents.length && documents.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </TableHead>
                  <TableHead className="w-[30px]" />
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {canTriage && <TableHead>Department</TableHead>}
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => {
                  const isUnread = doc.status === "new";
                  const isPending = doc.status === "pending" || doc.status === "processing";
                  const isFailed = doc.status === "failed";
                  const isSelected = selectedIds.has(doc.id);
                  const companyDepts = departments[doc.company_id] ?? [];
                  const isLocked = !isSuperAdmin && !doc.billed_at && ["new", "read", "assigned", "processed"].includes(doc.status);
                  const canDownloadPdf = !isPending && !isFailed && !isLocked;

                  return (
                    <TableRow
                      key={doc.id}
                      className={cn(
                        "group",
                        isUnread && "bg-muted/30",
                        isFailed && "bg-destructive/5",
                        isSelected && "bg-primary/5",
                        isLocked && "opacity-60",
                        !isLocked && !isPending && "cursor-pointer hover:bg-muted/50 transition-colors"
                      )}
                      onClick={() => {
                        if (!isLocked && !isPending) router.push(`/dashboard/inbox/${doc.id}`);
                      }}
                    >
                      <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="rounded" />
                      </TableCell>
                      <TableCell className="pr-0">
                        {isFailed ? <AlertCircle className="h-4 w-4 text-destructive" />
                          : isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          : isUnread ? <Mail className="h-4 w-4 text-primary" />
                          : <MailOpen className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        {isLocked ? (
                          <div className="select-none">
                            <div className="flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className={cn("text-sm blur-sm", isUnread ? "font-semibold" : "font-normal")}>
                                {doc.metadata?.supplierName ?? doc.sender_identifier ?? "Unknown sender"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground blur-sm">
                              {documentTypeLabel(doc.document_type)} {doc.document_id ?? ""}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className={cn("text-sm", isUnread ? "font-semibold" : "font-normal")}>
                              {doc.metadata?.supplierName ?? doc.sender_identifier ?? "Unknown sender"}
                            </span>
                            {doc.metadata?.lineItems && doc.metadata.lineItems.length > 0 && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground max-w-[300px]">
                                {doc.metadata.lineItems.slice(0, 3).join(", ")}
                                {doc.metadata.lineItems.length > 3 && "..."}
                              </p>
                            )}
                            {!doc.metadata?.lineItems && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                <FileText className="mr-1 inline h-3 w-3" />
                                {documentTypeLabel(doc.document_type)} {doc.document_id ?? ""}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right text-sm font-medium", isLocked && "blur-sm select-none")}>
                        {doc.metadata?.totalAmount ? (
                          <span>{doc.metadata.totalAmount} {doc.metadata.currency ?? ""}</span>
                        ) : "-"}
                      </TableCell>
                      {canTriage && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DeptPicker
                            documentId={doc.id}
                            companyId={doc.company_id}
                            currentDeptId={doc.department_id}
                            departments={companyDepts}
                            onAssigned={() => window.location.reload()}
                          />
                        </TableCell>
                      )}
                      <TableCell className={cn("text-right text-sm", isUnread && "font-semibold")}>
                        {doc.peppol_created_at ? formatDate(doc.peppol_created_at) : "-"}
                      </TableCell>
                      <TableCell className="pr-3" onClick={(e) => e.stopPropagation()}>
                        {canDownloadPdf && (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                            title="View PDF"
                            onClick={() => window.open(`/api/documents/${doc.id}/pdf`, "_blank")}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <LoadMore hasMore={!!cursor} isLoading={isLoadingMore} onLoadMore={loadMore} loadedCount={documents.length} total={total} />
        </>
      )}
    </div>
  );
}
