"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { useAuth } from "@/components/providers/auth-provider";
import { BirthdayPopup } from "@/components/BirthdayPopup";
import { AccessRestrictedModal } from "@/components/modals/access-restricted-modal";
import { FirstTimePasswordModal } from "@/components/modals/first-time-password-modal";
import { ROUTE_PERMISSION_MAP, MODULE_PERMISSIONS } from "@/lib/permissions";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function DashboardLayout({
  children,
  title,
  role: propRole,
  module: explicitModule,
}: {
  children: React.ReactNode;
  title?: string;
  role?: string;
  module?: string;
}) {
  const { role: authRole, hasPermission, permissions } = useAuth();
  const activeRole = propRole || authRole;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Determine required module for this route
  let requiredModule = explicitModule;
  if (!requiredModule && pathname) {
    for (const [routePrefix, modKey] of Object.entries(ROUTE_PERMISSION_MAP)) {
      if (pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)) {
        requiredModule = modKey;
        break;
      }
    }
  }

  const isAuthorized = !requiredModule || hasPermission(requiredModule);
  const moduleDef = requiredModule
    ? MODULE_PERMISSIONS.find(m => m.key === requiredModule)
    : null;
  const moduleName = moduleDef?.label || requiredModule || "This Module";

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar
        role={activeRole || undefined}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav title={title} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-surface">
          {!isAuthorized ? (
            <div className="min-h-[75vh] flex items-center justify-center p-6">
              <div className="max-w-md w-full rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-card p-8 text-center shadow-lg">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto mb-5 shadow-xs">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  Access Restricted
                </h2>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 mt-1">
                  Permission Required: {moduleName}
                </p>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  Your current account role does not have authorization to view or operate in this module.
                  Please contact a system administrator to adjust your permissions in the Roles & Permissions matrix.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Dashboard</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <BirthdayPopup />
      <AccessRestrictedModal />
      <FirstTimePasswordModal />
    </div>
  );
}
