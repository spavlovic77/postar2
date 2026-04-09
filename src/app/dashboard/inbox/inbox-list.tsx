"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Mail, MailOpen, FileText, FileCode2, AlertCircle, Loader2, FolderInput, ChevronDown, ChevronUp, ChevronsUpDown, Check, Lock, RefreshCw, Download, CreditCard } from "lucide-react";
import { LoadMore } from "@/components/ui/load-more";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { assignDocumentToDepartment, bulkAssignDocuments, updateDocumentStatus } from "./triage-actions";
import { bulkMarkDocumentsProcessed, markDocumentProcessed } from "./[id]/actions";
import { TopUpDialog } from "@/app/dashboard/wallet/top-up-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  walletId?: string | null;
  companyCount?: number;
  filters?: React.ReactNode;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  assigned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  processed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pending: "bg-muted text-muted-foreground",
  processing: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function DeptPicker({
  documentId,
  currentDeptId,
  departments,
  onAssigned,
}: {
  documentId: string;
  currentDeptId: string | null;
  departments: Department[];
  onAssigned: (deptId: string | null) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const currentDept = departments.find((d) => d.id === currentDeptId);

  const handleAssign = async (deptId: string | null) => {
    setIsLoading(true);
    const result = await assignDocumentToDepartment(documentId, deptId);
    setIsLoading(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      if (deptId === null) {
        toast("Reset to unassigned");
      } else {
        const dept = departments.find((d) => d.id === deptId);
        toast(`Assigned to ${dept?.name ?? "department"}`);
      }
      onAssigned(deptId);
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
        {currentDeptId && (
          <DropdownMenuItem onClick={() => handleAssign(null)}>
            <Check className="mr-2 h-3.5 w-3.5 opacity-0" />
            <span className="text-muted-foreground">Unassigned</span>
          </DropdownMenuItem>
        )}
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

function RowDownloadButton({
  documentId,
  status,
  canDownload,
  onRequestXmlExport,
}: {
  documentId: string;
  status: string;
  canDownload: boolean;
  onRequestXmlExport: () => void;
}) {
  if (!canDownload) return null;

  const canExportXml = status !== "processed";

  const handleDownloadPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/documents/${documentId}/pdf`, "_blank");
  };

  const handleExportXml = () => {
    onRequestXmlExport();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleDownloadPdf}>
          <FileText className="mr-2 h-3.5 w-3.5" />
          PDF
        </DropdownMenuItem>
        {canExportXml && (
          <DropdownMenuItem onClick={handleExportXml}>
            <FileCode2 className="mr-2 h-3.5 w-3.5" />
            XML &amp; Process
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusPicker({
  documentId,
  currentStatus,
  canEdit,
  isPending,
  isFailed,
  onStatusChanged,
  onRequestProcessedNote,
}: {
  documentId: string;
  currentStatus: string;
  canEdit: boolean;
  isPending: boolean;
  isFailed: boolean;
  onStatusChanged: (status: "new" | "assigned" | "processed") => void;
  onRequestProcessedNote: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const badge = (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      {isFailed && <AlertCircle className="h-3 w-3 text-destructive shrink-0" />}
      <Badge className={cn("text-xs capitalize", STATUS_STYLES[currentStatus] ?? "")}>
        {currentStatus}
      </Badge>
      {canEdit && !isPending && !isFailed && <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />}
    </div>
  );

  // Non-editable or system states — just show the badge
  if (!canEdit || isPending || isFailed) {
    return badge;
  }

  const handleChange = async (newStatus: "new" | "assigned" | "processed") => {
    if (newStatus === currentStatus) return;

    // Processed requires a note — open the dialog instead of direct call
    if (newStatus === "processed") {
      onRequestProcessedNote();
      return;
    }

    setIsLoading(true);
    const result = await updateDocumentStatus(documentId, newStatus);
    setIsLoading(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(`Status changed to ${newStatus}`);
      onStatusChanged(newStatus);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="flex items-center gap-1.5 rounded hover:bg-muted/50 transition-colors"
            onClick={(e) => e.stopPropagation()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : badge}
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-[180px]">
        <DropdownMenuItem onClick={() => handleChange("new")}>
          <Check className={cn("mr-2 h-3.5 w-3.5", currentStatus === "new" ? "opacity-100" : "opacity-0")} />
          <Badge className={cn("text-xs capitalize", STATUS_STYLES.new)}>new</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChange("assigned")}>
          <Check className={cn("mr-2 h-3.5 w-3.5", currentStatus === "assigned" ? "opacity-100" : "opacity-0")} />
          <Badge className={cn("text-xs capitalize", STATUS_STYLES.assigned)}>assigned</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChange("processed")}>
          <Check className={cn("mr-2 h-3.5 w-3.5", currentStatus === "processed" ? "opacity-100" : "opacity-0")} />
          <Badge className={cn("text-xs capitalize", STATUS_STYLES.processed)}>processed</Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SortField = "date" | "amount" | "from" | "status";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = {
  new: 0, assigned: 1, processed: 2, pending: 3, processing: 4, failed: 5,
};

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
  walletId,
  companyCount = 1,
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
  const [showTopUp, setShowTopUp] = useState(false);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportType, setExportType] = useState<"xml" | "pdf" | "both">("xml");
  const [exportNote, setExportNote] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [processedDialog, setProcessedDialog] = useState<{ documentId: string } | null>(null);
  const [processedNote, setProcessedNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [xmlExportDialog, setXmlExportDialog] = useState<{ documentId: string } | null>(null);
  const [xmlExportNote, setXmlExportNote] = useState("");
  const [isXmlExporting, setIsXmlExporting] = useState(false);
  const showToColumn = companyCount > 1 && !companyFilter;
  const { toast } = useToast();

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const sortedDocuments = useMemo(() => {
    const docs = [...documents];
    docs.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "date": {
          const da = a.peppol_created_at ? new Date(a.peppol_created_at).getTime() : 0;
          const db = b.peppol_created_at ? new Date(b.peppol_created_at).getTime() : 0;
          cmp = da - db;
          break;
        }
        case "amount": {
          const aa = parseFloat(a.metadata?.totalAmount ?? "0") || 0;
          const ab = parseFloat(b.metadata?.totalAmount ?? "0") || 0;
          cmp = aa - ab;
          break;
        }
        case "from": {
          const fa = (a.metadata?.supplierName ?? a.sender_identifier ?? "").toLowerCase();
          const fb = (b.metadata?.supplierName ?? b.sender_identifier ?? "").toLowerCase();
          cmp = fa.localeCompare(fb);
          break;
        }
        case "status": {
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return docs;
  }, [documents, sortField, sortDir]);

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
    const idsToAssign = Array.from(selectedIds);
    setIsBulkAssigning(true);
    const result = await bulkAssignDocuments(idsToAssign, departmentId);
    setIsBulkAssigning(false);
    if (result.error) { toast(result.error, "error"); } else {
      toast(`${result.count} document(s) assigned`);
      setSelectedIds(new Set());
      // Update local state instead of full reload
      setDocuments((prev: any[]) =>
        prev.map((d) =>
          idsToAssign.includes(d.id)
            ? { ...d, department_id: departmentId, status: d.status === "new" ? "assigned" : d.status }
            : d
        )
      );
    }
  };

  const handleStatusChanged = (documentId: string, newStatus: "new" | "assigned" | "processed") => {
    setDocuments((prev: any[]) =>
      prev.map((d) => {
        if (d.id !== documentId) return d;
        if (newStatus === "new") {
          return { ...d, status: "new", department_id: null };
        }
        return { ...d, status: newStatus };
      })
    );
  };

  const handleConfirmProcessed = async () => {
    if (!processedDialog || !processedNote.trim()) return;
    setIsProcessing(true);
    const result = await markDocumentProcessed(processedDialog.documentId, processedNote.trim());
    setIsProcessing(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Marked as processed");
      handleStatusChanged(processedDialog.documentId, "processed");
      setProcessedDialog(null);
      setProcessedNote("");
    }
  };

  const handleConfirmXmlExport = async () => {
    if (!xmlExportDialog || !xmlExportNote.trim()) return;
    setIsXmlExporting(true);

    // Download XML as a file (not open in new tab)
    const docId = xmlExportDialog.documentId;
    const doc = documents.find((d: any) => d.id === docId);
    const label = doc?.document_id ?? doc?.ion_ap_transaction_id ?? docId.slice(0, 8);
    const blob = await fetchFileBlob(`/api/documents/${docId}/xml`);
    if (blob) {
      triggerBlobDownload(blob, `${label}.xml`);
    }

    // Then mark as processed
    const result = await markDocumentProcessed(docId, xmlExportNote.trim());
    setIsXmlExporting(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("XML exported, marked as processed");
      handleStatusChanged(docId, "processed");
      setXmlExportDialog(null);
      setXmlExportNote("");
    }
  };

  const handleSingleAssign = (documentId: string, deptId: string | null) => {
    setDocuments((prev: any[]) =>
      prev.map((d) => {
        if (d.id !== documentId) return d;
        if (deptId === null) {
          // Unassign: clear department, reset to new (unless processed)
          return { ...d, department_id: null, status: d.status === "processed" ? d.status : "new" };
        }
        return { ...d, department_id: deptId, status: d.status === "new" ? "assigned" : d.status };
      })
    );
  };

  const handleBulkDownload = (type: "xml" | "pdf" | "both") => {
    if (type === "xml" || type === "both") {
      // XML export marks documents as processed — show confirmation
      setExportType(type);
      setExportNote("");
      setShowExportConfirm(true);
    } else {
      // PDF-only is just visualization — download directly
      performDownload(type);
    }
  };

  const performDownload = async (type: "xml" | "pdf" | "both") => {
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

  const handleExportAndProcess = async () => {
    if (!exportNote.trim()) return;
    setShowExportConfirm(false);

    // 1. Download the files
    await performDownload(exportType);

    // 2. Mark as processed
    const ids = Array.from(selectedIds);
    const result = await bulkMarkDocumentsProcessed(ids, exportNote.trim());
    if (result.error) {
      toast(result.error, "error");
    } else if (result.count && result.count > 0) {
      toast(`${result.count} document(s) marked as processed`);
      setSelectedIds(new Set());
      router.refresh();
    }
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
                    <input type="checkbox" checked={selectedIds.size === sortedDocuments.length && sortedDocuments.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Status
                      {sortField === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("from")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      From
                      {sortField === "from" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  {showToColumn && (
                    <TableHead className="hidden md:table-cell">To</TableHead>
                  )}
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("amount")} className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors">
                      Amount
                      {sortField === "amount" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  {canTriage && <TableHead>Department</TableHead>}
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort("date")} className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors">
                      Date
                      {sortField === "date" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
                    </button>
                  </TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDocuments.map((doc: any) => {
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
                        !isPending && "cursor-pointer hover:bg-muted/50 transition-colors"
                      )}
                      onClick={() => {
                        if (isLocked && walletId) {
                          setPendingDocId(doc.id);
                          setShowTopUp(true);
                        } else if (!isLocked && !isPending) {
                          router.push(`/dashboard/inbox/${doc.id}`);
                        }
                      }}
                    >
                      <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="rounded" />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <StatusPicker
                          documentId={doc.id}
                          currentStatus={doc.status}
                          canEdit={canTriage}
                          isPending={isPending}
                          isFailed={isFailed}
                          onStatusChanged={(s) => handleStatusChanged(doc.id, s)}
                          onRequestProcessedNote={() => { setProcessedNote(""); setProcessedDialog({ documentId: doc.id }); }}
                        />
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
                      {showToColumn && (
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[150px]">
                          {doc.company?.legal_name ?? doc.company?.dic ?? ""}
                        </TableCell>
                      )}
                      <TableCell className={cn("text-right text-sm font-medium", isLocked && "blur-sm select-none")}>
                        {doc.metadata?.totalAmount ? (
                          <span>{doc.metadata.totalAmount} {doc.metadata.currency ?? ""}</span>
                        ) : "-"}
                      </TableCell>
                      {canTriage && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DeptPicker
                            documentId={doc.id}
                            currentDeptId={doc.department_id}
                            departments={companyDepts}
                            onAssigned={(deptId) => handleSingleAssign(doc.id, deptId)}
                          />
                        </TableCell>
                      )}
                      <TableCell className={cn("text-right text-sm", isUnread && "font-semibold")}>
                        {doc.peppol_created_at ? formatDate(doc.peppol_created_at) : "-"}
                      </TableCell>
                      <TableCell className="pr-3" onClick={(e) => e.stopPropagation()}>
                        <RowDownloadButton
                          documentId={doc.id}
                          status={doc.status}
                          canDownload={canDownloadPdf}
                          onRequestXmlExport={() => { setXmlExportNote(""); setXmlExportDialog({ documentId: doc.id }); }}
                        />
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

      {processedDialog && (
        <Dialog open onOpenChange={(open) => !open && setProcessedDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Processed</DialogTitle>
              <DialogDescription>
                Add a note describing how this document was processed.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={processedNote}
              onChange={(e) => setProcessedNote(e.target.value)}
              placeholder="e.g., Payment verified, forwarded to accounting..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setProcessedDialog(null)}>Cancel</Button>
              <Button onClick={handleConfirmProcessed} disabled={isProcessing || !processedNote.trim()}>
                {isProcessing ? "Saving..." : "Mark as Processed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {xmlExportDialog && (
        <Dialog open onOpenChange={(open) => !open && setXmlExportDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export XML &amp; Mark as Processed</DialogTitle>
              <DialogDescription>
                The XML file is the legally valid electronic invoice. Exporting it will mark this document as processed. Add a note for the audit trail.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={xmlExportNote}
              onChange={(e) => setXmlExportNote(e.target.value)}
              placeholder="e.g., Exported to accounting system..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setXmlExportDialog(null)}>Cancel</Button>
              <Button onClick={handleConfirmXmlExport} disabled={isXmlExporting || !xmlExportNote.trim()}>
                {isXmlExporting ? "Exporting..." : "Export XML & Process"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showExportConfirm && (
        <Dialog open onOpenChange={(open) => !open && setShowExportConfirm(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export & Mark as Processed</DialogTitle>
              <DialogDescription>
                Exporting XML marks {selectedIds.size} document(s) as processed. This is the standard workflow for acknowledging receipt of electronic invoices. Add a note for the audit trail.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={exportNote}
              onChange={(e) => setExportNote(e.target.value)}
              placeholder="e.g., Exported to accounting system, batch import #42..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportConfirm(false)}>Cancel</Button>
              <Button onClick={handleExportAndProcess} disabled={isDownloading || !exportNote.trim()}>
                {isDownloading ? "Exporting..." : `Export ${exportType === "both" ? "XML + PDF" : "XML"} & Process`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showTopUp && walletId && (
        <TopUpDialog
          walletId={walletId}
          onClose={() => {
            setShowTopUp(false);
            setPendingDocId(null);
          }}
          onSuccess={() => {
            setShowTopUp(false);
            // Auto-billing runs server-side on topUp. Refresh then navigate.
            router.refresh();
            if (pendingDocId) {
              setTimeout(() => router.push(`/dashboard/inbox/${pendingDocId}`), 1000);
            }
            setPendingDocId(null);
          }}
        />
      )}
    </div>
  );
}
