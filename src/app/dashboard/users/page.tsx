import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users & Invitations</h1>
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Users className="h-8 w-8" />
        <p>User management coming soon</p>
      </div>
    </div>
  );
}
