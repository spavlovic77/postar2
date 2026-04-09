import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Späť
          </Link>
          <span className="text-lg font-bold">peppolbox.sk</span>
        </div>
      </div>

      <nav className="border-b bg-muted/30">
        <div className="mx-auto max-w-3xl px-6 py-3 flex flex-wrap items-center gap-4 text-sm">
          <Link href="/legal/vop" className="text-muted-foreground hover:text-foreground transition-colors">
            VOP
          </Link>
          <Link href="/legal/ochrana-udajov" className="text-muted-foreground hover:text-foreground transition-colors">
            Ochrana osobných údajov
          </Link>
          <Link href="/legal/dpa" className="text-muted-foreground hover:text-foreground transition-colors">
            DPA
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
