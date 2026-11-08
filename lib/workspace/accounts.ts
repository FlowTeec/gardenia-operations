import { LOGIN_FAILED, LOGIN_INACTIVE, LOGIN_UNAVAILABLE, SESSION_DAYS } from "./access";
import { hashPassword, hashToken, passwordPolicy } from "./password";
import type { AccountCredential, DemoUser, Mutation, Role, Workspace } from "./types";

const ROLES: Role[] = ["ADMIN", "SUPERVISOR", "TEAM_LEADER", "STORE_KEEPER", "OPERATION_MANAGER"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BOOTSTRAP_ADMIN_ID = "user-bootstrap-admin";

export { FORGOT_PASSWORD_MESSAGE, LOGIN_FAILED, LOGIN_INACTIVE, LOGIN_UNAVAILABLE } from "./access";

function fail(error: string): Mutation<never> {
  return { ok: false, error };
}

function ok<T>(state: Workspace, data: T, replayed = false): Mutation<T> {
  return { ok: true, state, replayed, data };
}

function copy(state: Workspace) {
  return structuredClone(state);
}

function requireAdmin(actor: DemoUser) {
  if (!actor.active) return "This user is inactive.";
  if (actor.role !== "ADMIN") return "You do not have permission for this action.";
  return null;
}

export function countActiveAdminCredentials(state: Workspace) {
  const credentials = Array.isArray(state.credentials) ? state.credentials : [];
  const users = Array.isArray(state.users) ? state.users : [];
  return credentials.filter((credential) => {
    const user = users.find((item) => item.id === credential.userId);
    return user?.role === "ADMIN" && user.active === true && credential.passwordHash.startsWith("scrypt$");
  }).length;
}

export function hasActiveAdminCredential(state: Workspace) {
  return countActiveAdminCredentials(state) > 0;
}

export function findCredential(state: Workspace, identifier: string): AccountCredential | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return (
    state.credentials.find(
      (credential) =>
        credential.employeeId.toLowerCase() === lower || credential.email.toLowerCase() === lower,
    ) ?? null
  );
}

export function assessLogin(
  state: Workspace,
  identifier: string,
  passwordOk: boolean,
): { ok: true; user: DemoUser } | { ok: false; error: string } {
  if (!hasActiveAdminCredential(state)) return { ok: false, error: LOGIN_UNAVAILABLE };
  const credential = findCredential(state, identifier);
  if (!credential || !credential.passwordHash.startsWith("scrypt$") || !passwordOk) {
    return { ok: false, error: LOGIN_FAILED };
  }
  const user = state.users.find((item) => item.id === credential.userId);
  if (!user || !ROLES.includes(user.role)) return { ok: false, error: LOGIN_FAILED };
  if (!user.active) return { ok: false, error: LOGIN_INACTIVE };
  return { ok: true, user };
}

export function readSessionUser(state: Workspace, token: string, nowIso: string): DemoUser | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = (state.sessions ?? []).find((item) => item.tokenHash === tokenHash);
  if (!session || session.expiresAt <= nowIso) return null;
  const user = state.users.find((item) => item.id === session.userId);
  if (!user || !user.active || !ROLES.includes(user.role)) return null;
  return user;
}

