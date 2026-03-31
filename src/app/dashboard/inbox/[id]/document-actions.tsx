"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MoreHorizontal, FileDown, FileCode2, RefreshCw, CheckCircle2, Undo2 } from "lucide-react";
import { retryDocument, markDocumentProcessed, returnDocumentToTriage } from "./actions";

interface Props {
  documentId: string;
  status: string;
  ionApTransactionId: number;
}

export function DocumentActions({ documentId, status, ionApTransactionId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
  const [showExportXml, setShowExportXml] = useState(false);
  const [showReturnTriage, setShowReturnTriage] = useState(false);
  const [note, setNote] = useState("");
  const router = useRouter();

  const handleRetry = async () => {
    setIsLoading(true);
    await retryDocument(documentId);
    setIsLoading(false);
    router.refresh();
  };

  const handleMarkProcessed = async () => {
    if (!note.trim()) return;
    setIsLoading(true);
    const result = await markDocumentProcessed(documentId, note);
    setIsLoading(false);
    if (!result.error) {
      setShowProcessed(false);
      setNote("");
      router.refresh();
    }
  };

  const handleReturnToTriage = async () => {
    if (!note.trim()) return;
    setIsLoading(true);
    const result = await returnDocumentToTriage(documentId, note);
    setIsLoading(false);
    if (!result.error) {
      setShowReturnTriage(false);
      setNote("");
      router.push("/dashboard/inbox");
    }
  };

  const handleExportXmlAndProcess = async () => {
    if (!note.trim()) return;
    setIsLoading(true);
    // Download XML first
    window.open(`/api/documents/${documentId}/xml`, "_blank");
    // Then mark as processed
    const result = await markDocumentProcessed(documentId, note);
    setIsLoading(false);
    if (!result.error) {
      setShowExportXml(false);
      setNote("");
      router.refresh();
    }
  };

  const handleDownloadPdf = () => {
    window.open(`/api/documents/${documentId}/pdf`, "_blank");
  };

  const isPendingOrFailed = status === "pending" || status === "failed";
  const canMarkProcessed = ["read", "assigned", "new"].includes(status);
  const canReturnToTriage = status === "assigned";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isPendingOrFailed && (
            <DropdownMenuItem onClick={handleRetry} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Processing
            </DropdownMenuItem>
          )}
          {canMarkProcessed && (
            <>
              <DropdownMenuItem onClick={() => { setNote(""); setShowExportXml(true); }} disabled={isLoading}>
                <FileCode2 className="mr-2 h-4 w-4" />
                Export XML & Process
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNote(""); setShowProcessed(true); }} disabled={isLoading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark as Processed
              </DropdownMenuItem>
            </>
          )}
          {canReturnToTriage && (
            <DropdownMenuItem onClick={() => { setNote(""); setShowReturnTriage(true); }} disabled={isLoading}>
              <Undo2 className="mr-2 h-4 w-4" />
              Return to Triage
            </DropdownMenuItem>
          )}
          {!isPendingOrFailed && (
            <DropdownMenuItem onClick={handleDownloadPdf}>
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showReturnTriage && (
        <Dialog open onOpenChange={(open) => !open && setShowReturnTriage(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return to Triage</DialogTitle>
              <DialogDescription>
                This will unassign the document from your department and return it to the triage queue. Please explain why.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Wrong department, this is an IT invoice not accounting..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReturnTriage(false)}>Cancel</Button>
              <Button onClick={handleReturnToTriage} disabled={isLoading || !note.trim()}>
                {isLoading ? "Returning..." : "Return to Triage"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showExportXml && (
        <Dialog open onOpenChange={(open) => !open && setShowExportXml(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export XML & Mark as Processed</DialogTitle>
              <DialogDescription>
                The XML file is the legally valid electronic invoice. Exporting it will mark this document as processed. Add a note for the audit trail.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Exported to accounting system..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportXml(false)}>Cancel</Button>
              <Button onClick={handleExportXmlAndProcess} disabled={isLoading || !note.trim()}>
                {isLoading ? "Exporting..." : "Export XML & Process"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showProcessed && (
        <Dialog open onOpenChange={(open) => !open && setShowProcessed(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Processed</DialogTitle>
              <DialogDescription>
                Add a note describing how this document was processed.
              </DialogDescription>
            </DialogHeader>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Payment verified, forwarded to accounting..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProcessed(false)}>Cancel</Button>
              <Button onClick={handleMarkProcessed} disabled={isLoading || !note.trim()}>
                {isLoading ? "Saving..." : "Mark as Processed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
