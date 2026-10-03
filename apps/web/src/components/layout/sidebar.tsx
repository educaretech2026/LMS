"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
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
  X,
  LogOut,
  CalendarCheck
} from "lucide-react";

const mainNav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Student", href: "/students", icon: Users },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Live Class", href: "/live-class", icon: Video },
  { label: "Fee", href: "/fee", icon: CreditCard },
  { label: "Exam", href: "/exam", icon: FileText },
  { label: "eStudy", href: "/estudy", icon: BookOpen },
  { label: "Syllabus", href: "/syllabus", icon: BookOpenCheck },
  { label: "Certificate", href: "/certificate", icon: Award },
];

const managementNav = [
  { label: "Staff / User", href: "/staff", icon: UserCheck },
  { label: "Enquiry / Leads", href: "/enquiry", icon: Headset },
  { label: "SMS", href: "/sms", icon: MessageSquare },
  { label: "Expense & Income", href: "/expense", icon: Banknote },
  { label: "Report", href: "/report", icon: BarChart2 },
];

const systemNav = [
  { label: "My Profile", href: "/profile", icon: UserCheck },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Setup", href: "/setup", icon: Wrench },
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

  const handleLogout = () => {
    // Fire and forget backend logout
    fetchApi("/auth/logout", { method: "POST" }).catch(console.error);
    
    // Immediately clear client cookie
    document.cookie = `AccessToken=; path=/; max-age=0`;
    
    // Force a cache-busting hard reload to the login page
    window.location.href = "/login?t=" + Date.now();
  };


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
        fixed inset-y-0 left-0 z-50 w-[260px] flex-col bg-brand-blue shadow-xl transition-transform duration-300 ease-in-out
        md:relative md:flex md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full hidden md:flex"}
      `}>
        {/* Brand */}
        <div className="flex flex-col items-center justify-center px-4 py-5 border-b border-white/10 shrink-0 relative gap-0">
          <div className="w-full rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.18)] overflow-hidden h-12 flex items-center justify-center">
            <Image
              src={logoImage}
              alt="Educare Group of Institutions"
              width={228}
              height={48}
              className="object-contain w-full h-full scale-[6.4] translate-y-[12px]"
              priority
            />
          </div>
          {isMobileMenuOpen && (
            <button onClick={() => setIsMobileMenuOpen?.(false)} className="md:hidden absolute right-3 top-3 text-white/70 hover:text-white bg-white/10 rounded-lg p-1">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          <NavSection
            label="Main"
            items={role === 'STUDENT' ? mainNav.filter(item => ['Dashboard', 'Live Class', 'Fee', 'Exam', 'eStudy', 'Syllabus'].includes(item.label)) : role === 'TEACHER' ? mainNav.filter(item => ['Dashboard', 'Student', 'Attendance', 'Live Class', 'Exam', 'eStudy', 'Syllabus'].includes(item.label)) : mainNav}
            activePath={path}
          />
          {role !== 'STUDENT' && role !== 'TEACHER' && (
            <NavSection label="Management" items={managementNav} activePath={path} />
          )}
          {role !== 'STUDENT' && (
            <NavSection label="System" items={role === 'TEACHER' ? systemNav.filter(item => item.label === 'Help') : systemNav} activePath={path} />
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 border-t border-white/10 pt-3">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/8 transition-colors">
            <PanelLeftClose className="h-4 w-4" />
            Collapse
          </button>

          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium text-white/50 hover:text-brand-red hover:bg-white/8 transition-colors mt-2">
            <LogOut className="h-4 w-4" />
            Logout
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
}: {
  label: string;
  items: { label: string; href: string; icon: React.ElementType }[];
  activePath: string;
}) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-white/35">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = activePath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active
                  ? "bg-brand-red text-white shadow-sm"
                  : "text-white/65 hover:text-white hover:bg-white/8"
                }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/50"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
