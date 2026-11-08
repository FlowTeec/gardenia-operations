"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminUser, SupervisorProfile, ZoneCode } from "@/lib/workspace/types";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function AssignmentPanel({
  profiles,
  leaders,
  zones,
  pending,
  onCreate,
  onSaveSupervisor,
  onAssignZone,
  onAssignLeader,
  onClearLeader,
}: {
  profiles: SupervisorProfile[];
  leaders: AdminUser[];
  zones: { code: ZoneCode; name: string }[];
  pending: boolean;
  onCreate: (displayName: string) => void;
  onSaveSupervisor: (input: { userId: string; displayName: string; active: boolean }) => void;
  onAssignZone: (zoneCode: ZoneCode, supervisorId: string) => void;
  onAssignLeader: (teamLeaderId: string, supervisorId: string) => void;
  onClearLeader: (teamLeaderId: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <section id="assignments" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium">Supervisor & Team Assignment</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Each supervisor covers one zone. A team leader is assigned to one supervisor,
          and that leader&apos;s zone matches the supervisor&apos;s zone. Removing an
          assignment keeps the team leader account and the request history. Changing a
          zone&apos;s supervisor keeps the team leaders in that zone and points them at
          the new supervisor. Past requests and finalized tickets stay as they were recorded.
        </p>
      </div>

      <form
        className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
          setName("");
        }}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="new-supervisor">New supervisor profile</Label>
          <Input
            id="new-supervisor"
            value={name}
            className="h-10"
            placeholder="Supervisor name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={pending || name.trim().length === 0}>
          Create supervisor
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        {profiles.map((profile) => (
          <SupervisorCard
            key={profile.id}
            profile={profile}
            leaders={leaders}
            zones={zones}
            pending={pending}
            onSaveSupervisor={onSaveSupervisor}
            onAssignZone={onAssignZone}
            onAssignLeader={onAssignLeader}
            onClearLeader={onClearLeader}
          />
        ))}
      </div>
    </section>
  );
}

function SupervisorCard({
  profile,
  leaders,
  zones,
  pending,
  onSaveSupervisor,
  onAssignZone,
  onAssignLeader,
  onClearLeader,
}: {
  profile: SupervisorProfile;
  leaders: AdminUser[];
  zones: { code: ZoneCode; name: string }[];
  pending: boolean;
  onSaveSupervisor: (input: { userId: string; displayName: string; active: boolean }) => void;
  onAssignZone: (zoneCode: ZoneCode, supervisorId: string) => void;
  onAssignLeader: (teamLeaderId: string, supervisorId: string) => void;
  onClearLeader: (teamLeaderId: string) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [active, setActive] = useState(profile.active);
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const others = leaders.filter((leader) => leader.supervisorId !== profile.id);

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-3">
      <form
        className="grid gap-2 md:grid-cols-[1.4fr_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveSupervisor({ userId: profile.id, displayName, active });
        }}
      >
        <Input
          aria-label={`Name for ${profile.displayName}`}
          value={displayName}
          className="h-10"
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
        <Button type="submit" variant="outline" size="lg" disabled={pending}>
          Save profile
        </Button>
      </form>

      <label className="flex max-w-md flex-col gap-2 text-sm">
        Zone
        <select
          aria-label={`Zone for ${profile.displayName}`}
          className={fieldClass}
          value={profile.zoneCode ?? ""}
          disabled={pending || !profile.active}
          onChange={(event) => {
            const zoneCode = event.target.value as ZoneCode;
            if (zoneCode) onAssignZone(zoneCode, profile.id);
          }}
        >
          <option value="">No zone</option>
          {zones.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Team leaders assigned here</h3>
        {profile.leaders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team leaders are assigned.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.leaders.map((leader) => (
              <li key={leader.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {leader.displayName}
                  {leader.active ? "" : " (inactive)"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onClearLeader(leader.id)}
                >
                  Remove assignment
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!teamLeaderId) return;
          onAssignLeader(teamLeaderId, profile.id);
          setTeamLeaderId("");
        }}
      >
        <label className="flex flex-1 flex-col gap-2 text-sm">
          Assign a team leader
          <select
            aria-label={`Assign a team leader to ${profile.displayName}`}
            className={fieldClass}
            value={teamLeaderId}
            onChange={(event) => setTeamLeaderId(event.target.value)}
          >
            <option value="">Choose a team leader</option>
            {others.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.displayName}
                {leader.zoneCode ? ` · ${leader.zoneCode}` : " · unassigned"}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" disabled={pending || !profile.zoneCode || teamLeaderId.length === 0}>
          Assign
        </Button>
      </form>
    </article>
  );
}
