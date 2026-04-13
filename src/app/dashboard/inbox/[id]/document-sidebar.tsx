"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Info, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentTimeline } from "./document-timeline";

interface Details {
  sender: string;
  receiver: string;
  company: string;
  receivedAt: string | null;
  transactionUuid: string;
  ionApTransactionId: string;
  documentType: string;
  direction: string;
}

interface TimelineEntry {
  id: string;
  type: "audit" | "note";
  icon: string;
  title: string;
  detail?: string;
  actor?: string;
  timestamp: string;
}

interface Props {
  details: Details;
  timelineEntries: TimelineEntry[];
  documentId: string;
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STORAGE_KEY = "inbox:sidebarCollapsed";

export function DocumentSidebar({ details, timelineEntries, documentId }: Props) {
  const [tab, setTab] = useState<"details" | "timeline">("details");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-background",
        "md:shrink-0 md:border-l md:transition-[width] md:duration-200",
        collapsed ? "md:w-10" : "md:w-[360px]",
        "max-md:w-full max-md:border-t",
      )}
    >
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden h-10 w-10 items-center justify-center text-muted-foreground hover:bg-accent md:flex"
          aria-label="Open details"
          title="Open details"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          collapsed && "md:hidden",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b px-2 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("details")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                tab === "details"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Info className="h-4 w-4" /> Details
            </button>
            <button
              type="button"
              onClick={() => setTab("timeline")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                tab === "timeline"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <History className="h-4 w-4" /> Timeline
            </button>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:flex"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === "details" ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sender</dt>
                <dd className="mt-1 break-all font-mono">{details.sender}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receiver</dt>
                <dd className="mt-1 break-all font-mono">{details.receiver}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company</dt>
                <dd className="mt-1">{details.company}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Received</dt>
                <dd className="mt-1">{formatDate(details.receivedAt)}</dd>
              </div>
              <div className="border-t pt-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Document Type</dt>
                <dd className="mt-1">{details.documentType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Direction</dt>
                <dd className="mt-1">{details.direction}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transaction UUID</dt>
                <dd className="mt-1 break-all font-mono text-xs">{details.transactionUuid}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ion-AP Transaction ID</dt>
                <dd className="mt-1 font-mono text-xs">{details.ionApTransactionId}</dd>
              </div>
            </dl>
          ) : (
            <DocumentTimeline entries={timelineEntries} documentId={documentId} />
          )}
        </div>
      </div>
    </aside>
  );
}
