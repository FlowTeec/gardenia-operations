import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { portalPath, SESSION_COOKIE, SESSION_DAYS } from "./access";
import { hashToken, newSessionToken, verifyPassword } from "./password";
import { readWorkspace, updateWorkspace } from "./store";
import type { GardeniaRole, GardeniaUser } from "./types";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function currentActor(): Promise<GardeniaUser | null> {
  // Cache Components prerenders routes. Reading the clock before the request
  // is connected throws "unstable Date.now()" on every authenticated visit.
  await connection();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = Date.now();
  const state = await readWorkspace();

  const session = state.sessions.find(
    (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now
  );
  if (!session) return null;

  return state.users.find((u) => u.id === session.userId && u.active) ?? null;
}

export async function requireActor(allowedRoles?: GardeniaRole[]): Promise<GardeniaUser> {
  const actor = await currentActor();
  if (!actor) redirect("/g/login");
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(actor.role)) {
    redirect(portalPath(actor.role));
  }
  return actor;
}

export async function signIn(
  employeeIdOrEmail: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await readWorkspace();

  const user = state.users.find(
    (u) =>
      u.active &&
      (u.employeeId.toLowerCase() === employeeIdOrEmail.toLowerCase() ||
        u.email.toLowerCase() === employeeIdOrEmail.toLowerCase())
  );

  if (!user) return { ok: false, error: "Invalid credentials." };

  const pw = user.passwordHash;
  if (!pw) return { ok: false, error: "Account not configured." };

  const valid = await verifyPassword(password, pw);
  if (!valid) return { ok: false, error: "Invalid credentials." };

  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await updateWorkspace((ws) => {
    ws.sessions.push({
      userId: user.id,
      tokenHash,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    // Keep only last 100 sessions
    if (ws.sessions.length > 100) {
      ws.sessions = ws.sessions.slice(-100);
    }
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());

  return { ok: true };
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await updateWorkspace((ws) => {
      ws.sessions = ws.sessions.filter((s) => s.tokenHash !== tokenHash);
    });
  }
  jar.delete(SESSION_COOKIE);
}
