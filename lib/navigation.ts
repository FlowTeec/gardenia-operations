export type RoleSection = {
  id: string;
  label: string;
  href: string;
  body: string;
  empty: string;
  group?: string;
};

export type RolePage = {
  href: "/supervisor" | "/team-leader" | "/store-keeper" | "/admin" | "/operation-manager";
  label: string;
  title: string;
  summary: string;
  sections: RoleSection[];
};

export const roles = {
  supervisor: {
    href: "/supervisor",
    label: "Supervisor",
    title: "Approvals",
    summary:
      "Review requests from team leaders assigned to you, and print the material issue tickets from their issued requests.",
    sections: [
      {
        id: "approvals",
        label: "Approvals",
        href: "/supervisor",
        body: "Pending requests from assigned team leaders, including bulk and item approval.",
        empty: "No requests are waiting for a decision.",
      },
      {
        id: "tickets",
        label: "Material issue tickets",
        href: "/supervisor?tab=issued",
        body: "Requests the store has issued, with the material issue ticket.",
        empty: "No finalized tickets yet.",
      },
    ],
  },
  operationManager: {
    href: "/operation-manager",
    label: "Operation Manager",
    title: "Operations",
    summary:
      "Review requests, monitor inventory, and open today's zones. This role cannot change stock.",
    sections: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/operation-manager",
        body: "Pending approvals, zones, and low stock.",
        empty: "Nothing is waiting.",
      },
      {
        id: "requests",
        label: "Requests",
        href: "/operation-manager/requests",
        body: "Pending, approved, rejected, in progress, and request history.",
        empty: "No requests match.",
      },
      {
        id: "inventory",
        label: "Inventory",
        href: "/operation-manager/inventory",
        body: "Material list, stock, history, and the inventory report. Viewing only.",
        empty: "No materials match.",
      },
      {
        id: "zones",
        label: "Zones",
        href: "/operation-manager/zones",
        body: "Open or close each zone for today's new material requests.",
        empty: "No zones are configured.",
      },
      {
        id: "reports",
        label: "Reports",
        href: "/operation-manager/reports",
        body: "Actual consumption, PPE issues, request statistics, and rejections.",
        empty: "No report rows yet.",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/operation-manager/settings",
        body: "View, add, edit, and remove PPE replacement intervals. Eligibility uses the active interval.",
        empty: "",
      },
    ],
  },
  teamLeader: {
    href: "/team-leader",
    label: "Team leader",
    title: "Requests",
    summary:
      "See your own requests and their status. Stock quantities are not shown.",
    sections: [
      {
        id: "requests",
        label: "My requests",
        href: "/team-leader",
        body: "Each request shows its number and status.",
        empty: "You have no requests yet.",
      },
    ],
  },
  storeKeeper: {
    href: "/store-keeper",
    label: "Store keeper",
    title: "Store",
    summary:
      "Keep inventory, prepare approved requests, and issue materials. Issuing is the step that reduces stock.",
    sections: [
      {
        id: "overview",
        label: "Overview",
        href: "/store-keeper",
        body: "Counts for requests that are waiting, prepared, or issued.",
        empty: "",
      },
      {
        id: "inventory",
        label: "Inventory",
        href: "/store-keeper/inventory",
        body: "Materials, categories, stock receipts, and material history.",
        empty: "",
      },
      {
        id: "approved",
        label: "Approved requests",
        href: "/store-keeper/approved",
        body: "Approved requests by zone that are not yet issued.",
        empty: "",
      },
      {
        id: "prepared",
        label: "Prepared",
        href: "/store-keeper/prepared",
        body: "Requests marked prepared.",
        empty: "",
      },
      {
        id: "issued",
        label: "Issued history",
        href: "/store-keeper/issued",
        body: "Requests that have been fully issued.",
        empty: "",
      },
    ],
  },
  admin: {
    href: "/admin",
    label: "Administration",
    title: "Administration",
    summary:
      "Create employee accounts, assign roles, and connect each team leader to one supervisor.",
    sections: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/admin",
        group: "Overview",
        body: "Employee counts from the current accounts.",
        empty: "",
      },
      {
        id: "employees",
        label: "Employees",
        href: "/admin/employees",
        group: "Employee Management",
        body: "Search, filter, edit, and activate employee accounts.",
        empty: "No employees match.",
      },
      {
        id: "add-employee",
        label: "Add Employee",
        href: "/admin/employees?new=1",
        group: "Employee Management",
        body: "Create an employee account.",
        empty: "",
      },
      {
        id: "assignments",
        label: "Supervisor & Team Assignment",
        href: "/admin/assignments",
        group: "System",
        body: "Each team leader has one supervisor, and that supervisor's zone.",
        empty: "",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/admin/settings",
        group: "System",
        body: "Zone request changes and the demonstration reset.",
        empty: "",
      },
    ],
  },
} as const satisfies Record<string, RolePage>;

export const roleList: RolePage[] = [
  roles.supervisor,
  roles.operationManager,
  roles.teamLeader,
  roles.storeKeeper,
  roles.admin,
];
