"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { APPLICATION_NAME } from "@/lib/brand";
import { roleList } from "@/lib/navigation";
import { portalPath } from "@/lib/workspace/access";
import { logoutAction } from "@/lib/workspace/actions";
import type { Role } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  role,
  displayName,
  teamName,
  storageNote,
}: {
  children: React.ReactNode;
  role: Role;
  displayName: string;
  teamName?: string | null;
  storageNote: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const home = portalPath(role);
  const current = roleList.find((item) => item.href === home);
  const account = pathname === "/account" || pathname.startsWith("/account/");
  const activeSection = current?.sections.find((section) =>
    sectionIsActive(pathname, search, section.href, home),
  );
  const pageLabel = account ? "Account" : (activeSection?.label ?? current?.label ?? "Workspace");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2.5 border-t-2 border-b border-t-brand bg-card px-3 py-1.5 shadow-sm sm:gap-3 sm:px-4 lg:h-14 lg:py-0">
          <Link
            href={home}
            title={APPLICATION_NAME}
            aria-label={APPLICATION_NAME}
            className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setOpen(false)}
          >
            <BrandLogo height={36} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold tracking-tight sm:text-sm">Eagle Environmental Services</span>
              <span className="block truncate text-[11px] font-medium text-muted-foreground sm:text-xs">Material Request</span>
            </span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium">{pageLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{current ? current.label : "Workspace"}</p>
            </div>
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {teamName ? <p className="truncate text-xs text-muted-foreground">{teamName}</p> : null}
            </div>
            <form action={logoutAction} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-md px-2 py-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 lg:font-normal lg:text-muted-foreground lg:hover:bg-accent lg:hover:text-foreground lg:hover:no-underline"
              >
                Log out
              </button>
            </form>
            <button
              type="button"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
              aria-expanded={open}
              aria-controls="workspace-nav"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={cn(
            "shrink-0 flex-col border-b bg-sidebar lg:sticky lg:top-14 lg:flex lg:h-[calc(100svh-3.5rem)] lg:w-64 lg:overflow-y-auto lg:border-r lg:border-b-0",
            open ? "flex" : "hidden",
          )}
        >
          {current ? (
            <nav
              id="workspace-nav"
              aria-label={`${current.label} sections`}
              className="flex flex-col gap-1 px-3 py-3"
            >
              <NavSections
                sections={current.sections}
                pathname={pathname}
                search={search}
                home={home}
                fallbackLabel={current.label}
                onNavigate={() => setOpen(false)}
              />
              <SectionLink href="/account" label="Account" active={account} onNavigate={() => setOpen(false)} />
            </nav>
          ) : null}

          <div className="border-t px-3 py-3 lg:mt-auto">
            <p className="px-2.5 text-xs text-muted-foreground">Signed in as</p>
            <p className="px-2.5 text-sm font-medium">{displayName}</p>
            {teamName ? <p className="px-2.5 text-xs text-muted-foreground">{teamName}</p> : null}
            <p className="px-2.5 pb-2 text-xs text-muted-foreground">{current?.label}</p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Log out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="border-b bg-muted/70 px-4 py-2 text-sm font-medium sm:hidden">{pageLabel}</p>
          <p className="border-b bg-muted/40 px-4 py-2 text-xs leading-5 text-muted-foreground md:px-8">
            {storageNote}
          </p>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function sectionIsActive(pathname: string, search: string, href: string, home: string) {
  const queryIndex = href.indexOf("?");
  const path = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : href.slice(queryIndex + 1);
  if (query) return pathname === path && search === query;
  if (href === "/admin/employees") {
    return pathname === "/admin/employees" && !new URLSearchParams(search).has("new");
  }
  return pathname === path || (path !== home && pathname.startsWith(`${path}/`));
}

function NavSections({
  sections,
  pathname,
  search,
  home,
  fallbackLabel,
  onNavigate,
}: {
  sections: { id: string; label: string; href: string; group?: string }[];
  pathname: string;
  search: string;
  home: string;
  fallbackLabel: string;
  onNavigate: () => void;
}) {
  const groups: { label: string; sections: typeof sections }[] = [];
  for (const section of sections) {
    const label = section.group ?? "";
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.sections.push(section);
    else groups.push({ label, sections: [section] });
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.label || "links"} className="flex flex-col gap-1">
          <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {group.label || fallbackLabel}
          </p>
          {group.sections.map((section) => (
            <SectionLink
              key={section.id}
              href={section.href}
              label={section.label}
              active={sectionIsActive(pathname, search, section.href, home)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function SectionLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "shrink-0 rounded-md border-l-2 border-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-brand bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
