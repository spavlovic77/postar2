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
import { MoreHorizontal, MailOpen, Mail, FileDown } from "lucide-react";
import { markDocumentUnread } from "./actions";

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

  const handleDownloadPdf = () => {
    window.open(`/api/documents/${documentId}/pdf`, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "new" && (
          <DropdownMenuItem onClick={handleMarkUnread} disabled={isLoading}>
            <Mail className="mr-2 h-4 w-4" />
            Mark as unread
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleDownloadPdf}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
