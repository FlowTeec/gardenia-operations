import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBg?: string;
  trend?: { value: string; positive: boolean };
  alert?: boolean;
}

export function StatCard({ title, value, subtitle, icon, iconBg = "bg-green-100", trend, alert }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 ${alert ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium uppercase tracking-wide ${alert ? "text-orange-600" : "text-gray-500"}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-1 ${alert ? "text-orange-700" : "text-gray-900"}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.positive ? "text-green-600" : "text-red-500"}`}>
              {trend.positive ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0 ml-3`}>{icon}</div>
      </div>
    </div>
  );
}
