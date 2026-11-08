export const instant = false;
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { currentActor } from "@/lib/gardenia/auth";
import { portalPath } from "@/lib/gardenia/access";
import { GardeniaLoginForm } from "@/components/gardenia/login-form";

export const metadata: Metadata = { title: "Sign In – Gardenia Pest Control Operations" };

export default async function GardeniaLoginPage() {
  const actor = await currentActor();
  if (actor) redirect(portalPath(actor.role));

  return (
    <div className="min-h-svh bg-gradient-to-br from-[#1a2e1a] via-[#2d4a2d] to-[#1a2e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-4 shadow-lg">
            <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 4C10 4 6 9 6 14c0 3 1.5 5.5 4 7l1 7h10l1-7c2.5-1.5 4-4 4-7 0-5-4-10-10-10z" fill="white" opacity="0.9"/>
              <path d="M16 8 Q19 12 16 16 Q13 12 16 8Z" fill="#16a34a"/>
              <path d="M13 10 Q16 8 16 14 Q10 13 13 10Z" fill="#16a34a" opacity="0.7"/>
              <path d="M19 10 Q22 13 16 14 Q16 8 19 10Z" fill="#16a34a" opacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gardenia</h1>
          <p className="text-green-300 text-sm mt-1">Public Health Pest Control – Operations</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in with your employee ID or email</p>
          <GardeniaLoginForm />
        </div>

        <div className="mt-6 bg-white/10 rounded-xl p-4">
          <p className="text-green-200 text-xs font-medium mb-1">Employee IDs</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-green-100">
            <span className="font-medium">Admin:</span><span>EMP001</span>
            <span className="font-medium">Warehouse Mgr:</span><span>EMP002</span>
            <span className="font-medium">Management:</span><span>EMP003</span>
            <span className="font-medium">Branch 1 Manager:</span><span>EMP101</span>
            <span className="font-medium">Branch 1 Store:</span><span>EMP102</span>
            <span className="font-medium">Branch 1 Sales:</span><span>EMP103</span>
          </div>
          <p className="text-green-300 text-[10px] mt-2">Passwords are set via environment variables.</p>
        </div>
      </div>
    </div>
  );
}
