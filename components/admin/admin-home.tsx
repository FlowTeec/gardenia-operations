"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AssignmentPanel } from "@/components/admin/assignment-panel";
import { EmployeeManagement, type EmployeeInput, type EmployeeUpdate } from "@/components/admin/employee-management";
import { Button } from "@/components/ui/button";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import {
  addUserAction,
  assignSupervisorAction,
  assignTeamLeaderAction,
  clearTeamLeaderAction,
  createSupervisorAction,
  getAdminHome,
  resetDemonstrationAction,
  updateSupervisorAction,
  updateUserAction,
} from "@/lib/workspace/actions";
import type { Role } from "@/lib/workspace/types";

const fieldClass = "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

type Notice = { kind: "ok" | "error"; text: string; target: string };

function readableClientError(error: unknown) {
  if (error instanceof Error && error.message && !error.message.includes("\n") && error.message.length <= 200) {
    return error.message;
  }
  return "The change could not be saved.";
}

export function AdminHome() {
  const page = useServerData(getAdminHome);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const pendingRef = useRef(false);
  const view = pathname.startsWith("/admin/employees")
    ? "employees"
    : pathname.startsWith("/admin/assignments")
      ? "assignments"
      : pathname.startsWith("/admin/settings")
        ? "settings"
        : "dashboard";
  const roleQuery = searchParams.get("role");
  const statusQuery = searchParams.get("status");
  const initialRole = isRole(roleQuery) ? roleQuery : null;
  const initialStatus = statusQuery === "ACTIVE" || statusQuery === "INACTIVE" ? statusQuery : null;

  useEffect(() => {
    if (!notice) return;
    document.getElementById(`notice-${notice.target}`)?.scrollIntoView({ block: "center" });
  }, [notice]);

  async function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    target = "page",
    errorTarget = target,
  ) {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setPendingTarget(errorTarget);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error ?? "The change was refused.", target: errorTarget });
        return false;
      }
      setNotice({ kind: "ok", text: success, target });
      page.reload();
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: readableClientError(error), target: errorTarget });
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
      setPendingTarget(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <FormNotice notice={notice} target="page" />
      {page.status === "loading" && !page.data ? (
        <p className="text-sm text-muted-foreground">Loading administration…</p>
      ) : null}
      {page.status === "error" && !page.data ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error ?? "The administration data could not be loaded."}
        </p>
      ) : null}

      {page.data && view === "dashboard" ? <Dashboard users={page.data.users} /> : null}

      {page.data && view === "employees" ? (
        <EmployeeManagement
          users={page.data.users}
          zones={page.data.zones}
          supervisors={page.data.supervisors}
          pending={pending}
          savingTarget={pendingTarget}
          notice={notice}
          addOpen={searchParams.get("new") === "1"}
          initialRole={initialRole}
          initialStatus={initialStatus}
          onAddOpenChange={(open) => router.replace(open ? "/admin/employees?new=1" : "/admin/employees")}
          onCreate={(input: EmployeeInput) =>
            run(() => addUserAction(input), "Employee account created.", "employees", "create")
          }
          onUpdate={(input: EmployeeUpdate, kind) => {
            const errorTarget =
              kind === "password" ? `password-${input.userId}` : kind === "status" ? `status-${input.userId}` : input.userId;
            const success =
              kind === "password"
                ? "Password reset. The new password is active and is not shown again."
                : kind === "status"
                  ? input.active
                    ? "Employee activated. They can sign in again."
                    : "Employee deactivated. They can no longer sign in."
                  : "Employee saved.";
            return run(() => updateUserAction(input), success, "employees", errorTarget);
          }}
        />
      ) : null}

      {page.data && view === "assignments" ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Supervisor & Team Assignment</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Connect each zone to one supervisor, and each team leader to that supervisor. Past requests stay recorded as they were.
            </p>
          </div>
          <FormNotice notice={notice} target="assignments" />
          <AssignmentPanel
            profiles={page.data.supervisorProfiles}
            leaders={page.data.users.filter((user) => user.role === "TEAM_LEADER")}
            zones={page.data.zones}
            pending={pending}
            onCreate={(displayName) =>
              void run(() => createSupervisorAction(displayName), "Supervisor profile created.", "assignments")
            }
            onSaveSupervisor={(input) =>
              void run(() => updateSupervisorAction(input), "Supervisor profile saved.", "assignments")
            }
            onAssignZone={(zoneCode, supervisorId) =>
              void run(
                () => assignSupervisorAction(zoneCode, supervisorId),
                "Zone supervisor updated. Team leaders in that zone now report to this supervisor.",
                "assignments",
              )
            }
            onAssignLeader={(teamLeaderId, supervisorId) =>
              void run(
                () => assignTeamLeaderAction(teamLeaderId, supervisorId),
                "Team leader assigned. Future requests follow this supervisor.",
                "assignments",
              )
            }
            onClearLeader={(teamLeaderId) =>
              void run(
                () => clearTeamLeaderAction(teamLeaderId),
                "Assignment removed. The team leader account and history remain.",
                "assignments",
              )
            }
          />
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-medium">Zones</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Zone</th>
                    <th className="px-2 py-2 font-medium">Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {page.data.zones.map((zone) => (
                    <tr key={zone.code} className="border-b">
                      <td className="px-2 py-2 font-medium">{zone.name}</td>
                      <td className="px-2 py-2">
                        <select
                          aria-label={`Supervisor for ${zone.name}`}
                          className={fieldClass}
                          value={zone.supervisorId}
                          disabled={pending}
                          onChange={(event) =>
                            void run(
                              () => assignSupervisorAction(zone.code, event.target.value),
                              `${zone.name} supervisor updated.`,
                              "assignments",
                            )
                          }
                        >
                          {page.data?.supervisors.map((supervisor) => (
                            <option key={supervisor.id} value={supervisor.id}>
                              {supervisor.displayName}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {page.data && view === "settings" ? (
        <section className="flex max-w-3xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              The record of zone open and close changes. PPE replacement intervals are managed by the operation manager. Supervisor links stay on Supervisor & Team Assignment.
            </p>
          </div>
          <FormNotice notice={notice} target="settings" />
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium">Zone request changes</h2>
            <p className="text-sm text-muted-foreground">
              The operation manager opens and closes zones for new requests. Assignments are unchanged, and earlier changes stay in this list.
            </p>
            {page.data.zoneChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No zone has been opened or closed yet.</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {page.data.zoneChanges.map((change) => (
                  <li key={change.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">
                      {change.zoneName} · {change.previousStatus} → {change.newStatus} · {change.requestDate}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDubai(change.changedAt)} · {change.changedByName}
                      {change.note ? ` · ${change.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-medium">Demonstration file</h2>
            <p className="text-sm text-muted-foreground">
              Replace this server&apos;s workspace with the placeholder demonstration data. Employee accounts created here are removed.
            </p>
            <div>
              <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setResetOpen(true)}>
                Reset demonstration file
              </Button>
            </div>
            {resetOpen ? (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <p className="text-sm leading-6">Reset the demonstration file to the placeholder data?</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" className="h-11" onClick={() => setResetOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11"
                    disabled={pending}
                    onClick={() => {
                      void run(
                        () => resetDemonstrationAction(),
                        "Demonstration file reset to the placeholder data.",
                        "settings",
                      ).then((saved) => {
                        if (saved) setResetOpen(false);
                      });
                    }}
                  >
                    Reset demonstration file
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Dashboard({
  users,
}: {
  users: { role: Role; active: boolean }[];
}) {
  const cards = [
    { label: "Total Employees", value: users.length, href: "/admin/employees" },
    { label: "Active Employees", value: users.filter((user) => user.active).length, href: "/admin/employees?status=ACTIVE" },
    { label: "Inactive Employees", value: users.filter((user) => !user.active).length, href: "/admin/employees?status=INACTIVE" },
    { label: "Team Leaders", value: users.filter((user) => user.role === "TEAM_LEADER").length, href: "/admin/employees?role=TEAM_LEADER" },
    { label: "Supervisors", value: users.filter((user) => user.role === "SUPERVISOR").length, href: "/admin/employees?role=SUPERVISOR" },
    { label: "Operation Managers", value: users.filter((user) => user.role === "OPERATION_MANAGER").length, href: "/admin/employees?role=OPERATION_MANAGER" },
    { label: "Store Keepers", value: users.filter((user) => user.role === "STORE_KEEPER").length, href: "/admin/employees?role=STORE_KEEPER" },
  ];
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Counts come from the employee accounts on this server. Open Employee Management to add or update someone.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="summary-card flex flex-col gap-1 px-4 py-4">
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <span className="text-3xl font-semibold tracking-tight">{card.value}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FormNotice({ notice, target }: { notice: Notice | null; target: string }) {
  if (!notice || notice.target !== target) return null;
  return (
    <p
      id={`notice-${target}`}
      role={notice.kind === "error" ? "alert" : "status"}
      className={notice.kind === "error" ? "text-sm leading-6 text-destructive" : "text-sm leading-6 text-muted-foreground"}
    >
      {notice.text}
    </p>
  );
}

function isRole(value: string | null): value is Role {
  return value === "ADMIN" || value === "SUPERVISOR" || value === "OPERATION_MANAGER" || value === "TEAM_LEADER" || value === "STORE_KEEPER";
}
