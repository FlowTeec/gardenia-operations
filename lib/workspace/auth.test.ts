import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FORGOT_PASSWORD_MESSAGE, roleMatchesArea } from "./access";
import {
  assessLogin,
  BOOTSTRAP_ADMIN_ID,
  createAuthSession,
  hasActiveAdminCredential,
  LOGIN_FAILED,
  LOGIN_INACTIVE,
  LOGIN_UNAVAILABLE,
  provisionInitialAdmin,
  readSessionUser,
  replaceOwnPassword,
  revokeSession,
  setEmployeeLogin,
} from "./accounts";
import { hashPassword, hashToken, passwordPolicy, verifyPassword } from "./password";
import { addDemoUser, canChangeInventory, createMaterial, normalizeWorkspace, updateDemoUser } from "./rules";
import { USER_IDS, createSeed } from "./seed";
import type { DemoUser, Workspace } from "./types";
import { projectAdmin } from "./views";

const at = "2026-10-28T08:00:00.000Z";
const password = "correct-horse";
const replacement = "replacement-pass";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

async function main() {
assert.equal(passwordPolicy("short"), "Use at least 8 characters.");
assert.equal(passwordPolicy("a".repeat(129)), "Use at most 128 characters.");
assert.equal(passwordPolicy("a".repeat(8)), null);
assert.equal(passwordPolicy("a".repeat(128)), null);

const hash = await hashPassword(password);
const otherHash = await hashPassword(replacement);
assert.equal(hash.startsWith("scrypt$"), true);
assert.equal(hash.includes(password), false);
assert.equal(await verifyPassword(password, hash), true);
assert.equal(await verifyPassword("wrong-password", hash), false);
assert.equal(await verifyPassword(password, "plain-text"), false);

delete process.env.MRS_BOOTSTRAP_ADMIN_NAME;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD;
const skipped = await provisionInitialAdmin(createSeed());
assert.equal(skipped.credentials.length, 0);
assert.equal(skipped.users.some((item) => item.id === BOOTSTRAP_ADMIN_ID), false);

process.env.MRS_BOOTSTRAP_ADMIN_NAME = "System Administrator";
process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID = "ADM-0001";
process.env.MRS_BOOTSTRAP_ADMIN_EMAIL = "store.admin@facility.example";
process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD = "bootstrap-pass-1";
const provisioned = await provisionInitialAdmin(createSeed());
const boot = provisioned.credentials.find((item) => item.userId === BOOTSTRAP_ADMIN_ID);
assert.ok(boot);
assert.equal(boot.employeeId, "ADM-0001");
assert.equal(boot.email, "store.admin@facility.example");
assert.equal(boot.passwordHash.includes("bootstrap-pass-1"), false);
assert.equal(await verifyPassword("bootstrap-pass-1", boot.passwordHash), true);
const again = await provisionInitialAdmin(provisioned);
assert.equal(again.users.filter((item) => item.id === BOOTSTRAP_ADMIN_ID).length, 1);
assert.equal(again.credentials.filter((item) => item.userId === BOOTSTRAP_ADMIN_ID).length, 1);
delete process.env.MRS_BOOTSTRAP_ADMIN_NAME;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD;

const seed = createSeed();
const admin = user(seed, USER_IDS.admin);
const leader = user(seed, USER_IDS.leaderA);
const keeper = user(seed, USER_IDS.storeKeeper);
const manager = user(seed, USER_IDS.operationManager);

delete process.env.MRS_BOOTSTRAP_ADMIN_NAME;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID;
delete process.env.MRS_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD;

assert.equal(hasActiveAdminCredential(seed), false);
assert.deepEqual(assessLogin(seed, "TL-A", true), { ok: false, error: LOGIN_UNAVAILABLE });

const selfRegister = addDemoUser(seed, leader, { displayName: "Self", role: "ADMIN", zoneCode: null });
assert.equal(selfRegister.ok, false);
const selfRole = updateDemoUser(seed, leader, {
  userId: leader.id,
  displayName: leader.displayName,
  role: "ADMIN",
  zoneCode: null,
  active: true,
});
assert.equal(selfRole.ok, false);

const adminLogin = setEmployeeLogin(seed, admin, {
  userId: admin.id,
  employeeId: "ADM-9",
  email: "admin@facility.example",
  passwordHash: hash,
});
assert.equal(adminLogin.ok, true);
if (!adminLogin.ok) throw new Error("admin login");

const created = addDemoUser(adminLogin.state, admin, { displayName: "Floor lead", role: "TEAM_LEADER", zoneCode: "A" });
assert.equal(created.ok, true);
if (!created.ok) throw new Error("create");
const withLogin = setEmployeeLogin(created.state, admin, {
  userId: created.data,
  employeeId: "TL-100",
  email: "floor.lead@facility.example",
  passwordHash: hash,
});
assert.equal(withLogin.ok, true);
if (!withLogin.ok) throw new Error("login");
assert.equal(withLogin.state.credentials[0]?.passwordHash, hash);
assert.equal(JSON.stringify(withLogin.state.credentials).includes(password), false);

const duplicateId = setEmployeeLogin(withLogin.state, admin, {
  userId: USER_IDS.leaderB,
  employeeId: "tl-100",
  email: "other.lead@facility.example",
  passwordHash: hash,
});
assert.equal(duplicateId.ok, false);
if (duplicateId.ok) throw new Error("duplicate id");
assert.equal(duplicateId.error, "That employee ID is already used.");

const duplicateEmail = setEmployeeLogin(withLogin.state, admin, {
  userId: USER_IDS.leaderB,
  employeeId: "TL-200",
  email: "Floor.Lead@facility.example",
  passwordHash: hash,
});
assert.equal(duplicateEmail.ok, false);
if (duplicateEmail.ok) throw new Error("duplicate email");
assert.equal(duplicateEmail.error, "That email address is already used.");

const keeperEdit = setEmployeeLogin(withLogin.state, keeper, {
  userId: keeper.id,
  employeeId: "SK-1",
  email: "store@facility.example",
  passwordHash: hash,
});
assert.equal(keeperEdit.ok, false);
assert.equal(withLogin.state.credentials.length, 2);

const signedIn = assessLogin(withLogin.state, "tl-100", true);
assert.equal(signedIn.ok, true);
if (!signedIn.ok) throw new Error("sign in");
assert.equal(signedIn.user.id, created.data);
const byEmail = assessLogin(withLogin.state, "FLOOR.LEAD@facility.example", true);
assert.equal(byEmail.ok, true);
assert.deepEqual(assessLogin(withLogin.state, "tl-100", false), { ok: false, error: LOGIN_FAILED });
assert.deepEqual(assessLogin(withLogin.state, "missing", true), { ok: false, error: LOGIN_FAILED });

const inactiveState = structuredClone(withLogin.state);
const inactiveUser = inactiveState.users.find((item) => item.id === created.data);
if (!inactiveUser) throw new Error("inactive user");
inactiveUser.active = false;
assert.deepEqual(assessLogin(inactiveState, "TL-100", true), { ok: false, error: LOGIN_INACTIVE });

const session = createAuthSession(withLogin.state, created.data, hashToken("raw-token"), at);
assert.equal(session.ok, true);
if (!session.ok) throw new Error("session");
assert.equal(readSessionUser(session.state, "raw-token", at)?.id, created.data);
assert.equal(readSessionUser(session.state, "other-token", at), null);
const expired = structuredClone(session.state);
expired.sessions[0].expiresAt = "2020-01-01T00:00:00.000Z";
assert.equal(readSessionUser(expired, "raw-token", at), null);
const revoked = revokeSession(session.state, hashToken("raw-token"));
assert.equal(revoked.ok, true);
if (!revoked.ok) throw new Error("revoke");
assert.equal(readSessionUser(revoked.state, "raw-token", at), null);

const second = createAuthSession(session.state, created.data, hashToken("other-token"), at);
assert.equal(second.ok, true);
if (!second.ok) throw new Error("second session");
const changed = replaceOwnPassword(second.state, created.data, otherHash, hashToken("raw-token"));
assert.equal(changed.ok, true);
if (!changed.ok) throw new Error("change");
assert.equal(readSessionUser(changed.state, "raw-token", at)?.id, created.data);
assert.equal(readSessionUser(changed.state, "other-token", at), null);
const changedAgain = replaceOwnPassword(changed.state, created.data, hash, hashToken("raw-token"));
assert.equal(changedAgain.ok, true);

const reset = setEmployeeLogin(second.state, admin, {
  userId: created.data,
  employeeId: "TL-100",
  email: "floor.lead@facility.example",
  passwordHash: otherHash,
});
assert.equal(reset.ok, true);
if (!reset.ok) throw new Error("reset");
assert.equal(reset.state.sessions.some((item) => item.userId === created.data), false);
assert.equal(reset.state.credentials.find((item) => item.userId === created.data)?.passwordHash, otherHash);

const view = projectAdmin(withLogin.state, admin);
const packed = JSON.stringify(view);
assert.equal(packed.includes(password), false);
assert.equal(packed.includes("scrypt$"), false);
assert.equal(view.users.find((item) => item.id === created.data)?.hasPassword, true);
assert.equal(view.users.find((item) => item.id === created.data)?.employeeId, "TL-100");
assert.equal(view.users.find((item) => item.id === created.data)?.teamName, null);
assert.equal(view.users.find((item) => item.employeeId === "")?.hasPassword, false);

const named = addDemoUser(adminLogin.state, admin, {
  displayName: "Night lead",
  role: "TEAM_LEADER",
  zoneCode: "A",
  teamName: "  Night crew  ",
});
assert.equal(named.ok, true);
if (!named.ok) throw new Error("team");
const namedUser = named.state.users.find((item) => item.id === named.data);
assert.equal(namedUser?.teamName, "Night crew");
assert.equal(namedUser?.zoneCode, "A");
assert.equal(namedUser?.supervisorId, USER_IDS.supervisorA);
const namedView = projectAdmin(named.state, admin);
assert.equal(namedView.users.find((item) => item.id === named.data)?.teamName, "Night crew");

const kept = updateDemoUser(named.state, admin, {
  userId: named.data,
  displayName: "Night lead",
  role: "TEAM_LEADER",
  zoneCode: "A",
  active: true,
});
assert.equal(kept.ok, true);
if (!kept.ok) throw new Error("kept");
assert.equal(kept.state.users.find((item) => item.id === named.data)?.teamName, "Night crew");
assert.equal(kept.state.users.find((item) => item.id === named.data)?.supervisorId, USER_IDS.supervisorA);
assert.equal(kept.state.users.find((item) => item.id === named.data)?.zoneCode, "A");

const renamed = updateDemoUser(named.state, admin, {
  userId: named.data,
  displayName: "Night lead",
  role: "TEAM_LEADER",
  zoneCode: "A",
  active: true,
  teamName: "Day crew",
});
assert.equal(renamed.ok, true);
if (!renamed.ok) throw new Error("rename");
const renamedUser = renamed.state.users.find((item) => item.id === named.data);
assert.equal(renamedUser?.teamName, "Day crew");
assert.equal(renamedUser?.supervisorId, USER_IDS.supervisorA);
assert.equal(renamedUser?.zoneCode, "A");

const cleared = updateDemoUser(renamed.state, admin, {
  userId: named.data,
  displayName: "Night lead",
  role: "TEAM_LEADER",
  zoneCode: "A",
  active: true,
  teamName: "   ",
});
assert.equal(cleared.ok, true);
if (!cleared.ok) throw new Error("clear team");
assert.equal(cleared.state.users.find((item) => item.id === named.data)?.teamName, null);
assert.equal(cleared.state.users.find((item) => item.id === named.data)?.supervisorId, USER_IDS.supervisorA);

const tooLong = addDemoUser(adminLogin.state, admin, {
  displayName: "Long team",
  role: "STORE_KEEPER",
  zoneCode: null,
  teamName: "x".repeat(81),
});
assert.equal(tooLong.ok, false);
if (tooLong.ok) throw new Error("long team");
assert.equal(tooLong.error, "Enter a team name of at most 80 characters.");

assert.equal(
  updateDemoUser(seed, admin, {
    userId: admin.id,
    displayName: admin.displayName,
    role: "ADMIN",
    zoneCode: null,
    active: false,
  }).ok,
  false,
);
assert.equal(
  updateDemoUser(seed, admin, {
    userId: admin.id,
    displayName: admin.displayName,
    role: "STORE_KEEPER",
    zoneCode: null,
    active: true,
  }).ok,
  false,
);

const bare = createSeed();
delete (bare as { credentials?: unknown }).credentials;
delete (bare as { sessions?: unknown }).sessions;
const normalized = normalizeWorkspace(bare);
assert.deepEqual(normalized.credentials, []);
assert.deepEqual(normalized.sessions, []);
assert.equal(normalized.requests.length, createSeed().requests.length);
assert.equal(normalized.materials.length, createSeed().materials.length);
assert.equal(normalized.tickets.length, createSeed().tickets.length);

assert.equal(roleMatchesArea("ADMIN", "admin"), true);
assert.equal(roleMatchesArea("ADMIN", "store"), false);
assert.equal(roleMatchesArea("TEAM_LEADER", "leader"), true);
assert.equal(roleMatchesArea("TEAM_LEADER", "admin"), false);
assert.equal(roleMatchesArea("SUPERVISOR", "supervisor"), true);
assert.equal(roleMatchesArea("SUPERVISOR", "operations"), false);
assert.equal(roleMatchesArea("OPERATION_MANAGER", "operations"), true);
assert.equal(roleMatchesArea("OPERATION_MANAGER", "store"), false);
assert.equal(roleMatchesArea("STORE_KEEPER", "store"), true);
assert.equal(roleMatchesArea("STORE_KEEPER", "admin"), false);
assert.equal(roleMatchesArea("STORE_KEEPER", "account"), true);
assert.equal(roleMatchesArea("ADMIN", "account"), true);
assert.equal(FORGOT_PASSWORD_MESSAGE, "إذا نسيت كلمة المرور، يُرجى التواصل مع المشرف المسؤول عنك (Supervisor) لمساعدتك في استعادة إمكانية الدخول.");

assert.equal(canChangeInventory(manager), false);
assert.equal(canChangeInventory(keeper), true);
const inventoryDenied = createMaterial(
  seed,
  manager,
  {
    itemCode: "PST-ZZ01",
    productName: "Should not save",
    activeIngredient: "",
    unit: "PCS",
    currentStock: "1",
    requestable: true,
    categoryId: null,
  },
  at,
);
assert.equal(inventoryDenied.ok, false);

async function checkStoredBootstrap() {
  const directory = await mkdtemp(path.join(tmpdir(), "mrs-auth-"));
  process.env.MRS_DATA_FILE = path.join(directory, "workspace.json");
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL;
  process.env.MRS_BOOTSTRAP_ADMIN_NAME = "System Administrator";
  process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID = "ADM-0001";
  process.env.MRS_BOOTSTRAP_ADMIN_EMAIL = "store.admin@facility.example";
  process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD = "bootstrap-pass-1";
  try {
    const remote = await import("./blob-store");
    process.env.BLOB_READ_WRITE_TOKEN = "not-a-real-token";
    process.env.VERCEL_ENV = "preview";
    assert.equal(remote.blobEnabled(), false);
    process.env.VERCEL_ENV = "production";
    assert.equal(remote.blobEnabled(), true);
    delete process.env.VERCEL_ENV;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(remote.blobEnabled(), false);

    const store = await import("./store");
    const state = await store.readWorkspace();
    const seeded = createSeed();
    assert.equal(state.materials.length, seeded.materials.length);
    assert.equal(state.requests.length, seeded.requests.length);
    assert.equal(state.tickets.length, seeded.tickets.length);
    assert.equal(state.movements.length, seeded.movements.length);
    const credential = state.credentials.find((item) => item.userId === BOOTSTRAP_ADMIN_ID);
    assert.ok(credential);
    assert.equal(await verifyPassword("bootstrap-pass-1", credential.passwordHash), true);
    const repeat = await store.readWorkspace();
    assert.equal(repeat.users.filter((item) => item.id === BOOTSTRAP_ADMIN_ID).length, 1);
    const admin = repeat.users.find((item) => item.id === BOOTSTRAP_ADMIN_ID);
    if (!admin || !credential) throw new Error("admin");
    const saved = await store.updateWorkspace((current) => {
      const created = addDemoUser(current, admin, {
        displayName: "Floor lead 9101",
        role: "TEAM_LEADER",
        zoneCode: "A",
        teamName: "  Night crew  ",
      });
      if (!created.ok) return created;
      return setEmployeeLogin(created.state, admin, {
        userId: created.data,
        employeeId: "TL-9101",
        email: "tl9101@facility.example",
        passwordHash: credential.passwordHash,
      });
    });
    assert.equal(saved.ok, true);
    const raw = await readFile(process.env.MRS_DATA_FILE, "utf8");
    assert.equal(raw.includes("bootstrap-pass-1"), false);
    const parsed = JSON.parse(raw) as Workspace;
    const employee = parsed.users.find((item) => item.displayName === "Floor lead 9101");
    if (!employee) throw new Error("saved employee");
    assert.equal(employee.teamName, "Night crew");
    assert.equal(employee.zoneCode, "A");
    assert.equal(employee.supervisorId, USER_IDS.supervisorA);
    const login = parsed.credentials.find((item) => item.employeeId === "TL-9101");
    if (!login) throw new Error("saved login");
    assert.equal(login.userId, employee.id);
    assert.equal(login.passwordHash.startsWith("scrypt$"), true);
    assert.equal(parsed.materials.length, seeded.materials.length);
    assert.equal(parsed.requests.length, seeded.requests.length);
    assert.equal(parsed.tickets.length, seeded.tickets.length);
    const again = await store.readWorkspace();
    const signed = assessLogin(again, "tl-9101", true);
    assert.equal(signed.ok, true);
    if (!signed.ok) throw new Error("saved sign-in");
    assert.equal(signed.user.id, employee.id);
    assert.equal(signed.user.teamName, "Night crew");
    const resetState = await store.resetWorkspace();
    assert.equal(resetState.credentials.filter((item) => item.userId === BOOTSTRAP_ADMIN_ID).length, 1);
    assert.equal(resetState.requests.length, seeded.requests.length);
  } finally {
    delete process.env.VERCEL_ENV;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.MRS_DATA_FILE;
    delete process.env.MRS_BOOTSTRAP_ADMIN_NAME;
    delete process.env.MRS_BOOTSTRAP_ADMIN_EMPLOYEE_ID;
    delete process.env.MRS_BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.MRS_BOOTSTRAP_ADMIN_PASSWORD;
    await rm(directory, { recursive: true, force: true });
  }
}

await checkStoredBootstrap();
console.log("Authentication checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
