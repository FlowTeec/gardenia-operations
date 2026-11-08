import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { portalPath, roleMatchesArea, SESSION_COOKIE, SESSION_DAYS } from "./access";
import { createAuthSession, readSessionUser, revokeSession } from "./accounts";
import { hashToken, newSessionToken } from "./password";
import { readWorkspace, updateWorkspace } from "./store";
import type { Area, DemoUser } from "./types";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function actorFromToken(token: string | undefined, nowIso: string): Promise<DemoUser | null> {
  if (!token) return null;
  const state = await readWorkspace();
  return readSessionUser(state, token, nowIso);
}

export async function currentActor(): Promise<DemoUser | null> {
  const jar = await cookies();
  return actorFromToken(jar.get(SESSION_COOKIE)?.value, new Date().toISOString());
}

export async function currentTokenHash(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function enterArea(area: Area, userId?: string) {
  const actor = await currentActor();
  if (!actor) redirect("/");
  if (userId && userId !== actor.id) {
    throw new Error("You cannot act as another person.");
  }
  if (!roleMatchesArea(actor.role, area)) redirect(portalPath(actor.role));
  return actor;
}

export async function startSession(userId: string) {
  const token = newSessionToken();
  const saved = await updateWorkspace((state) =>
    createAuthSession(state, userId, hashToken(token), new Date().toISOString()),
  );
  if (!saved.ok) return saved;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  return { ok: true as const };
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await updateWorkspace((state) => revokeSession(state, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}
