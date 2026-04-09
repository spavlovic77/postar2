"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { activateCompanyOnPeppol, recordTosAcceptance } from "@/lib/actions";
import { Check, FileText, ShieldCheck, ExternalLink } from "lucide-react";

type Status = "consent" | "activating" | "success" | "error";

const VOP_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

export function ActivateContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");
  const companyName = searchParams.get("name");

  const [status, setStatus] = useState<Status>("consent");
  const [peppolId, setPeppolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ToS gate state
  const [vopDownloadedAt, setVopDownloadedAt] = useState<string | null>(null);
  const [privacyDownloadedAt, setPrivacyDownloadedAt] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setStatus("error");
      setError("Chýbajú údaje o spoločnosti.");
    }
  }, [companyId]);

  const handleDownload = (
    type: "vop" | "privacy",
    setter: (ts: string) => void,
  ) => {
    const url = type === "vop" ? "/legal/vop" : "/legal/ochrana-udajov";
    window.open(url, "_blank", "noopener,noreferrer");
    setter(new Date().toISOString());
  };

  const handleConfirmAndActivate = async () => {
    if (!companyId || !vopDownloadedAt || !privacyDownloadedAt || !agreed) return;
    setSubmitting(true);

    // 1. Record ToS acceptance
    await recordTosAcceptance({
      vopVersion: VOP_VERSION,
      privacyVersion: PRIVACY_VERSION,
      vopDownloadedAt,
      privacyDownloadedAt,
    });

    // 2. Run activation
    setStatus("activating");
    const result = await activateCompanyOnPeppol(companyId);
    setSubmitting(false);

    if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      setStatus("success");
      setPeppolId(result.peppolId ?? null);
    }
  };

  const canSubmit = !!vopDownloadedAt && !!privacyDownloadedAt && agreed && !submitting;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-lg space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-center">peppolbox.sk</h1>

        {status === "consent" && (
          <>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">
                Súhlas s podmienkami pred aktiváciou
              </h2>
              <p className="text-sm text-muted-foreground">
                Pred dokončením aktivácie spoločnosti{companyName ? ` ${companyName}` : ""} si
                prosím stiahnite oba dokumenty a potvrďte súhlas.
              </p>
            </div>

            <div className="space-y-3">
              {/* VOP download */}
              <button
                onClick={() => handleDownload("vop", setVopDownloadedAt)}
                className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                  vopDownloadedAt ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
                }`}
              >
                <div className="flex-shrink-0">
                  {vopDownloadedAt ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Všeobecné obchodné podmienky</p>
                  <p className="text-xs text-muted-foreground">
                    {vopDownloadedAt ? "Stiahnuté ✓" : "Kliknite pre stiahnutie"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              {/* Privacy download */}
              <button
                onClick={() => handleDownload("privacy", setPrivacyDownloadedAt)}
                className={`w-full flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                  privacyDownloadedAt ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
                }`}
              >
                <div className="flex-shrink-0">
                  {privacyDownloadedAt ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Zásady ochrany osobných údajov</p>
                  <p className="text-xs text-muted-foreground">
                    {privacyDownloadedAt ? "Stiahnuté ✓" : "Kliknite pre stiahnutie"}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* Consent checkbox */}
            <label
              className={`flex items-start gap-3 rounded-lg border p-4 text-sm cursor-pointer transition-colors ${
                vopDownloadedAt && privacyDownloadedAt
                  ? "hover:bg-muted/50"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!vopDownloadedAt || !privacyDownloadedAt}
                className="mt-0.5 rounded"
              />
              <span>
                Súhlasím so Všeobecnými obchodnými podmienkami a Zásadami ochrany osobných údajov
                služby peppolbox.sk a potvrdzujem, že som ich obsah prečítal/a a porozumel/a mu.
              </span>
            </label>

            <button
              onClick={handleConfirmAndActivate}
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Ukladám súhlas..." : "Súhlasím a pokračovať v aktivácii"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              Bez stiahnutia oboch dokumentov a potvrdenia súhlasu nie je možné aktiváciu dokončiť.
            </p>
          </>
        )}

        {status === "activating" && (
          <>
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">
                Aktivujem{companyName ? ` ${companyName}` : " vašu spoločnosť"} na sieti Peppol
              </h2>
              <p className="text-sm text-muted-foreground">
                Registrujem na sieti Peppol, aby ste mohli prijímať elektronické faktúry. Môže to
                trvať niekoľko sekúnd...
              </p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">
                {companyName ? `${companyName} je` : "Vaša spoločnosť je"} aktívna na sieti Peppol!
              </h2>
              {peppolId && (
                <p className="text-sm font-mono bg-muted rounded-md px-3 py-1.5 inline-block">
                  {peppolId}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Teraz môžete prijímať elektronické faktúry cez sieť Peppol. O nových faktúrach vás
                budeme informovať e-mailom.
              </p>
            </div>
            <a
              href="/dashboard"
              className="block w-full text-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Pokračovať na dashboard
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg
                  className="h-7 w-7 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">Aktivácia zlyhala</h2>
              <p className="text-sm text-muted-foreground">
                {error ?? "Pri aktivácii na sieti Peppol nastala chyba."}
              </p>
              <p className="text-sm text-muted-foreground">
                Nemusíte sa obávať — váš účet je pripravený. Administrátor peppolbox.sk pre vás
                aktiváciu zopakuje.
              </p>
            </div>
            <a
              href="/dashboard"
              className="block w-full text-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Pokračovať na dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}
