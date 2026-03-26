import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedPeppolboxLogo } from "@/components/animated-peppolbox-logo";
import { getPfsActivationLink } from "@/lib/settings";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const registerLink = await getPfsActivationLink();

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#0a0a0a]">
      {/* Hero section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg space-y-8 text-center">
          {/* Animated logo */}
          <AnimatedPeppolboxLogo />

          {/* Tagline */}
          <p className="text-lg md:text-xl text-[#4b5563] dark:text-[#9ca3af] leading-relaxed">
            Your electronic invoice mailbox on the Peppol network
          </p>

          {/* Sign in */}
          <div className="pt-2">
            <AuthModal />
          </div>

          {/* Divider */}
          {registerLink && (
            <>
              <div className="flex items-center gap-4 pt-2">
                <div className="h-px flex-1 bg-[#e5e7eb] dark:bg-[#2a2a2a]" />
                <span className="text-xs font-medium uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280]">
                  New company?
                </span>
                <div className="h-px flex-1 bg-[#e5e7eb] dark:bg-[#2a2a2a]" />
              </div>

              {/* Register CTA */}
              <div className="space-y-2">
                <a
                  href={registerLink}
                  className="inline-flex items-center justify-center rounded-lg bg-[#0B4EA2] px-8 py-3 text-base font-semibold text-white hover:bg-[#093d80] transition-colors shadow-sm"
                >
                  Register at your Digital Postman
                </a>
                <p className="text-xs text-[#9ca3af] dark:text-[#6b7280]">
                  You will be redirected to the Tax Administration office portal
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-4 pt-2 text-center space-y-3">
        <p className="text-[11px] text-[#b0b0b0] dark:text-[#555] leading-relaxed">
          This is a demo version for educational purposes only.
          Support Peppol e-invoicing at{" "}
          <a
            href="https://www.financnasprava.sk"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#888] dark:hover:text-[#777] transition-colors"
          >
            financnasprava.sk
          </a>
        </p>
        <a
          href="https://github.com/spavlovic77/postar2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-[#b0b0b0] dark:text-[#555] hover:text-[#888] dark:hover:text-[#777] transition-colors"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Source code
        </a>
      </footer>

      {/* Bottom bar — Slovak flag accent */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-white dark:bg-[#0a0a0a]" />
        <div className="flex-1 bg-[#0B4EA2]" />
        <div className="flex-1 bg-[#EE1C25]" />
      </div>
    </div>
  );
}
