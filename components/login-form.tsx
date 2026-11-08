"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORGOT_PASSWORD_MESSAGE, LOGIN_UNAVAILABLE } from "@/lib/workspace/access";
import { loginAction } from "@/lib/workspace/actions";

export function LoginForm({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(ready ? null : LOGIN_UNAVAILABLE);
  const [pending, setPending] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    try {
      const result = await loginAction(identifier, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.href);
      router.refresh();
    } catch {
      setError("Sign-in could not be completed. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (forgot) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Forgot password?</h2>
        </div>
        <p dir="rtl" lang="ar" role="status" className="text-sm leading-7">
          {FORGOT_PASSWORD_MESSAGE}
        </p>
        <Button type="button" variant="outline" size="lg" className="h-10" onClick={() => setForgot(false)}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Use your employee ID or the email an administrator registered for you.
        </p>
      </div>

      <form className="flex flex-col gap-4" method="post" data-hydrated={hydrated ? "true" : "false"} onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Employee ID or registered email</Label>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            required
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={pending}
              className="h-10 pr-20"
            />
            <button
              type="button"
              className="absolute inset-y-1 right-1 rounded-md px-2 text-sm font-medium text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-pressed={showPassword}
              aria-controls="password"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" className="mt-1 h-10 w-full" disabled={pending} aria-busy={pending}>
          {pending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          ) : null}
          {pending ? "Signing in…" : "Log in"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            An administrator creates every account. There is no public registration.
          </p>
        )}
      </form>

      <button
        type="button"
        className="self-start rounded-md text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setForgot(true)}
      >
        Forgot Password?
      </button>
    </div>
  );
}
