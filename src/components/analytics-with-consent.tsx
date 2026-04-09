"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

const STORAGE_KEY = "peppolbox_cookie_consent";

export function AnalyticsWithConsent() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const check = () => {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "accepted");
    };
    check();
    window.addEventListener("cookie-consent-changed", check);
    return () => window.removeEventListener("cookie-consent-changed", check);
  }, []);

  if (!enabled) return null;
  return <Analytics />;
}
