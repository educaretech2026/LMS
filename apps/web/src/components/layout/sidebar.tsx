"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import logoImage from "@/logos/logo1.png";
import {
  LayoutDashboard,
  Users,
  Video,
  CreditCard,
  FileText,
  BookOpen,
  BookOpenCheck,
  Award,
  UserCheck,
  Headset,
  MessageSquare,
  Banknote,
  BarChart2,
  Settings,
  Wrench,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogOut,
  CalendarCheck,
  ClipboardList,
  MessagesSquare,
  ShieldAlert,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  module?: string;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Student", href: "/students", icon: Users, module: "STUDENTS" },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, module: "ATTENDANCE" },
  { label: "Assignments", href: "/assignments", icon: ClipboardList, module: "ASSIGNMENTS" },
  { label: "Doubt Clearance", href: "/doubts", icon: MessagesSquare, module: "DOUBTS" },
  { label: "Live Class", href: "/live-class", icon: Video, module: "LIVE_CLASSES" },
  { label: "Fee", href: "/fee", icon: CreditCard, module: "FEES" },
  { label: "Exam", href: "/exam", icon: FileText, module: "EXAMS" },
  { label: "eStudy", href: "/estudy", icon: BookOpen, module: "ESTUDY" },
  { label: "Syllabus", href: "/syllabus", icon: BookOpenCheck, module: "SYLLABUS" },
  { label: "Certificate", href: "/certificate", icon: Award, module: "CERTIFICATES" },
];

const managementNav: NavItem[] = [
  { label: "Staff / User", href: "/staff", icon: UserCheck, module: "STAFF" },
  { label: "Enquiry / Leads", href: "/enquiry", icon: Headset, module: "ENQUIRY" },
  { label: "Forms", href: "/forms", icon: FileText, module: "FORMS" },
  { label: "SMS", href: "/sms", icon: MessageSquare, module: "SMS" },
  { label: "Expense & Income", href: "/expense", icon: Banknote, module: "FINANCE" },
  { label: "Report", href: "/report", icon: BarChart2, module: "REPORTS" },
  { label: "Audit Logs", href: "/audit-logs", icon: ShieldAlert, module: "AUDIT_LOGS" },
];

const systemNav: NavItem[] = [
  { label: "My Profile", href: "/profile", icon: UserCheck },
  { label: "Settings", href: "/settings", icon: Settings, module: "SETTINGS" },
  { label: "Setup", href: "/setup", icon: Wrench, module: "SETUP" },
  { label: "Help", href: "/help", icon: HelpCircle },
];

export function Sidebar({
  role,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}: {
  role?: string,
  isMobileMenuOpen?: boolean,
  setIsMobileMenuOpen?: (open: boolean) => void
}) {
  const path = usePathname();
  const router = useRouter();

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("educare_sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("educare_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/login?t=" + Date.now();
  };

  const { role: authRole, hasPermission } = useAuth();
  const currentRole = role || authRole;
  const r = currentRole?.toUpperCase().replace(/\s+/g, '_') || '';

  const visibleMainNav = mainNav.filter(item => {
    if (r === 'STUDENT' || r === 'PUBLIC_LEARNER') {
      const allowedStudentLabels = [
        'Dashboard',
        'Assignments',
        'Doubt Clearance',
        'Live Class',
        'Fee',
        'Exam',
        'eStudy',
        'Syllabus',
        'Certificate',
      ];
      return allowedStudentLabels.includes(item.label) && (!item.module || hasPermission(item.module));
    }
    if (!item.module) return true;
    return hasPermission(item.module);
  });

  const visibleManagementNav =
    r === 'STUDENT' || r === 'PUBLIC_LEARNER'
      ? []
      : managementNav.filter(item => !item.module || hasPermission(item.module));

  const visibleSystemNav = systemNav.filter(item => {
    if (!item.module) return true;
    return hasPermission(item.module);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen?.(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex-col bg-brand-blue shadow-xl transition-all duration-300 ease-in-out
        md:relative md:flex md:translate-x-0
        ${isCollapsed ? "md:w-[72px]" : "md:w-[260px]"}
        w-[260px]
        ${isMobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full hidden md:flex"}
      `}>
        {/* Brand */}
        <div className={`flex flex-col items-center justify-center px-3 py-5 border-b border-white/10 shrink-0 relative transition-all duration-300 ${isCollapsed ? "h-[76px]" : "h-[88px]"}`}>
          {!isCollapsed ? (
            <div className="w-full rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.18)] overflow-hidden h-12 flex items-center justify-center transition-all duration-300">
              <Image
                src={logoImage}
                alt="Educare Group of Institutions"
                width={228}
                height={48}
                className="object-contain w-full h-full scale-[6.4] translate-y-[12px]"
                priority
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] overflow-hidden flex items-center justify-center transition-all duration-300" title="Educare LMS">
              <Image
                src={logoImage}
                alt="Educare"
                width={40}
                height={40}
                className="object-contain w-full h-full scale-[3.4] translate-y-[3px]"
                priority
              />
            </div>
          )}
          {isMobileMenuOpen && (
            <button onClick={() => setIsMobileMenuOpen?.(false)} className="md:hidden absolute right-3 top-3 text-white/70 hover:text-white bg-white/10 rounded-lg p-1">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          {visibleMainNav.length > 0 && (
            <NavSection
              label="Main"
              items={visibleMainNav}
              activePath={path}
              isCollapsed={isCollapsed}
            />
          )}
          
          {visibleManagementNav.length > 0 && (
            <NavSection 
              label="Management" 
              items={visibleManagementNav} 
              activePath={path} 
              isCollapsed={isCollapsed}
            />
          )}

          {visibleSystemNav.length > 0 && (
            <NavSection 
              label="System & Account" 
              items={visibleSystemNav} 
              activePath={path} 
              isCollapsed={isCollapsed}
            />
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 border-t border-white/10 pt-3">
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/8 transition-colors ${
              isCollapsed ? "justify-center px-2" : "px-3"
            }`}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0 text-white/70" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span className="truncate">Collapse</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg py-2.5 text-xs font-medium text-white/50 hover:text-brand-red hover:bg-white/8 transition-colors mt-2 ${
              isCollapsed ? "justify-center px-2" : "px-3"
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({
  label,
  items,
  activePath,
  isCollapsed,
}: {
  label: string;
  items: { label: string; href: string; icon: React.ElementType }[];
  activePath: string;
  isCollapsed?: boolean;
}) {
  return (
    <div>
      {!isCollapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-white/35 truncate">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const active = activePath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all ${
                isCollapsed ? "justify-center px-2" : "px-3"
              } ${
                active
                  ? "bg-brand-red text-white shadow-sm"
                  : "text-white/65 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/50"}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
