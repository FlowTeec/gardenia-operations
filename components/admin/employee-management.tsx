"use client";

import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, UserRoundCheck, UserRoundX } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminUser, Role, ZoneCode } from "@/lib/workspace/types";

const fieldClass = "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

const roles: Role[] = ["ADMIN", "SUPERVISOR", "OPERATION_MANAGER", "TEAM_LEADER", "STORE_KEEPER"];

export const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  OPERATION_MANAGER: "Operation Manager",
  TEAM_LEADER: "Team Leader",
  STORE_KEEPER: "Store Keeper",
};

export type EmployeeInput = {
  displayName: string;
  role: Role;
  zoneCode: ZoneCode | null;
  supervisorId: string | null;
  teamName: string;
  employeeId: string;
  email: string;
  password: string;
};

export type EmployeeUpdate = EmployeeInput & {
  userId: string;
  active: boolean;
};

type Notice = { kind: "ok" | "error"; text: string; target: string } | null;

type ZoneOption = { code: ZoneCode; name: string; supervisorId: string };
type SupervisorOption = { id: string; displayName: string };

export function EmployeeManagement({
  users,
  zones,
  supervisors,
  pending,
  savingTarget,
  notice,
  addOpen,
  initialRole,
  initialStatus,
  onAddOpenChange,
  onCreate,
  onUpdate,
}: {
  users: AdminUser[];
  zones: ZoneOption[];
  supervisors: SupervisorOption[];
  pending: boolean;
  savingTarget: string | null;
  notice: Notice;
  addOpen: boolean;
  initialRole: Role | null;
  initialStatus: "ACTIVE" | "INACTIVE" | null;
  onAddOpenChange: (open: boolean) => void;
  onCreate: (input: EmployeeInput) => Promise<boolean>;
  onUpdate: (input: EmployeeUpdate, kind: "edit" | "password" | "status") => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">(initialRole ?? "ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(initialStatus ?? "ALL");
  const [zoneFilter, setZoneFilter] = useState<ZoneCode | "ALL">("ALL");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);

  const teamNames = [...new Set(users.map((user) => user.teamName).filter((name): name is string => Boolean(name)))].sort(
    (left, right) => left.localeCompare(right),
  );
  const needle = query.trim().toLowerCase();
  const visible = users.filter((user) => {
    if (needle && !user.displayName.toLowerCase().includes(needle) && !user.employeeId.toLowerCase().includes(needle)) {
      return false;
    }
    if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && !user.active) return false;
    if (statusFilter === "INACTIVE" && user.active) return false;
    if (zoneFilter !== "ALL" && user.zoneCode !== zoneFilter) return false;
    if (teamFilter === "NONE" && user.teamName) return false;
    if (teamFilter !== "ALL" && teamFilter !== "NONE" && user.teamName !== teamFilter) return false;
    return true;
  });

  function zoneName(code: ZoneCode | null) {
    if (!code) return "—";
    return zones.find((zone) => zone.code === code)?.name ?? code;
  }

  function supervisorLabel(user: AdminUser) {
    if (user.role !== "TEAM_LEADER" || !user.supervisorId) return "—";
    return users.find((item) => item.id === user.supervisorId)?.displayName ?? "—";
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Employee Management</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Add employees, assign a supervisor to a zone, place team leaders under that supervisor, or turn login access on and off. Request history stays with the employee.
          </p>
        </div>
        <Button type="button" size="lg" className="h-11" onClick={() => onAddOpenChange(true)}>
          <Plus />
          Add Employee
        </Button>
      </div>

      <FormNotice notice={notice} target="employees" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2 xl:col-span-1">
          <span>Search</span>
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              aria-label="Search by employee name or employee ID"
              placeholder="Name or employee ID"
              className="h-11 pl-8"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <Filter label="Role" value={roleFilter} onChange={(value) => setRoleFilter(value as Role | "ALL")}>
          <option value="ALL">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel[role]}
            </option>
          ))}
        </Filter>
        <Filter label="Team name" value={teamFilter} onChange={setTeamFilter}>
          <option value="ALL">All teams</option>
          <option value="NONE">No team name</option>
          {teamNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Filter>
        <Filter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Filter>
        <Filter label="Zone" value={zoneFilter} onChange={(value) => setZoneFilter(value as ZoneCode | "ALL")}>
          <option value="ALL">All zones</option>
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.name}
            </option>
          ))}
        </Filter>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No employees match this search.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Employee Name</th>
                  <th className="px-2 py-2 font-medium">Employee ID</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Team Name</th>
                  <th className="px-2 py-2 font-medium">Zone</th>
                  <th className="px-2 py-2 font-medium">Supervisor</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Password</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="px-2 py-2 font-medium">{user.displayName}</td>
                    <td className="px-2 py-2">{user.employeeId || "—"}</td>
                    <td className="px-2 py-2">{roleLabel[user.role]}</td>
                    <td className="px-2 py-2">{user.teamName || "—"}</td>
                    <td className="px-2 py-2">{zoneName(user.zoneCode)}</td>
                    <td className="px-2 py-2">{supervisorLabel(user)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge active={user.active} />
                    </td>
                    <td className="px-2 py-2">
                      <PasswordCell onReset={() => setResetting(user)} />
                    </td>
                    <td className="px-2 py-2">
                      <RowActions
                        user={user}
                        onEdit={() => setEditing(user)}
                        onReset={() => setResetting(user)}
                        onStatus={() => setStatusTarget(user)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.employeeId || "No employee ID"}</p>
                  </div>
                  <StatusBadge active={user.active} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Role</dt>
                    <dd>{roleLabel[user.role]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Team name</dt>
                    <dd>{user.teamName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Zone</dt>
                    <dd>{zoneName(user.zoneCode)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Supervisor</dt>
                    <dd>{supervisorLabel(user)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Password</dt>
                    <dd>
                      <PasswordCell onReset={() => setResetting(user)} />
                    </dd>
                  </div>
                </dl>
                <RowActions
                  user={user}
                  onEdit={() => setEditing(user)}
                  onReset={() => setResetting(user)}
                  onStatus={() => setStatusTarget(user)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm text-muted-foreground">
        Deactivate an employee to remove login access. Requests, approvals, and inventory records are kept.
      </p>

      <Modal open={addOpen} title="Add Employee" onClose={() => onAddOpenChange(false)}>
        <AddEmployeeForm
          zones={zones}
          supervisors={supervisors}
          pending={pending}
          saving={savingTarget === "create"}
          notice={notice}
          onCreate={async (input) => {
            const saved = await onCreate(input);
            if (saved) onAddOpenChange(false);
            return saved;
          }}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit Employee" onClose={() => setEditing(null)}>
        {editing ? (
          <EditEmployeeForm
            user={editing}
            zones={zones}
            supervisors={supervisors}
            pending={pending}
            saving={savingTarget === editing.id}
            notice={notice}
            onSave={async (input) => {
            const saved = await onUpdate(input, "edit");
            if (saved) setEditing(null);
              return saved;
            }}
          />
        ) : null}
      </Modal>

      <Modal open={Boolean(resetting)} title="Set new password" onClose={() => setResetting(null)}>
        {resetting ? (
          <ResetPasswordForm
            user={resetting}
            pending={pending}
            saving={savingTarget === `password-${resetting.id}`}
            notice={notice}
            onSave={async (password) => {
              const saved = await onUpdate({ ...snapshot(resetting), password }, "password");
              if (saved) setResetting(null);
              return saved;
            }}
          />
        ) : null}
      </Modal>

      <Modal open={Boolean(statusTarget)} title={statusTarget?.active ? "Deactivate employee" : "Activate employee"} onClose={() => setStatusTarget(null)}>
        {statusTarget ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6">
              {statusTarget.active
                ? "Are you sure you want to deactivate this employee? They will no longer be able to log in."
                : "Activate this employee and restore login access?"}
            </p>
            <p className="text-sm text-muted-foreground">{statusTarget.displayName}</p>
            <FormNotice notice={notice} target={`status-${statusTarget.id}`} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-11" onClick={() => setStatusTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11"
                disabled={pending}
                aria-busy={savingTarget === `status-${statusTarget.id}`}
                onClick={() => {
                  const user = statusTarget;
                  void onUpdate({ ...snapshot(user), active: !user.active, password: "" }, "status").then((saved) => {
                    if (saved) setStatusTarget(null);
                  });
                }}
              >
                {savingTarget === `status-${statusTarget.id}`
                  ? "Saving…"
                  : statusTarget.active
                    ? "Deactivate"
                    : "Activate"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

function snapshot(user: AdminUser): EmployeeUpdate {
  return {
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    zoneCode: user.role === "TEAM_LEADER" || user.role === "SUPERVISOR" ? user.zoneCode : null,
    supervisorId: user.role === "TEAM_LEADER" ? user.supervisorId : null,
    active: user.active,
    teamName: user.teamName ?? "",
    employeeId: user.employeeId,
    email: user.email,
    password: "",
  };
}

function RowActions({
  user,
  onEdit,
  onReset,
  onStatus,
}: {
  user: AdminUser;
  onEdit: () => void;
  onReset: () => void;
  onStatus: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <IconButton label={`Edit ${user.displayName}`} title="Edit" onClick={onEdit}>
        <Pencil />
      </IconButton>
      <IconButton label={`Reset password for ${user.displayName}`} title="Reset Password" onClick={onReset}>
        <KeyRound />
      </IconButton>
      <IconButton
        label={user.active ? `Deactivate ${user.displayName}` : `Activate ${user.displayName}`}
        title={user.active ? "Deactivate" : "Activate"}
        onClick={onStatus}
      >
        {user.active ? <UserRoundX /> : <UserRoundCheck />}
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-lg border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PasswordCell({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm text-muted-foreground" aria-label="Password hidden">
        Hidden
      </span>
      <button
        type="button"
        className="inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onReset}
      >
        Set new password
      </button>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "status-approved inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
          : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <select aria-label={label} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function AddEmployeeForm({
  zones,
  supervisors,
  pending,
  saving,
  notice,
  onCreate,
}: {
  zones: ZoneOption[];
  supervisors: SupervisorOption[];
  pending: boolean;
  saving: boolean;
  notice: Notice;
  onCreate: (input: EmployeeInput) => Promise<boolean>;
}) {
  const initialZone = zones.find((zone) => zone.code === "A") ?? zones[0];
  const [displayName, setDisplayName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [teamName, setTeamName] = useState("");
  const [role, setRole] = useState<Role>("TEAM_LEADER");
  const [zoneCode, setZoneCode] = useState<ZoneCode | "">(initialZone?.code ?? "");
  const [supervisorId, setSupervisorId] = useState(initialZone?.supervisorId ?? "");
  const [problems, setProblems] = useState<string[]>([]);
  const hydrated = useHydrated();

  return (
    <form
      id="new-employee"
      method="post"
      data-hydrated={hydrated ? "true" : "false"}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!hydrated || pending) return;
        const next = createProblems({ displayName, employeeId, email, password, confirm, role, zoneCode });
        setProblems(next);
        if (next.length > 0) return;
        void onCreate({
          displayName,
          employeeId,
          email,
          teamName,
          password,
          role,
          zoneCode: role === "TEAM_LEADER" || role === "SUPERVISOR" ? zoneCode || null : null,
          supervisorId: role === "TEAM_LEADER" ? supervisorId || null : null,
        }).then((saved) => {
          if (!saved) return;
          setDisplayName("");
          setEmployeeId("");
          setEmail("");
          setTeamName("");
          setPassword("");
          setConfirm("");
          setProblems([]);
        });
      }}
    >
      <FormSection title="Basic Information">
        <Field label="Employee Name" id="new-user-name">
          <Input id="new-user-name" value={displayName} autoComplete="off" className="h-11" onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field label="Employee ID" id="new-user-employee">
          <Input id="new-user-employee" value={employeeId} autoComplete="off" className="h-11" onChange={(event) => setEmployeeId(event.target.value)} />
        </Field>
        <Field label="Registered email" id="new-user-email" hint="Required for an account that can sign in.">
          <Input id="new-user-email" type="email" value={email} autoComplete="off" className="h-11" onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </FormSection>
      <FormSection title="Account">
        <PasswordField id="new-user-password" label="Password" value={password} autoComplete="new-password" onChange={setPassword} />
        <PasswordField id="new-user-confirm" label="Confirm Password" value={confirm} autoComplete="new-password" onChange={setConfirm} />
      </FormSection>
      <FormSection title="Role & Assignment">
        <Field label="Role" id="new-user-role">
          <select
            id="new-user-role"
            className={fieldClass}
            value={role}
            onChange={(event) => {
              const next = event.target.value as Role;
              setRole(next);
              if (next === "TEAM_LEADER") {
                const code = zoneCode || initialZone?.code || "";
                setZoneCode(code);
                setSupervisorId(zones.find((zone) => zone.code === code)?.supervisorId ?? "");
              } else {
                setZoneCode("");
                setSupervisorId("");
              }
            }}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {roleLabel[item]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team Name" id="new-user-team" hint="Saved on this employee. It does not change the zone or supervisor.">
          <Input id="new-user-team" value={teamName} className="h-11" onChange={(event) => setTeamName(event.target.value)} />
        </Field>
        <AssignmentFields
          idPrefix="new-user"
          role={role}
          zoneCode={zoneCode}
          supervisorId={supervisorId}
          zones={zones}
          supervisors={supervisors}
          onZoneCode={setZoneCode}
          onSupervisorId={setSupervisorId}
        />
      </FormSection>
      <ProblemList problems={problems} />
      <FormNotice notice={notice} target="create" />
      <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending || !hydrated} aria-busy={saving}>
        {saving ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

function EditEmployeeForm({
  user,
  zones,
  supervisors,
  pending,
  saving,
  notice,
  onSave,
}: {
  user: AdminUser;
  zones: ZoneOption[];
  supervisors: SupervisorOption[];
  pending: boolean;
  saving: boolean;
  notice: Notice;
  onSave: (input: EmployeeUpdate) => Promise<boolean>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [employeeId, setEmployeeId] = useState(user.employeeId);
  const [email, setEmail] = useState(user.email);
  const [teamName, setTeamName] = useState(user.teamName ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [zoneCode, setZoneCode] = useState<ZoneCode | "">(user.zoneCode ?? "");
  const [supervisorId, setSupervisorId] = useState(user.supervisorId ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const hydrated = useHydrated();

  return (
    <form
      method="post"
      data-hydrated={hydrated ? "true" : "false"}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!hydrated || pending) return;
        const next = editProblems({ displayName, employeeId, email, password, confirm, role, zoneCode });
        setProblems(next);
        if (next.length > 0) return;
        void onSave({
          userId: user.id,
          displayName,
          employeeId,
          email,
          teamName,
          role,
          active: user.active,
          password,
          zoneCode: role === "TEAM_LEADER" || role === "SUPERVISOR" ? zoneCode || null : null,
          supervisorId: role === "TEAM_LEADER" ? supervisorId || null : null,
        });
      }}
    >
      <FormSection title="Basic Information">
        <Field label="Employee Name" id={`edit-name-${user.id}`}>
          <Input id={`edit-name-${user.id}`} value={displayName} autoComplete="off" className="h-11" onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field label="Employee ID" id={`edit-id-${user.id}`}>
          <Input id={`edit-id-${user.id}`} value={employeeId} autoComplete="off" className="h-11" onChange={(event) => setEmployeeId(event.target.value)} />
        </Field>
        <Field label="Registered email" id={`edit-email-${user.id}`}>
          <Input id={`edit-email-${user.id}`} type="email" value={email} autoComplete="off" className="h-11" onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </FormSection>
      <FormSection title="Account">
        <PasswordField
          id={`edit-password-${user.id}`}
          label="New Password (leave blank to keep current password)"
          value={password}
          autoComplete="new-password"
          onChange={setPassword}
        />
        <PasswordField
          id={`edit-confirm-${user.id}`}
          label="Confirm new password"
          value={confirm}
          autoComplete="new-password"
          onChange={setConfirm}
        />
      </FormSection>
      <FormSection title="Role & Assignment">
        <Field label="Role" id={`edit-role-${user.id}`}>
          <select
            id={`edit-role-${user.id}`}
            className={fieldClass}
            value={role}
            onChange={(event) => {
              const next = event.target.value as Role;
              setRole(next);
              if (next === "TEAM_LEADER") {
                const code = zoneCode || user.zoneCode || zones[0]?.code || "";
                setZoneCode(code);
                const zone = zones.find((item) => item.code === code);
                setSupervisorId(user.supervisorId && zone?.supervisorId === user.supervisorId ? user.supervisorId : zone?.supervisorId ?? "");
              } else if (next === "SUPERVISOR") {
                if (role !== "SUPERVISOR") setZoneCode(user.role === "SUPERVISOR" ? user.zoneCode ?? "" : "");
              } else {
                setZoneCode("");
                setSupervisorId("");
              }
            }}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {roleLabel[item]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team Name" id={`edit-team-${user.id}`} hint="The team name is stored on this employee. Zone and supervisor stay as selected above.">
          <Input id={`edit-team-${user.id}`} value={teamName} className="h-11" onChange={(event) => setTeamName(event.target.value)} />
        </Field>
        <AssignmentFields
          idPrefix={`edit-${user.id}`}
          role={role}
          zoneCode={zoneCode}
          supervisorId={supervisorId}
          zones={zones}
          supervisors={supervisors}
          userId={user.id}
          onZoneCode={setZoneCode}
          onSupervisorId={setSupervisorId}
        />
      </FormSection>
      <ProblemList problems={problems} />
      <FormNotice notice={notice} target={user.id} />
      <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending || !hydrated} aria-busy={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function ResetPasswordForm({
  user,
  pending,
  saving,
  notice,
  onSave,
}: {
  user: AdminUser;
  pending: boolean;
  saving: boolean;
  notice: Notice;
  onSave: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState<string | null>(null);
  const hydrated = useHydrated();

  return (
    <form
      method="post"
      data-hydrated={hydrated ? "true" : "false"}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!hydrated || pending) return;
        if (password !== confirm) {
          setMismatch("The passwords do not match.");
          return;
        }
        setMismatch(null);
        void onSave(password);
      }}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        The saved password cannot be shown. Set a new password for {user.displayName}. They sign in with their employee ID and this password. Name, role, team, zone, and employee ID stay as they are.
      </p>
      <PasswordField id={`reset-password-${user.id}`} label="New password" value={password} required autoComplete="new-password" onChange={setPassword} />
      <PasswordField id={`reset-confirm-${user.id}`} label="Confirm Password" value={confirm} required autoComplete="new-password" onChange={setConfirm} />
      {mismatch ? (
        <p role="alert" className="text-sm text-destructive">
          {mismatch}
        </p>
      ) : null}
      <FormNotice notice={notice} target={`password-${user.id}`} />
      <Button type="submit" size="lg" className="h-11" disabled={pending || !hydrated} aria-busy={saving}>
        {saving ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}

function createProblems(input: {
  displayName: string;
  employeeId: string;
  email: string;
  password: string;
  confirm: string;
  role: Role;
  zoneCode: ZoneCode | "";
}) {
  const problems: string[] = [];
  if (!input.displayName.trim()) problems.push("Enter a display name.");
  if (!input.employeeId.trim()) problems.push("Enter an employee ID.");
  if (!input.email.trim()) problems.push("Enter a valid email address.");
  if (!input.password) problems.push("Enter a password.");
  else if (input.password !== input.confirm) problems.push("The passwords do not match.");
  if (input.role === "TEAM_LEADER" && !input.zoneCode) problems.push("A team leader must belong to a zone.");
  return problems;
}

function editProblems(input: {
  displayName: string;
  employeeId: string;
  email: string;
  password: string;
  confirm: string;
  role: Role;
  zoneCode: ZoneCode | "";
}) {
  const problems: string[] = [];
  if (!input.displayName.trim()) problems.push("Enter a display name.");
  const employeeId = input.employeeId.trim();
  const email = input.email.trim();
  if (input.password || input.confirm) {
    if (!input.password || input.password !== input.confirm) {
      problems.push(input.password ? "The passwords do not match." : "Enter a password.");
    }
  }
  if ((employeeId || email || input.password) && !employeeId) problems.push("Enter an employee ID.");
  if ((employeeId || email || input.password) && !email) problems.push("Enter a valid email address.");
  if (input.role === "TEAM_LEADER" && !input.zoneCode) problems.push("A team leader must belong to a zone.");
  return problems;
}

function ProblemList({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {problems.map((problem) => (
        <li key={problem} role="alert" className="text-sm text-destructive">
          {problem}
        </li>
      ))}
    </ul>
  );
}

function AssignmentFields({
  idPrefix,
  role,
  zoneCode,
  supervisorId,
  zones,
  supervisors,
  userId,
  onZoneCode,
  onSupervisorId,
}: {
  idPrefix: string;
  role: Role;
  zoneCode: ZoneCode | "";
  supervisorId: string;
  zones: ZoneOption[];
  supervisors: SupervisorOption[];
  userId?: string;
  onZoneCode: (zoneCode: ZoneCode | "") => void;
  onSupervisorId: (supervisorId: string) => void;
}) {
  const assignsZone = role === "TEAM_LEADER" || role === "SUPERVISOR";
  const selectedZone = zoneCode ? zones.find((zone) => zone.code === zoneCode) : null;
  const coveredBy = selectedZone ? supervisors.find((item) => item.id === selectedZone.supervisorId) : null;
  const ownZone = userId ? zones.find((zone) => zone.supervisorId === userId) : null;

  return (
    <>
      <Field
        label="Zone"
        id={`${idPrefix}-zone`}
        hint={
          role === "SUPERVISOR"
            ? "Choose one of the existing zones. A zone keeps a single supervisor."
            : role === "TEAM_LEADER"
              ? "The team leader's zone matches the supervisor who covers it."
              : "This role is not assigned to a zone."
        }
      >
        <select
          id={`${idPrefix}-zone`}
          className={fieldClass}
          value={assignsZone ? zoneCode : ""}
          disabled={!assignsZone}
          onChange={(event) => {
            const code = event.target.value as ZoneCode | "";
            onZoneCode(code);
            if (role === "TEAM_LEADER") {
              onSupervisorId(zones.find((zone) => zone.code === code)?.supervisorId ?? "");
            }
          }}
        >
          {role === "SUPERVISOR" && !ownZone ? <option value="">No zone yet</option> : null}
          {role === "TEAM_LEADER" && !zoneCode ? <option value="">Select a zone</option> : null}
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.name}
            </option>
          ))}
        </select>
      </Field>
      {role === "TEAM_LEADER" ? (
        <Field label="Supervisor" id={`${idPrefix}-supervisor`} hint="A team leader can be assigned only to the supervisor who covers the selected zone.">
          <select
            id={`${idPrefix}-supervisor`}
            className={fieldClass}
            value={supervisorId}
            onChange={(event) => {
              const nextId = event.target.value;
              onSupervisorId(nextId);
              const zone = zones.find((item) => item.supervisorId === nextId);
              if (zone) onZoneCode(zone.code);
            }}
          >
            <option value="">Select a supervisor</option>
            {supervisors.map((supervisor) => {
              const zone = zones.find((item) => item.supervisorId === supervisor.id);
              return (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.displayName}
                  {zone ? ` · ${zone.name}` : " · no zone"}
                </option>
              );
            })}
          </select>
        </Field>
      ) : (
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Supervisor</span>
          <p className="text-xs leading-5 text-muted-foreground">
            {role === "SUPERVISOR"
              ? zoneNote(zoneCode, userId, selectedZone, coveredBy, ownZone)
              : "This role is not given a supervisor from the employee form."}
          </p>
        </div>
      )}
    </>
  );
}

function zoneNote(
  zoneCode: ZoneCode | "",
  userId: string | undefined,
  selectedZone: ZoneOption | null | undefined,
  coveredBy: SupervisorOption | null | undefined,
  ownZone: ZoneOption | null | undefined,
) {
  if (!zoneCode || !selectedZone) return "Leave the zone empty until you are ready to assign one. Existing zones stay as they are.";
  if (userId && selectedZone.supervisorId === userId) {
    return `This supervisor covers ${selectedZone.name}. Team leaders in this zone report to them.`;
  }
  if (ownZone && ownZone.code !== selectedZone.code) {
    const current = coveredBy ? `${coveredBy.displayName} covers ${selectedZone.name}` : `${selectedZone.name} has another supervisor`;
    return `${current}. This supervisor covers ${ownZone.name}. Saving swaps the two supervisors. Team leaders stay in their zone and report to that zone's supervisor.`;
  }
  const name = coveredBy?.displayName ?? "the current supervisor";
  return `${selectedZone.name} is covered by ${name}. Saving assigns this supervisor to ${selectedZone.name}. Team leaders in ${selectedZone.name} then report to this supervisor. ${name} keeps their account.`;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  required,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          className="h-11 pr-14"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function FormNotice({ notice, target }: { notice: Notice; target: string }) {
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

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="w-[calc(100%-2rem)] max-w-2xl rounded-xl border bg-card p-4 text-foreground shadow-lg backdrop:bg-black/40"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="max-h-[70svh] overflow-y-auto pr-1">{children}</div>
    </dialog>
  );
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
