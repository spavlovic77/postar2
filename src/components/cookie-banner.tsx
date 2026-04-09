"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STORAGE_KEY = "peppolbox_cookie_consent";

type Consent = "accepted" | "rejected" | null;

function getStoredConsent(): Consent {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "rejected" ? v : null;
}

function setStoredConsent(value: "accepted" | "rejected") {
  localStorage.setItem(STORAGE_KEY, value);
  // Notify any listeners
  window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: value }));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) {
      // Slight delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    setStoredConsent("accepted");
    setVisible(false);
  };

  const handleReject = () => {
    setStoredConsent("rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-lg border bg-background p-4 shadow-lg md:left-auto md:right-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 text-sm">
          <p className="font-medium mb-1">Súbory cookies</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Používame nevyhnutné funkčné cookies pre prevádzku služby. So súhlasom používame aj
            anonymnú analytiku (Vercel Analytics) na zlepšovanie aplikácie.{" "}
            <Link href="/legal/ochrana-udajov" className="underline hover:no-underline">
              Viac informácií
            </Link>
            .
          </p>
        </div>
        <button
          onClick={handleReject}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Zatvoriť"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleReject}>
          Iba nevyhnutné
        </Button>
        <Button size="sm" onClick={handleAccept}>
          Prijať všetky
        </Button>
      </div>
    </div>
  );
}
