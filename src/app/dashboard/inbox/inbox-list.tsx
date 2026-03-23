"use client";

import { useState, useEffect } from "react";
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
import { Mail, MailOpen, FileText, AlertCircle, Loader2, FolderInput, ChevronDown, Check } from "lucide-react";
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

export function InboxList({
  initialDocuments,
  total,
  unreadCount,
  nextCursor: initialCursor,
  companyFilter,
  canTriage,
  filters,
}: Props) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [cursor, setCursor] = useState(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [departments, setDepartments] = useState<Record<string, Department[]>>({});
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const { toast } = useToast();

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

  const allDepts = Object.values(departments).flat();
  const uniqueDepts = allDepts.filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inbox</h1>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} unread</Badge>}
        </div>
        <span className="text-sm text-muted-foreground">{total} documents</span>
      </div>

      {filters}

      {selectedIds.size > 0 && canTriage && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
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
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground underline">Clear</button>
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
                  {canTriage && (
                    <TableHead className="w-[30px]">
                      <input type="checkbox" checked={selectedIds.size === documents.length && documents.length > 0} onChange={toggleSelectAll} className="rounded" />
                    </TableHead>
                  )}
                  <TableHead className="w-[30px]" />
                  <TableHead>From</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Document ID</TableHead>
                  {canTriage && <TableHead>Department</TableHead>}
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => {
                  const isUnread = doc.status === "new";
                  const isPending = doc.status === "pending" || doc.status === "processing";
                  const isFailed = doc.status === "failed";
                  const isSelected = selectedIds.has(doc.id);
                  const companyDepts = departments[doc.company_id] ?? [];

                  return (
                    <TableRow
                      key={doc.id}
                      className={cn(
                        isUnread && "bg-muted/30",
                        isFailed && "bg-destructive/5",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {canTriage && (
                        <TableCell className="pr-0">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)} className="rounded" />
                        </TableCell>
                      )}
                      <TableCell className="pr-0">
                        {isFailed ? <AlertCircle className="h-4 w-4 text-destructive" />
                          : isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          : isUnread ? <Mail className="h-4 w-4 text-primary" />
                          : <MailOpen className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/inbox/${doc.id}`} className={cn("hover:underline", isUnread ? "font-semibold" : "font-normal")}>
                          {doc.sender_identifier ?? "Unknown sender"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{documentTypeLabel(doc.document_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{doc.document_id ?? "-"}</TableCell>
                      {canTriage && (
                        <TableCell>
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
