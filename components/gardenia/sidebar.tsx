"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  CheckSquare,
  Package,
  Warehouse,
  BarChart3,
  Bell,
  Users,
  Tag,
  GitBranch,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ClipboardList,
  TruckIcon,
  History,
  User,
} from "lucide-react";
import { useState } from "react";

import { logoutAction } from "@/lib/gardenia/actions";
import type { GardeniaRole } from "@/lib/gardenia/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: GardeniaRole[];
}

const navItems: NavItem[] = [
  // Admin
  { label: "Dashboard", href: "/g/admin", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["admin"] },
  { label: "Users", href: "/g/admin/users", icon: <Users className="w-4 h-4" />, roles: ["admin"] },
  { label: "Product Catalog", href: "/g/admin/products", icon: <Tag className="w-4 h-4" />, roles: ["admin"] },
  { label: "Branches", href: "/g/admin/branches", icon: <GitBranch className="w-4 h-4" />, roles: ["admin"] },
  // Management
  { label: "Overview", href: "/g/management", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["management"] },
  { label: "Selling Prices", href: "/g/management/prices", icon: <Tag className="w-4 h-4" />, roles: ["management"] },
  // Salesperson
  { label: "Dashboard", href: "/g/salesperson", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["salesperson"] },
  { label: "New Material Request", href: "/g/salesperson/new-request", icon: <ShoppingCart className="w-4 h-4" />, roles: ["salesperson"] },
  { label: "Price List", href: "/g/salesperson/catalog", icon: <Tag className="w-4 h-4" />, roles: ["salesperson"] },
  // Branch Manager
  { label: "Dashboard", href: "/g/manager", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["branch_manager"] },
  { label: "Approval Center", href: "/g/manager/approvals", icon: <CheckSquare className="w-4 h-4" />, roles: ["branch_manager"] },
  { label: "Branch Inventory", href: "/g/manager/inventory", icon: <Package className="w-4 h-4" />, roles: ["branch_manager"] },
  // Branch Storekeeper
  { label: "Dashboard", href: "/g/storekeeper", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["branch_storekeeper"] },
  { label: "Issue Queue", href: "/g/storekeeper/issues", icon: <ClipboardList className="w-4 h-4" />, roles: ["branch_storekeeper"] },
  { label: "Branch Inventory", href: "/g/storekeeper/inventory", icon: <Package className="w-4 h-4" />, roles: ["branch_storekeeper"] },
  { label: "Replenishment", href: "/g/storekeeper/replenishment", icon: <TruckIcon className="w-4 h-4" />, roles: ["branch_storekeeper"] },
  // Warehouse Manager
  { label: "Dashboard", href: "/g/warehouse", icon: <LayoutDashboard className="w-4 h-4" />, roles: ["warehouse_manager"] },
  { label: "Warehouse Inventory", href: "/g/warehouse/inventory", icon: <Warehouse className="w-4 h-4" />, roles: ["warehouse_manager"] },
  { label: "Replenishment Requests", href: "/g/warehouse/replenishment", icon: <TruckIcon className="w-4 h-4" />, roles: ["warehouse_manager"] },
  // Shared (operational roles only – admin is excluded from operational data)
  { label: "Issue Tickets", href: "/g/tickets", icon: <ClipboardList className="w-4 h-4" />, roles: ["salesperson", "branch_manager", "branch_storekeeper", "management"] },
  { label: "Reports", href: "/g/reports", icon: <BarChart3 className="w-4 h-4" />, roles: ["management", "warehouse_manager", "branch_manager"] },
  { label: "Transaction History", href: "/g/reports/history", icon: <History className="w-4 h-4" />, roles: ["management", "warehouse_manager", "branch_manager", "branch_storekeeper"] },
  { label: "Notifications", href: "/g/notifications", icon: <Bell className="w-4 h-4" />, roles: ["admin", "salesperson", "branch_manager", "branch_storekeeper", "warehouse_manager", "management"] },
  { label: "Profile", href: "/g/profile", icon: <User className="w-4 h-4" />, roles: ["admin", "salesperson", "branch_manager", "branch_storekeeper", "warehouse_manager", "management"] },
];

interface SidebarProps {
  role: GardeniaRole;
  name: string;
  branchName?: string;
  unreadCount: number;
}

function GardeniaLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500 flex-shrink-0">
        <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 4C10 4 6 9 6 14c0 3 1.5 5.5 4 7l1 7h10l1-7c2.5-1.5 4-4 4-7 0-5-4-10-10-10z" fill="white" opacity="0.9"/>
          <path d="M16 8 Q19 12 16 16 Q13 12 16 8Z" fill="#16a34a"/>
        </svg>
      </div>
      <div>
        <div className="text-white font-bold text-sm leading-tight">Gardenia</div>
        <div className="text-green-300 text-[10px] leading-tight">Pest Control Ops</div>
      </div>
    </div>
  );
}

const roleLabels: Record<GardeniaRole, string> = {
  admin: "Administrator",
  salesperson: "Salesperson",
  branch_manager: "Branch Manager",
  branch_storekeeper: "Branch Storekeeper",
  warehouse_manager: "Warehouse Manager",
  management: "Management",
};

export function GardeniaSidebar({ role, name, branchName, unreadCount }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = navItems.filter((item) => item.roles.includes(role));

  const isActive = (href: string) => {
    if (href === "/g/admin" || href === "/g/management" || href === "/g/salesperson" ||
        href === "/g/manager" || href === "/g/storekeeper" || href === "/g/warehouse") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <GardeniaLogo />
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-white text-sm font-medium truncate">{name}</div>
        <div className="text-green-300 text-xs">{roleLabels[role]}</div>
        {branchName && <div className="text-green-400 text-xs mt-0.5">{branchName}</div>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              isActive(item.href)
                ? "bg-green-600 text-white"
                : "text-green-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.href === "/g/notifications" && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-white/10">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1a2e1a] flex-shrink-0 h-screen sticky top-0 print:hidden">
        {sidebarContent}
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#1a2e1a] px-4 py-3 flex items-center justify-between border-b border-white/10 print:hidden">
        <GardeniaLogo />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="text-white p-1.5 rounded-lg hover:bg-white/10"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 bg-[#1a2e1a] transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
