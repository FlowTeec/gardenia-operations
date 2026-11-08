import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { areaForPath, portalPath, roleMatchesArea } from "@/lib/workspace/access";
import { currentActor } from "@/lib/workspace/session";

export const instant = false;

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: React.ReactNode }) {
  await connection();
  const actor = await currentActor();
  if (!actor) redirect("/");
  const pathname = (await headers()).get("x-mrs-path") ?? "";
  const area = areaForPath(pathname);
  if (area && !roleMatchesArea(actor.role, area)) redirect(portalPath(actor.role));
  return (
    <AppShell
      role={actor.role}
      displayName={actor.displayName}
      teamName={actor.teamName}
      storageNote={
        process.env.VERCEL_ENV === "production"
          ? "Accounts and requests are saved in this deployment's private store."
          : "Demonstration file on this server. It is not the company database."
      }
    >
      {children}
    </AppShell>
  );
}
