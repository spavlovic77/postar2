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
import { MoreHorizontal, FileDown, RefreshCw, CheckCircle2 } from "lucide-react";
import { retryDocument, markDocumentProcessed } from "./actions";

interface Props {
  documentId: string;
  status: string;
  ionApTransactionId: number;
}

export function DocumentActions({ documentId, status, ionApTransactionId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);
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

  const handleDownloadPdf = () => {
    window.open(`/api/documents/${documentId}/pdf`, "_blank");
  };

  const isPendingOrFailed = status === "pending" || status === "failed";
  const canMarkProcessed = ["read", "assigned", "new"].includes(status);

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
            <DropdownMenuItem onClick={() => setShowProcessed(true)} disabled={isLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark as Processed
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