export function createAuthSession(
  state: Workspace,
  userId: string,
  tokenHash: string,
  nowIso: string,
): Mutation<null> {
  const user = state.users.find((item) => item.id === userId);
  if (!user || !user.active || !ROLES.includes(user.role)) return fail("Sign in to continue.");
  const next = copy(state);
  const expiresAt = new Date(new Date(nowIso).getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  next.sessions = (next.sessions ?? []).filter((item) => item.expiresAt > nowIso);
  next.sessions.push({
    id: crypto.randomUUID(),
    tokenHash,
    userId,
    createdAt: nowIso,
    expiresAt,
  });
  return ok(next, null);
}

export function revokeSession(state: Workspace, tokenHash: string): Mutation<null> {
  const next = copy(state);
  next.sessions = (next.sessions ?? []).filter((item) => item.tokenHash !== tokenHash);
  return ok(next, null);
}

export function replaceOwnPassword(
  state: Workspace,
  userId: string,
  passwordHash: string,
  keepTokenHash: string,
): Mutation<null> {
  if (!passwordHash.startsWith("scrypt$")) return fail("The password could not be saved.");
  const next = copy(state);
  const credential = next.credentials.find((item) => item.userId === userId);
  if (!credential) return fail("This account has no password yet. Ask an administrator.");
  credential.passwordHash = passwordHash;
  next.sessions = (next.sessions ?? []).filter(
    (item) => item.userId !== userId || item.tokenHash === keepTokenHash,
  );
  return ok(next, null);
}

export function setEmployeeLogin(
  state: Workspace,
  actor: DemoUser,
  input: { userId: string; employeeId: string; email: string; passwordHash: string | null },
): Mutation<null> {
  const denied = requireAdmin(actor);
  if (denied) return fail(denied);
  const employeeId = input.employeeId.trim();
  const email = input.email.trim().toLowerCase();
  const existing = state.credentials.find((item) => item.userId === input.userId) ?? null;
  if (!employeeId && !email && !input.passwordHash && !existing) return ok(state, null);
  if (!state.users.some((item) => item.id === input.userId)) return fail("That user was not found.");
  if (!employeeId) return fail("Enter an employee ID.");
  if (employeeId.length > 40) return fail("Enter an employee ID of at most 40 characters.");
  if (/\s/.test(employeeId)) return fail("Enter an employee ID without spaces.");
  if (!email || email.length > 120 || !EMAIL.test(email)) return fail("Enter a valid email address.");
  const duplicateId = state.credentials.some(
    (item) => item.userId !== input.userId && item.employeeId.toLowerCase() === employeeId.toLowerCase(),
  );
  if (duplicateId) return fail("That employee ID is already used.");
  const duplicateEmail = state.credentials.some(
    (item) => item.userId !== input.userId && item.email.toLowerCase() === email,
  );
  if (duplicateEmail) return fail("That email address is already used.");
  if (input.passwordHash && !input.passwordHash.startsWith("scrypt$")) {
    return fail("The password could not be saved.");
  }
  const next = copy(state);
  const credential = next.credentials.find((item) => item.userId === input.userId);
  if (credential) {
    credential.employeeId = employeeId;
    credential.email = email;
    if (input.passwordHash) {
      credential.passwordHash = input.passwordHash;
      next.sessions = (next.sessions ?? []).filter((item) => item.userId !== input.userId);
    }
  } else {
    next.credentials.push({
      userId: input.userId,
      employeeId,
      email,
      passwordHash: input.passwordHash ?? "",
    });
  }
  return ok(next, null);
}

export async function provisionInitialAdmin(state: Workspace): Promise<Workspace> {
  const name = process.env.MRS_BOOTSTRAP_ADMIN_NAME?.trim() ?? "";
  const employeeId = process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID?.trim() ?? "";
  const email = process.env.MRS_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD ?? "";
  if (!name || name.length > 80 || !employeeId || employeeId.length > 40 || /\s/.test(employeeId)) {
    return state;
  }
  if (!email || email.length > 120 || !EMAIL.test(email) || passwordPolicy(password)) return state;
  if (hasActiveAdminCredential(state)) return state;
  const credentials = Array.isArray(state.credentials) ? state.credentials : [];
  const taken = credentials.some(
    (credential) =>
      credential.employeeId.toLowerCase() === employeeId.toLowerCase() ||
      credential.email.toLowerCase() === email,
  );
  if (taken) return state;
  if (state.users.some((user) => user.id === BOOTSTRAP_ADMIN_ID && user.role !== "ADMIN")) return state;
  const passwordHash = await hashPassword(password);
  const next = structuredClone(state);
  if (!Array.isArray(next.credentials)) next.credentials = [];
  if (!Array.isArray(next.sessions)) next.sessions = [];
  const user = next.users.find((item) => item.id === BOOTSTRAP_ADMIN_ID);
  if (!user) {
    next.users.push({
      id: BOOTSTRAP_ADMIN_ID,
      displayName: name,
      role: "ADMIN",
      active: true,
      zoneCode: null,
      supervisorId: null,
    });
  } else {
    user.displayName = name;
    user.role = "ADMIN";
    user.active = true;
    user.zoneCode = null;
    user.supervisorId = null;
  }
  const existing = next.credentials.find((credential) => credential.userId === BOOTSTRAP_ADMIN_ID);
  if (existing) {
    existing.employeeId = employeeId;
    existing.email = email;
    existing.passwordHash = passwordHash;
  } else {
    next.credentials.push({
      userId: BOOTSTRAP_ADMIN_ID,
      employeeId,
      email,
      passwordHash,
    });
  }
  return next;
}
