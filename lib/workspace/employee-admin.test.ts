import assert from "node:assert/strict";

import { assessLogin, setEmployeeLogin } from "./accounts";
import { hashPassword, verifyPassword } from "./password";
import { addDemoUser, clearTeamLeaderAssignment, normalizeWorkspace, updateDemoUser } from "./rules";
import { USER_IDS, createSeed } from "./seed";
import type { DemoUser, Workspace, ZoneCode } from "./types";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function zoneSupervisor(state: Workspace, code: ZoneCode) {
  return state.zones.find((zone) => zone.code === code)?.supervisorId ?? null;
}

function firstLeaderId(state: Workspace, displayName: string) {
  const found = state.users.find((item) => item.displayName === displayName);
  if (!found) throw new Error(displayName);
  return found.id;
}

function links(state: Workspace) {
  return {
    zones: state.zones.map((zone) => [zone.code, zone.supervisorId]),
    leaders: state.users
      .filter((item) => item.role === "TEAM_LEADER")
      .map((item) => [item.id, item.supervisorId, item.zoneCode]),
    requests: state.requests.length,
    materials: state.materials.length,
    movements: state.movements.length,
  };
}

async function main() {
  const seed = createSeed();
  const admin = user(seed, USER_IDS.admin);
  const before = links(seed);

  const createdSupervisor = addDemoUser(seed, admin, {
    displayName: "Supervisor South",
    role: "SUPERVISOR",
    zoneCode: "E",
  });
  assert.equal(createdSupervisor.ok, true);
  if (!createdSupervisor.ok) return;
  const supervisorId = createdSupervisor.data;
  const supervisor = createdSupervisor.state.users.find((item) => item.id === supervisorId);
  assert.equal(supervisor?.role, "SUPERVISOR");
  assert.equal(supervisor?.zoneCode, "E");
  assert.equal(zoneSupervisor(createdSupervisor.state, "E"), supervisorId);
  assert.equal(zoneSupervisor(createdSupervisor.state, "A"), USER_IDS.supervisorA);
  assert.equal(zoneSupervisor(createdSupervisor.state, "B"), USER_IDS.supervisorB);
  assert.equal(zoneSupervisor(createdSupervisor.state, "C"), USER_IDS.supervisorC);
  assert.equal(zoneSupervisor(createdSupervisor.state, "D"), USER_IDS.supervisorD);
  assert.equal(user(createdSupervisor.state, USER_IDS.supervisorE).zoneCode, null);
  assert.equal(user(createdSupervisor.state, USER_IDS.leaderE).supervisorId, supervisorId);
  assert.equal(user(createdSupervisor.state, USER_IDS.leaderE).zoneCode, "E");
  assert.equal(user(createdSupervisor.state, USER_IDS.leaderA).supervisorId, USER_IDS.supervisorA);
  assert.equal(user(createdSupervisor.state, USER_IDS.leaderB).supervisorId, USER_IDS.supervisorB);

  const leaderNames = ["North crew", "South crew", "East crew"];
  let withLeaders = createdSupervisor.state;
  for (const teamName of leaderNames) {
    const added = addDemoUser(withLeaders, admin, {
      displayName: `Leader ${teamName}`,
      role: "TEAM_LEADER",
      zoneCode: "E",
      supervisorId,
      teamName,
    });
    assert.equal(added.ok, true);
    if (!added.ok) throw new Error(teamName);
    const leader = added.state.users.find((item) => item.id === added.data);
    assert.equal(leader?.supervisorId, supervisorId);
    assert.equal(leader?.zoneCode, "E");
    assert.equal(leader?.teamName, teamName);
    withLeaders = added.state;
  }
  const underSupervisor = withLeaders.users.filter(
    (item) => item.role === "TEAM_LEADER" && item.supervisorId === supervisorId,
  );
  assert.equal(underSupervisor.length, 4);

  const mismatch = addDemoUser(withLeaders, admin, {
    displayName: "Cross zone",
    role: "TEAM_LEADER",
    zoneCode: "A",
    supervisorId,
  });
  assert.equal(mismatch.ok, false);
  if (mismatch.ok) return;
  assert.equal(mismatch.error, "That supervisor does not cover the selected zone.");

  const moved = updateDemoUser(withLeaders, admin, {
    userId: supervisorId,
    displayName: "Supervisor South",
    role: "SUPERVISOR",
    zoneCode: "D",
    active: true,
  });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(zoneSupervisor(moved.state, "D"), supervisorId);
  assert.equal(zoneSupervisor(moved.state, "E"), USER_IDS.supervisorD);
  assert.equal(user(moved.state, supervisorId).zoneCode, "D");
  assert.equal(user(moved.state, USER_IDS.supervisorD).zoneCode, "E");
  assert.equal(user(moved.state, USER_IDS.leaderD).zoneCode, "D");
  assert.equal(user(moved.state, USER_IDS.leaderD).supervisorId, supervisorId);
  assert.equal(user(moved.state, USER_IDS.leaderE).zoneCode, "E");
  assert.equal(user(moved.state, USER_IDS.leaderE).supervisorId, USER_IDS.supervisorD);
  assert.equal(user(moved.state, USER_IDS.leaderA).supervisorId, USER_IDS.supervisorA);
  assert.equal(zoneSupervisor(moved.state, "A"), USER_IDS.supervisorA);
  assert.equal(user(moved.state, firstLeaderId(moved.state, "Leader North crew")).zoneCode, "E");
  assert.equal(user(moved.state, firstLeaderId(moved.state, "Leader North crew")).supervisorId, USER_IDS.supervisorD);

  const firstLeader = withLeaders.users.find((item) => item.displayName === "Leader North crew");
  if (!firstLeader) throw new Error("missing leader");
  const retargeted = updateDemoUser(moved.state, admin, {
    userId: firstLeader.id,
    displayName: firstLeader.displayName,
    role: "TEAM_LEADER",
    zoneCode: "A",
    supervisorId: USER_IDS.supervisorA,
    active: true,
    teamName: "North crew",
  });
  assert.equal(retargeted.ok, true);
  if (!retargeted.ok) return;
  assert.equal(user(retargeted.state, firstLeader.id).zoneCode, "A");
  assert.equal(user(retargeted.state, firstLeader.id).supervisorId, USER_IDS.supervisorA);
  assert.equal(user(retargeted.state, USER_IDS.leaderA).supervisorId, USER_IDS.supervisorA);
  const stayed = retargeted.state.users.filter(
    (item) => item.displayName === "Leader South crew" || item.displayName === "Leader East crew",
  );
  assert.equal(stayed.length, 2);
  assert.ok(stayed.every((item) => item.supervisorId === USER_IDS.supervisorD && item.zoneCode === "E"));

  const refused = updateDemoUser(retargeted.state, admin, {
    userId: firstLeader.id,
    displayName: firstLeader.displayName,
    role: "TEAM_LEADER",
    zoneCode: "B",
    supervisorId: USER_IDS.supervisorA,
    active: true,
  });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.error, "That supervisor does not cover the selected zone.");
  assert.equal(user(retargeted.state, firstLeader.id).zoneCode, "A");

  const keeper = updateDemoUser(seed, admin, {
    userId: USER_IDS.storeKeeper,
    displayName: "Store Keeper (demo)",
    role: "STORE_KEEPER",
    zoneCode: null,
    active: true,
    teamName: "Cage",
  });
  assert.equal(keeper.ok, true);
  if (!keeper.ok) return;
  assert.deepEqual(links(keeper.state).zones, before.zones);
  assert.deepEqual(links(keeper.state).leaders, before.leaders);
  assert.equal(links(keeper.state).requests, before.requests);
  assert.equal(links(keeper.state).materials, before.materials);
  assert.equal(links(keeper.state).movements, before.movements);

  const original = "kept-secret-1";
  const replacement = "next-secret-2";
  const originalHash = await hashPassword(original);
  const replacementHash = await hashPassword(replacement);
  const adminLogin = setEmployeeLogin(seed, admin, {
    userId: admin.id,
    employeeId: "ADM-9",
    email: "admin@facility.example",
    passwordHash: originalHash,
  });
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  const identified = setEmployeeLogin(adminLogin.state, admin, {
    userId: USER_IDS.leaderC,
    employeeId: "TL-C900",
    email: "leader.c@facility.example",
    passwordHash: null,
  });
  assert.equal(identified.ok, true);
  if (!identified.ok) return;
  const stored = identified.state.credentials.find((item) => item.userId === USER_IDS.leaderC);
  assert.equal(stored?.employeeId, "TL-C900");
  assert.equal(stored?.passwordHash, "");
  assert.equal(JSON.stringify(identified.state.credentials).includes(original), false);
  const normalized = normalizeWorkspace(identified.state);
  assert.equal(normalized.credentials.find((item) => item.userId === USER_IDS.leaderC)?.employeeId, "TL-C900");
  assert.equal(assessLogin(normalized, "TL-C900", true).ok, false);

  const passwordOnly = setEmployeeLogin(normalized, admin, {
    userId: USER_IDS.leaderC,
    employeeId: "TL-C900",
    email: "leader.c@facility.example",
    passwordHash: originalHash,
  });
  assert.equal(passwordOnly.ok, true);
  if (!passwordOnly.ok) return;
  const withPassword = passwordOnly.state.credentials.find((item) => item.userId === USER_IDS.leaderC);
  assert.equal(withPassword?.employeeId, "TL-C900");
  assert.equal(withPassword?.passwordHash, originalHash);
  assert.equal(await verifyPassword(original, withPassword?.passwordHash ?? ""), true);
  assert.equal(JSON.stringify(passwordOnly.state).includes(original), false);
  const signedIn = assessLogin(passwordOnly.state, "TL-C900", true);
  assert.equal(signedIn.ok, true);

  const renamed = setEmployeeLogin(passwordOnly.state, admin, {
    userId: USER_IDS.leaderC,
    employeeId: "TL-C901",
    email: "leader.c@facility.example",
    passwordHash: null,
  });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  const renamedCredential = renamed.state.credentials.find((item) => item.userId === USER_IDS.leaderC);
  assert.equal(renamedCredential?.employeeId, "TL-C901");
  assert.equal(renamedCredential?.passwordHash, originalHash);
  assert.equal(await verifyPassword(original, renamedCredential?.passwordHash ?? ""), true);

  const reset = setEmployeeLogin(renamed.state, admin, {
    userId: USER_IDS.leaderC,
    employeeId: "TL-C901",
    email: "leader.c@facility.example",
    passwordHash: replacementHash,
  });
  assert.equal(reset.ok, true);
  if (!reset.ok) return;
  const resetCredential = reset.state.credentials.find((item) => item.userId === USER_IDS.leaderC);
  assert.equal(resetCredential?.passwordHash, replacementHash);
  assert.equal(resetCredential?.passwordHash === originalHash, false);
  assert.equal(await verifyPassword(replacement, resetCredential?.passwordHash ?? ""), true);
  assert.equal(await verifyPassword(original, resetCredential?.passwordHash ?? ""), false);
  assert.equal(JSON.stringify(reset.state).includes(replacement), false);
  assert.equal(JSON.stringify(reset.state).includes(original), false);

  const clearedLeader = clearTeamLeaderAssignment(seed, admin, USER_IDS.leaderE);
  assert.equal(clearedLeader.ok, true);
  if (!clearedLeader.ok) return;
  const deactivated = updateDemoUser(clearedLeader.state, admin, {
    userId: USER_IDS.leaderE,
    displayName: user(clearedLeader.state, USER_IDS.leaderE).displayName,
    role: "TEAM_LEADER",
    zoneCode: null,
    active: false,
  });
  assert.equal(deactivated.ok, true);
  if (!deactivated.ok) return;
  assert.equal(user(deactivated.state, USER_IDS.leaderE).active, false);
  assert.equal(user(deactivated.state, USER_IDS.leaderE).zoneCode, null);
  const stillAssigned = updateDemoUser(seed, admin, {
    userId: USER_IDS.leaderA,
    displayName: user(seed, USER_IDS.leaderA).displayName,
    role: "TEAM_LEADER",
    zoneCode: null,
    active: true,
  });
  assert.equal(stillAssigned.ok, false);
  if (stillAssigned.ok) return;
  assert.equal(stillAssigned.error, "A team leader must belong to a zone.");
  assert.equal(user(seed, USER_IDS.leaderA).zoneCode, "A");

  console.log("Employee admin checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
