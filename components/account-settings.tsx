"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/workspace/actions";

export function AccountSettings() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const nextPassword = String(form.get("nextPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await changePasswordAction(currentPassword, nextPassword, confirmPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formElement.reset();
      setMessage("Your password was changed.");
    } catch {
      setError("The password could not be changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Change your password whenever you need to. Enter the current password, then choose a new one.
        </p>
      </div>
      <form className="flex flex-col gap-4" method="post" data-hydrated={hydrated ? "true" : "false"} onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="next-password">New password</Label>
          <Input
            id="next-password"
            name="nextPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </div>
  );
}
