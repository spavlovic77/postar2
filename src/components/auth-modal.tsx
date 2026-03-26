"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthForm } from "@/components/auth-form";

export function AuthModal() {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="lg" />}>Sign In</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to peppolbox.sk</DialogTitle>
          <DialogDescription>
            Choose your preferred sign-in method to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <AuthForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
