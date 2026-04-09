import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export function LegalContent({ content }: Props) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-semibold mt-8 mb-3 border-b pb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-semibold mt-6 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2">{children}</h4>,
          p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 space-y-1 my-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1 my-3">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-border" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-border text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
