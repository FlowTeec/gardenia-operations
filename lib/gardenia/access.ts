import type { GardeniaRole, GardeniaUser, IssueTicket, SalesRequest } from "./types";

export const SESSION_COOKIE = "gardenia_session";
export const SESSION_DAYS = 7;

export type Area =
  | "admin"
  | "salesperson"
  | "branch_manager"
  | "branch_storekeeper"
  | "warehouse_manager"
  | "management";

export function portalPath(role: GardeniaRole): string {
  switch (role) {
    case "admin": return "/g/admin";
    case "salesperson": return "/g/salesperson";
    case "branch_manager": return "/g/manager";
    case "branch_storekeeper": return "/g/storekeeper";
    case "warehouse_manager": return "/g/warehouse";
    case "management": return "/g/management";
  }
}

export function roleMatchesArea(role: GardeniaRole, area: Area): boolean {
  // Admin is strictly restricted to the admin area only.
  // Operational areas (salesperson, manager, storekeeper, warehouse, management)
  // are off-limits to the system administrator.
  return role === area;
}

export function canAccessBranch(user: GardeniaUser, branchId: string): boolean {
  if (user.role === "admin" || user.role === "management" || user.role === "warehouse_manager") return true;
  return user.branchId === branchId;
}

export function canApproveSalesRequest(user: GardeniaUser, requestBranchId: string): boolean {
  if (user.role !== "branch_manager") return false;
  return user.branchId === requestBranchId;
}

export function canIssueSalesRequest(user: GardeniaUser, requestBranchId: string): boolean {
  if (user.role !== "branch_storekeeper") return false;
  return user.branchId === requestBranchId;
}

export function canViewSalesRequest(user: GardeniaUser, request: SalesRequest): boolean {
  if (user.role === "management") return true;
  if (user.role === "salesperson") return request.salespersonId === user.id;
  if (user.role === "branch_manager" || user.role === "branch_storekeeper") {
    return user.branchId === request.branchId;
  }
  return false;
}

export function canViewIssueTicket(user: GardeniaUser, ticket: IssueTicket): boolean {
  if (user.role === "management") return true;
  if (user.role === "salesperson") return ticket.salespersonId === user.id;
  if (user.role === "branch_manager" || user.role === "branch_storekeeper") {
    return user.branchId === ticket.branchId;
  }
  return false;
}

export function canEditSellingPrice(user: GardeniaUser): boolean {
  return user.role === "admin" || user.role === "management";
}
