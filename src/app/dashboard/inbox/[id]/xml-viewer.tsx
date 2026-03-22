"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function XmlViewer({ documentId }: { documentId: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/xml`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [documentId]);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Failed to load XML document.
      </p>
    );
  }

  if (content === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs font-mono">
      {content}
    </pre>
  );
}
