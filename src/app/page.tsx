import { createClient } from "@/lib/supabase/server";
import { AuthModal } from "@/components/auth-modal";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight">Postar</h1>
        <p className="text-muted-foreground">Sign in to get started</p>
        <AuthModal />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight">Hello, World!</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email ?? user.user_metadata?.full_name ?? "User"}
      </p>
      <SignOutButton />
    </div>
  );
}
