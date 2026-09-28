"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard,
  BookOpenCheck,
  MonitorPlay,
  BookOpen,
  ClipboardList,
  GraduationCap,
  CreditCard,
} from "lucide-react";

import { BirthdayPopup } from "@/components/BirthdayPopup";

export function DashboardLayout({ children, title, role: propRole }: { children: React.ReactNode; title?: string; role?: string }) {
  const { role: authRole } = useAuth();
  const activeRole = propRole || authRole;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          {children}
        </main>
      </div>
      <BirthdayPopup />
    </div>
  );
}
