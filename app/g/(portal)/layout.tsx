export const instant = false;

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentActor } from "@/lib/gardenia/auth";
import { GardeniaSidebar } from "@/components/gardenia/sidebar";
import { readWorkspace } from "@/lib/gardenia/store";

export const metadata: Metadata = {
  title: {
    default: "Gardenia Smart Operations",
    template: "%s · Gardenia",
  },
};

export default async function GardeniaLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect("/g/login");

  const ws = await readWorkspace();
  const branch = actor.branchId ? ws.branches.find((b) => b.id === actor.branchId) : null;
  const unreadCount = ws.notifications.filter((n) => n.userId === actor.id && !n.read).length;

  return (
    <div className="flex min-h-svh bg-gray-50">
      <GardeniaSidebar
        role={actor.role}
        name={actor.name}
        branchName={branch?.name}
        unreadCount={unreadCount}
      />
      <main className="flex-1 min-w-0 lg:pl-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
