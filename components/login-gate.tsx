import { connection } from "next/server";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/components/login-screen";
import { hasActiveAdminCredential } from "@/lib/workspace/accounts";
import { portalPath } from "@/lib/workspace/access";
import { currentActor } from "@/lib/workspace/session";
import { readWorkspace } from "@/lib/workspace/store";

export async function LoginGate() {
  await connection();
  const actor = await currentActor();
  if (actor) redirect(portalPath(actor.role));
  const state = await readWorkspace();
  return <LoginScreen ready={hasActiveAdminCredential(state)} />;
}
