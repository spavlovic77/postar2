"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

type Step = "credentials" | "choose_channel" | "enter_code";
type AuthMode = "sign_in" | "sign_up";

interface AuthFormProps {
  redirectTo?: string;
  onSignedIn?: () => void;
  /** Pre-fill phone from invitation/webhook */
  defaultPhone?: string;
}

function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const newCode = value.split("");
    newCode[index] = char;
    const updated = newCode.join("").slice(0, 6);
    onChange(updated);
    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, 5);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          className="h-14 w-11 rounded-lg border border-input bg-background text-center text-2xl font-mono font-bold outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export function AuthForm({ redirectTo, onSignedIn, defaultPhone }: AuthFormProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [isLoading, setIsLoading] = useState<"google" | "apple" | "email" | "code" | "resend" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const callbackUrl = redirectTo
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    : `${window.location.origin}/auth/callback`;

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setIsLoading(provider);
    setError(null);
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading("email");
    setError(null);
    setMessage(null);

    if (mode === "sign_in") {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        setIsLoading(null);
        return;
      }

      await fetch("/api/auth/profile", { method: "POST" });
      setIsLoading(null);

      if (onSignedIn) {
        onSignedIn();
      } else if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
      return;
    }

    // Sign up — move to channel selection
    setIsLoading(null);
    setStep("choose_channel");
  };

  const handleSendCode = async (selectedChannel: "email" | "sms") => {
    setChannel(selectedChannel);
    setIsLoading("email");
    setError(null);

    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        channel: selectedChannel,
        phone: selectedChannel === "sms" ? phone : undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setIsLoading(null);
      if (res.status === 409) {
        // Already registered — switch to sign in
        setStep("credentials");
        setMode("sign_in");
      }
      return;
    }

    setUserId(data.userId);
    setIsLoading(null);
    setStep("enter_code");
    setMessage(
      selectedChannel === "email"
        ? `Code sent to ${email}`
        : `Code sent to ${phone}`
    );
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) return;
    setIsLoading("code");
    setError(null);

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setIsLoading(null);
      return;
    }

    // Account confirmed — now sign in
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(null);
      return;
    }

    await fetch("/api/auth/profile", { method: "POST" });
    setIsLoading(null);

    if (onSignedIn) {
      onSignedIn();
    } else if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  };

  const handleResendCode = async () => {
    if (!channel) return;
    setIsLoading("resend");
    setError(null);
    setCode("");

    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        channel,
        phone: channel === "sms" ? phone : undefined,
      }),
    });

    if (res.ok) {
      setMessage("New code sent!");
    } else {
      const data = await res.json();
      setError(data.error);
    }
    setIsLoading(null);
  };

  const isDisabled = isLoading !== null;

  // Step 3: Enter verification code
  if (step === "enter_code") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Enter verification code</h3>
          {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
        </div>

        <CodeInput value={code} onChange={setCode} disabled={isDisabled} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="h-12 w-full text-base"
          onClick={handleVerifyCode}
          disabled={isDisabled || code.length !== 6}
        >
          {isLoading === "code" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "Verify"
          )}
        </Button>

        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
          onClick={handleResendCode}
          disabled={isDisabled}
        >
          {isLoading === "resend" ? "Sending..." : "Resend code"}
        </button>

        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => { setStep("choose_channel"); setCode(""); setError(null); setMessage(null); }}
        >
          Change verification method
        </button>
      </div>
    );
  }

  // Step 2: Choose verification channel
  if (step === "choose_channel") {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Verify your account</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            How would you like to receive your verification code?
          </p>
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <Button
          variant="outline"
          className="h-12 w-full text-base"
          onClick={() => handleSendCode("email")}
          disabled={isDisabled}
        >
          {isLoading === "email" && channel === "email" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "Send code to my email"
          )}
        </Button>

        <div className="flex flex-col gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+421 9XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <Button
            variant="outline"
            className="h-12 w-full text-base"
            onClick={() => handleSendCode("sms")}
            disabled={isDisabled || !phone}
          >
            {isLoading === "email" && channel === "sms" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "Send code via SMS"
            )}
          </Button>
        </div>

        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => { setStep("credentials"); setError(null); }}
        >
          Back
        </button>
      </div>
    );
  }

  // Step 1: Email + password + OAuth
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="h-12 w-full gap-3 text-base"
        onClick={() => handleOAuthLogin("google")}
        disabled={isDisabled}
      >
        {isLoading === "google" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>
      <Button
        variant="outline"
        className="h-12 w-full gap-3 text-base"
        onClick={() => handleOAuthLogin("apple")}
        disabled={isDisabled}
      >
        {isLoading === "apple" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <AppleIcon />
        )}
        Continue with Apple
      </Button>

      <div className="flex items-center gap-3 py-2">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleCredentials} className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isDisabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            placeholder={mode === "sign_up" ? "Min. 6 characters" : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isDisabled}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="h-12 w-full text-base" disabled={isDisabled}>
          {isLoading === "email" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : mode === "sign_in" ? (
            "Sign In"
          ) : (
            "Continue"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign_in" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => { setMode("sign_up"); setError(null); setMessage(null); }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => { setMode("sign_in"); setError(null); setMessage(null); setStep("credentials"); }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
