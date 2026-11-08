import type { Area, Role } from "./types";

export const SESSION_COOKIE = "mrs-session";
export const SESSION_DAYS = 7;

export const LOGIN_FAILED = "The employee ID, email, or password is incorrect.";
export const LOGIN_INACTIVE = "This account is inactive. Ask an administrator to activate it.";
export const LOGIN_UNAVAILABLE =
  "Sign-in is unavailable until an administrator is provisioned on the server.";
export const FORGOT_PASSWORD_MESSAGE =
  "إذا نسيت كلمة المرور، يُرجى التواصل مع المشرف المسؤول عنك (Supervisor) لمساعدتك في استعادة إمكانية الدخول.";

export function portalPath(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "TEAM_LEADER") return "/team-leader";
  if (role === "SUPERVISOR") return "/supervisor";
  if (role === "OPERATION_MANAGER") return "/operation-manager";
  return "/store-keeper";
}

export function areaForPath(pathname: string): Area | "account" | null {
  if (pathname === "/account" || pathname.startsWith("/account/")) return "account";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/team-leader" || pathname.startsWith("/team-leader/")) return "leader";
  if (pathname === "/supervisor" || pathname.startsWith("/supervisor/")) return "supervisor";
  if (pathname === "/operation-manager" || pathname.startsWith("/operation-manager/")) return "operations";
  if (pathname === "/store-keeper" || pathname.startsWith("/store-keeper/")) return "store";
  return null;
}

export function roleMatchesArea(role: Role, area: Area | "account") {
  if (area === "account") return true;
  if (area === "admin") return role === "ADMIN";
  if (area === "leader") return role === "TEAM_LEADER";
  if (area === "supervisor") return role === "SUPERVISOR";
  if (area === "operations") return role === "OPERATION_MANAGER";
  return role === "STORE_KEEPER";
}
