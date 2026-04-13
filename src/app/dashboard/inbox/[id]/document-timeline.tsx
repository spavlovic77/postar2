"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, FolderInput, Mail, FileText, CreditCard, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDocumentNote } from "./actions";

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
  entries: TimelineEntry[];
  documentId: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  check: CheckCircle2,
  folder: FolderInput,
  file: FileText,
  card: CreditCard,
  send: Send,
  comment: MessageSquare,
};

function formatTime(date: string) {
  return new Date(date).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function DocumentTimeline({ entries, documentId }: Props) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setIsSubmitting(true);
    const result = await addDocumentNote(documentId, note);
    setIsSubmitting(false);
    if (!result.error) {
      setNote("");
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddNote()}
            placeholder="Add a note..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={isSubmitting || !note.trim()}
          >
            {isSubmitting ? "..." : "Add"}
          </Button>
        </div>

        {/* Timeline */}
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const Icon = ICONS[entry.icon] ?? MessageSquare;
              const isNote = entry.type === "note";

              return (
                <div key={entry.id} className={cn("flex gap-3 text-sm", isNote && "bg-muted/30 rounded-lg p-3")}>
                  <div className="mt-0.5">
                    <Icon className={cn("h-4 w-4", isNote ? "text-blue-500" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("font-medium", isNote && "text-blue-700 dark:text-blue-300")}>
                        {entry.title}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                    {entry.detail && (
                      <p className="text-muted-foreground mt-0.5">{entry.detail}</p>
                    )}
                    {entry.actor && (
                      <p className="text-xs text-muted-foreground mt-0.5">by {entry.actor}</p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
