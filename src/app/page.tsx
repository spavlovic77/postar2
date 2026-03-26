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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <AnimatedPeppolboxLogo />
      <p className="text-muted-foreground">Sign in to get started</p>
      <AuthModal />
      {registerLink && (
        <a
          href={registerLink}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
        >
          Register at your Digital Postman
        </a>
      )}
    </div>
  );
}
