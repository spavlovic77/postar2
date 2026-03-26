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

      {/* Bottom bar — Slovak flag accent */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-white dark:bg-[#0a0a0a]" />
        <div className="flex-1 bg-[#0B4EA2]" />
        <div className="flex-1 bg-[#EE1C25]" />
      </div>
    </div>
  );
}
