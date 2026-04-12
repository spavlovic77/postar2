import type { Metadata } from "next";
import { getAuctionCurrentBid } from "@/lib/settings";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export const metadata: Metadata = {
  title: "Charitatívna aukcia domény peppolbox.sk",
  description:
    "Aukcia domény peppolbox.sk v prospech nadácie Plamienok. Výťažok pôjde v plnej výške organizácii Plamienok n.o.",
};

// Auction ends 26.4.2026 23:59 Europe/Bratislava (CEST = UTC+2)
const AUCTION_END_ISO = "2026-04-26T21:59:00.000Z";
const AUCTION_END_DISPLAY = "26. apríla 2026, 23:59 (Europe/Bratislava)";
const STARTING_PRICE_EUR = 10;
const BID_EMAIL = "stanislav.pavlovic@financnasprava.sk";

export default async function AuctionPage() {
  const currentBid = await getAuctionCurrentBid();
  const isEnded = Date.now() > new Date(AUCTION_END_ISO).getTime();

  const mailtoSubject = encodeURIComponent("Ponuka pre doménu peppolbox.sk");
  const mailtoBody = encodeURIComponent(
    `Dobrý deň,\n\npredkladám ponuku na doménu peppolbox.sk vo výške ___ EUR.\n\nMeno / organizácia: \nKontakt: \n\nĎakujem.`
  );
  const mailtoHref = `mailto:${BID_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#0a0a0a]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-2">
            <a
              href="/"
              className="text-xs text-[#9ca3af] dark:text-[#6b7280] hover:text-[#4b5563] dark:hover:text-[#9ca3af] transition-colors"
            >
              ← Späť na úvod
            </a>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#111827] dark:text-[#f3f4f6]">
              Charitatívna aukcia domény peppolbox.sk
            </h1>
            <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
              Celý výťažok pôjde neziskovej organizácii{" "}
              <a
                href="https://www.plamienok.sk"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[#111827] dark:hover:text-[#f3f4f6]"
              >
                Plamienok n.o.
              </a>
              , ktorá poskytuje paliatívnu a hospicovú starostlivosť deťom.
            </p>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] dark:border-[#2a2a2a] bg-[#fafafa] dark:bg-[#141414] p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280]">
                  Predmet aukcie
                </div>
                <div className="mt-1 text-base font-medium text-[#111827] dark:text-[#f3f4f6]">
                  peppolbox.sk
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280]">
                  Vyvolávacia cena
                </div>
                <div className="mt-1 text-base font-medium text-[#111827] dark:text-[#f3f4f6]">
                  {STARTING_PRICE_EUR.toFixed(2)} €
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280]">
                  Aktuálna najvyššia ponuka
                </div>
                <div className="mt-1 text-2xl font-semibold text-[#0B4EA2] dark:text-[#60a5fa]">
                  {currentBid.toFixed(2)} €
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280]">
                  Koniec aukcie
                </div>
                <div className="mt-1 text-base font-medium text-[#111827] dark:text-[#f3f4f6]">
                  {AUCTION_END_DISPLAY}
                </div>
              </div>
            </div>

            {!isEnded ? (
              <div className="pt-2">
                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center rounded-lg bg-[#0B4EA2] px-6 py-3 text-sm font-semibold text-white hover:bg-[#093d80] transition-colors shadow-sm"
                >
                  Predložiť ponuku e-mailom
                </a>
                <p className="mt-2 text-xs text-[#6b7280] dark:text-[#9ca3af]">
                  Ponuky zasielajte na{" "}
                  <a
                    href={mailtoHref}
                    className="underline underline-offset-2 hover:text-[#111827] dark:hover:text-[#f3f4f6]"
                  >
                    {BID_EMAIL}
                  </a>
                  .
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#e5e7eb] dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] px-4 py-3 text-sm text-[#6b7280] dark:text-[#9ca3af]">
                Aukcia bola ukončená. Ďakujeme všetkým záujemcom.
              </div>
            )}
          </div>

          <div className="space-y-3 text-sm text-[#4b5563] dark:text-[#9ca3af] leading-relaxed">
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#f3f4f6]">
              Pravidlá aukcie
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Ponuky sa predkladajú e-mailom na adresu{" "}
                <a
                  href={mailtoHref}
                  className="underline underline-offset-2 hover:text-[#111827] dark:hover:text-[#f3f4f6]"
                >
                  {BID_EMAIL}
                </a>
                .
              </li>
              <li>Vyvolávacia cena je {STARTING_PRICE_EUR.toFixed(2)} €.</li>
              <li>
                Aukcia končí <strong>{AUCTION_END_DISPLAY}</strong>. Ponuky doručené po tomto termíne nebudú zohľadnené.
              </li>
              <li>Víťazom sa stáva ten, kto predloží najvyššiu platnú ponuku.</li>
              <li>
                Celý výťažok bude venovaný organizácii{" "}
                <a
                  href="https://www.plamienok.sk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#111827] dark:hover:text-[#f3f4f6]"
                >
                  Plamienok n.o.
                </a>
                . Doklad o prevode bude na požiadanie poskytnutý víťazovi aukcie.
              </li>
              <li>
                Aktuálna najvyššia ponuka na tejto stránke je aktualizovaná manuálne a môže mať krátke oneskorenie oproti skutočnému stavu.
              </li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="px-6 pb-4 pt-2 text-center">
        <a
          href="/"
          className="text-[11px] text-[#b0b0b0] dark:text-[#555] hover:text-[#888] dark:hover:text-[#777] transition-colors"
        >
          peppolbox.sk
        </a>
      </footer>

      <div className="flex h-1.5">
        <div className="flex-1 bg-white dark:bg-[#0a0a0a]" />
        <div className="flex-1 bg-[#0B4EA2]" />
        <div className="flex-1 bg-[#EE1C25]" />
      </div>
    </div>
  );
}
