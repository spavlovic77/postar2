"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function XmlViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Failed to load XML document.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          Download directly
        </a>
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
