import Link from "next/link";
import {
  Users,
  UserX,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  AlertCircle,
  Clock,
  BookOpen,
  MessageSquare,
  ArrowRight,
  CreditCard,
  Headset,
  BarChart2,
  Banknote,
  UserCheck,
  CalendarCheck,
  Wrench,
} from "lucide-react";

type Accent = "blue" | "red" | "green" | "orange";

const accentConfig: Record<Accent, { bg: string; iconBg: string; iconText: string; valueText: string; border: string }> = {
  blue:   { bg: "bg-brand-blue/5",  border: "border-brand-blue/15",  iconBg: "bg-brand-blue/10",  iconText: "text-brand-blue",  valueText: "text-brand-blue"  },
  red:    { bg: "bg-brand-red/5",   border: "border-brand-red/15",   iconBg: "bg-brand-red/10",   iconText: "text-brand-red",   valueText: "text-brand-red"   },
  green:  { bg: "bg-success/5",     border: "border-success/15",     iconBg: "bg-success/10",     iconText: "text-success",     valueText: "text-success"     },
  orange: { bg: "bg-warning/5",     border: "border-warning/15",     iconBg: "bg-warning/10",     iconText: "text-warning",     valueText: "text-warning"     },
};

function fmt(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000)   return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val}`;
}

export function AdminDashboard({ user, statsData }: { user: any; statsData?: any }) {
  const ds = statsData || {};

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Grouped sections ──────────────────────────────────────────────
  const studentSection = [
    { title: "Total Students",   value: String(ds.totalStudents || 0),  icon: Users,        accent: "blue"   as Accent },
    { title: "Today Absent",     value: String(ds.todayAbsent || 0),    icon: UserX,        accent: "red"    as Accent },
    { title: "Total Inquiries",  value: String(ds.totalInquiry || 0),   icon: Headset,      accent: "blue"   as Accent },
    { title: "eStudy Materials", value: String(ds.eStudyMaterials || 0),icon: BookOpen,     accent: "blue"   as Accent },
  ];

  const financeSection = [
    { title: "Total Income",     value: fmt(ds.totalIncome || 0),       icon: TrendingUp,   accent: "green"  as Accent },
    { title: "Total Expense",    value: fmt(ds.totalExpense || 0),      icon: TrendingDown, accent: "red"    as Accent },
    { title: "Total Refund",     value: fmt(ds.totalRefund || 0),       icon: RefreshCcw,   accent: "orange" as Accent },
    { title: "SMS Balance",      value: String(ds.smsBalance || 0),     icon: MessageSquare,accent: "green"  as Accent },
  ];

  const feeSection = [
    { title: "Total Fee Due",    value: fmt(ds.totalFeeDue || 0),       icon: AlertCircle,  accent: "orange" as Accent },
    { title: "Fee Overdue",      value: fmt(ds.feeOverdue || 0),        icon: AlertCircle,  accent: "red"    as Accent },
    { title: "Upcoming Fee Due", value: fmt(ds.upcomingFeeDue || 0),    icon: Clock,        accent: "blue"   as Accent },
    { title: "Pending Fees",     value: fmt(ds.pendingFees || 0),       icon: FileText,     accent: "red"    as Accent },
  ];

  const quickLinks = [
    { label: "Students",    href: "/students",  icon: Users,        desc: "Manage enrollments"   },
    { label: "Attendance",  href: "/attendance",icon: CalendarCheck,desc: "Mark daily attendance" },
    { label: "Fee",         href: "/fee",        icon: CreditCard,   desc: "Collect & track fees"  },
    { label: "Enquiry",     href: "/enquiry",    icon: Headset,      desc: "Manage leads"          },
    { label: "Expense",     href: "/expense",    icon: Banknote,     desc: "Income & expenses"     },
    { label: "Staff",       href: "/staff",      icon: UserCheck,    desc: "User management"       },
    { label: "Reports",     href: "/report",     icon: BarChart2,    desc: "Full analytics"        },
    { label: "Setup",       href: "/setup",      icon: Wrench,       desc: "System configuration"  },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto w-full">

      {/* ── Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-blue-dark via-brand-blue to-brand-blue-light p-6 lg:p-8 shadow-md">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-16 w-48 h-48 rounded-full border-[32px] border-white -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full border-[16px] border-white translate-y-1/2" />
          <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full border-[2px] border-white/50 -translate-y-1/2" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-brand-red/0 via-brand-red/70 to-brand-red/0" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-white font-black text-xl shadow-inner uppercase">
              {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "A"}
            </div>
            <div>
              <p className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-0.5">Welcome back</p>
              <h1 className="text-white font-bold text-2xl tracking-tight">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email?.split("@")[0] || "Admin"}
              </h1>
              <p className="text-white/50 text-xs mt-1">{today}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase backdrop-blur-sm">
              {user?.role?.replace("_", " ") || "Admin"}
            </span>
            <Link href="/report">
              <button className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-blue px-4 py-2 text-xs font-bold shadow-sm hover:bg-white/90 transition-colors">
                Full Report <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickLinks.map(({ label, href, icon: Icon, desc }) => (
            <Link key={label} href={href}>
              <div className="group flex flex-col items-center justify-center gap-2 bg-white border border-border-soft rounded-xl p-4 shadow-sm hover:shadow-md hover:border-brand-blue/30 transition-all text-center cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-brand-blue/8 flex items-center justify-center group-hover:bg-brand-blue/15 transition-colors">
                  <Icon className="h-5 w-5 text-brand-blue" />
                </div>
                <span className="text-xs font-bold text-text-primary">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Student & Activity ── */}
      <div>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Students & Activity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {studentSection.map((s) => <StatCard key={s.title} {...s} />)}
        </div>
      </div>

      {/* ── Finance & Fees ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Finance */}
        <div>
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Finance Overview</h2>
          <div className="bg-white border border-border-soft rounded-2xl shadow-sm overflow-hidden">
            {financeSection.map(({ title, value, icon: Icon, accent }, i) => {
              const cfg = accentConfig[accent];
              return (
                <div key={title} className={`flex items-center justify-between px-5 py-4 ${i < financeSection.length - 1 ? "border-b border-border-soft" : ""} hover:bg-surface-2/50 transition-colors`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${cfg.iconText}`} />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">{title}</span>
                  </div>
                  <span className={`text-base font-black ${cfg.valueText}`}>{value}</span>
                </div>
              );
            })}
            <div className="px-5 py-3 bg-surface-2/50 border-t border-border-soft flex items-center justify-between">
              <span className="text-xs text-text-muted font-medium">Net Balance</span>
              <span className={`text-sm font-black ${(ds.totalIncome || 0) - (ds.totalExpense || 0) >= 0 ? "text-success" : "text-brand-red"}`}>
                {fmt(Math.abs((ds.totalIncome || 0) - (ds.totalExpense || 0)))}
                {(ds.totalIncome || 0) - (ds.totalExpense || 0) >= 0 ? " surplus" : " deficit"}
              </span>
            </div>
          </div>
        </div>

        {/* Fee Collection */}
        <div>
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Fee Collection Status</h2>
          <div className="bg-white border border-border-soft rounded-2xl shadow-sm overflow-hidden">
            {feeSection.map(({ title, value, icon: Icon, accent }, i) => {
              const cfg = accentConfig[accent];
              return (
                <div key={title} className={`flex items-center justify-between px-5 py-4 ${i < feeSection.length - 1 ? "border-b border-border-soft" : ""} hover:bg-surface-2/50 transition-colors`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${cfg.iconText}`} />
                    </div>
                    <span className="text-sm font-medium text-text-secondary">{title}</span>
                  </div>
                  <span className={`text-base font-black ${cfg.valueText}`}>{value}</span>
                </div>
              );
            })}
            <div className="px-5 py-3 bg-surface-2/50 border-t border-border-soft">
              <Link href="/fee" className="flex items-center justify-center gap-2 text-xs font-bold text-brand-blue hover:underline">
                Manage Fee Records <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  accent = "blue",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  accent?: Accent;
}) {
  const cfg = accentConfig[accent] ?? accentConfig.blue;

  return (
    <div className={`relative flex flex-col justify-between bg-white rounded-2xl border ${cfg.border} shadow-sm hover:shadow-md transition-all duration-200 p-5 overflow-hidden group`}>
      <div className={`absolute inset-0 ${cfg.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${cfg.iconText}`} />
        </div>
      </div>
      <div className="relative">
        <p className={`text-2xl font-black tracking-tight ${cfg.valueText}`}>{value}</p>
        <p className="text-[11px] font-semibold text-text-muted mt-1.5 uppercase tracking-wider">{title}</p>
      </div>
    </div>
  );
}
