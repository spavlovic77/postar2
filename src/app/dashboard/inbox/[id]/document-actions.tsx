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
import { MoreHorizontal, Mail, FileDown, RefreshCw } from "lucide-react";
import { markDocumentUnread, retryDocument } from "./actions";

interface Props {
  documentId: string;
  status: string;
  ionApTransactionId: number;
}

export function DocumentActions({ documentId, status, ionApTransactionId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleMarkUnread = async () => {
    setIsLoading(true);
    await markDocumentUnread(documentId);
    setIsLoading(false);
    router.refresh();
  };

  const handleRetry = async () => {
    setIsLoading(true);
    await retryDocument(documentId);
    setIsLoading(false);
    router.refresh();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/documents/${documentId}/pdf`, "_blank");
  };

  const isPendingOrFailed = status === "pending" || status === "failed";

  return (
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
        {status !== "new" && status !== "pending" && status !== "failed" && (
          <DropdownMenuItem onClick={handleMarkUnread} disabled={isLoading}>
            <Mail className="mr-2 h-4 w-4" />
            Mark as unread
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
  );
}
