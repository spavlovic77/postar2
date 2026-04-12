"use client";

import { useState } from "react";

export default function AuctionAdminPage() {
  const [password, setPassword] = useState("");
  const [bid, setBid] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "ok"; bid: number } | { kind: "err"; msg: string } | { kind: "loading" }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/auction/update-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, bid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error ?? "Chyba" });
        return;
      }
      setStatus({ kind: "ok", bid: data.bid });
      setBid("");
    } catch {
      setStatus({ kind: "err", msg: "Sieťová chyba" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0a0a0a] px-6 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-[#e5e7eb] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#141414] p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-[#111827] dark:text-[#f3f4f6]">
            Aukcia — aktualizácia ponuky
          </h1>
          <p className="mt-1 text-xs text-[#6b7280] dark:text-[#9ca3af]">
            Zadajte heslo a novú najvyššiu ponuku v EUR.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#4b5563] dark:text-[#9ca3af]">
            Heslo
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="off"
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#0B4EA2]"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#4b5563] dark:text-[#9ca3af]">
            Nová najvyššia ponuka (EUR)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            required
            className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm text-[#111827] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#0B4EA2]"
          />
        </div>

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="w-full rounded-lg bg-[#0B4EA2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#093d80] disabled:opacity-60 transition-colors"
        >
          {status.kind === "loading" ? "Ukladám…" : "Uložiť"}
        </button>

        {status.kind === "ok" && (
          <p className="text-xs text-green-600 dark:text-green-400">
            Uložené. Nová najvyššia ponuka: {status.bid.toFixed(2)} €
          </p>
        )}
        {status.kind === "err" && (
          <p className="text-xs text-red-600 dark:text-red-400">{status.msg}</p>
        )}

        <div className="pt-2 border-t border-[#e5e7eb] dark:border-[#2a2a2a]">
          <a
            href="/auction"
            className="text-xs text-[#9ca3af] dark:text-[#6b7280] hover:text-[#4b5563] dark:hover:text-[#9ca3af] transition-colors"
          >
            ← Stránka aukcie
          </a>
        </div>
      </form>
    </div>
  );
}
