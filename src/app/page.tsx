import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthModal } from "@/components/auth-modal";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight">Postar</h1>
      <p className="text-muted-foreground">Sign in to get started</p>
      <AuthModal />
    </div>
  );
}
