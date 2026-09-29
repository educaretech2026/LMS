import Link from "next/link";
import {
  Bell,
  Calendar,
  MessageSquare,
  Users,
  UserX,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  AlertCircle,
  Clock,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export function AdminDashboard({ user, statsData }: { user: any, statsData?: any }) {
  const ds = statsData || {};

  const stats = [
    { title: "Total Students",     value: String(ds.totalStudents || 0),        icon: Users,        accent: "blue" as const },
    { title: "Total Inquiry",      value: String(ds.totalInquiry || 0),         icon: FileText,     accent: "blue" as const },
    { title: "Today Absent",       value: String(ds.todayAbsent || 0),          icon: UserX,        accent: "red" as const },
    { title: "Total Income",       value: `₹${ds.totalIncome || 0}`,            icon: TrendingUp,   accent: "green" as const },
    { title: "Total Expense",      value: `₹${ds.totalExpense || 0}`,           icon: TrendingDown, accent: "red" as const },
    { title: "Total Refund",       value: `₹${ds.totalRefund || 0}`,            icon: RefreshCcw,   accent: "orange" as const },
    { title: "Total Fee Due",      value: `₹${ds.totalFeeDue || 0}`,            icon: AlertCircle,  accent: "orange" as const },
    { title: "Fee Overdue",        value: `₹${ds.feeOverdue || 0}`,             icon: AlertCircle,  accent: "red" as const },
    { title: "Upcoming Fee Due",   value: `₹${ds.upcomingFeeDue || 0}`,         icon: Clock,        accent: "blue" as const },
    { title: "Pending Fees",       value: `₹${ds.pendingFees || 0}`,            icon: FileText,     accent: "red" as const },
    { title: "eStudy Materials",   value: String(ds.eStudyMaterials || 0),      icon: BookOpen,     accent: "blue" as const },
    { title: "SMS Balance",        value: String(ds.smsBalance || 0),           icon: MessageSquare,accent: "green" as const },
  ];
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* ── Banner ── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-blue-dark via-brand-blue to-brand-blue-light p-6 shadow-sm">
        {/* Subtle geometric accents */}
        <div className="absolute top-0 right-0 w-64 h-full opacity-10">
          <div className="absolute top-0 right-8 w-32 h-32 rounded-full border-[24px] border-white -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full border-[12px] border-white translate-y-1/2" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-brand-red/0 via-brand-red/60 to-brand-red/0" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="h-12 w-12 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-lg shadow-inner uppercase">
              {user?.email?.charAt(0) || "A"}
            </div>
            <div>
              <p className="text-white/65 text-xs font-medium tracking-wide mb-0.5">Welcome back</p>
              <h2 className="text-white font-semibold text-xl tracking-tight">{user?.email?.split('@')[0] || "Admin"}</h2>
              <p className="text-white/55 text-xs mt-0.5">Educare Kalathipady · 2026–2027</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold tracking-widest text-white uppercase">
            {user?.role || "Admin"}
          </span>
        </div>
      </div>

      {/* ── Alert Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoPill
          icon={<Bell className="h-3.5 w-3.5" />}
          label="Today Alerts"
          value="0"
          color="red"
        />

        <InfoPill
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="SMS Balance"
          value={String(ds.smsBalance || 1000)}
          color="green"
        />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* ── Footer action ── */}
      <div className="flex justify-end pt-1">
        <Link href="/report">
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-blue-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2">
            View Full Report
            <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}


type Accent = "blue" | "red" | "green" | "orange";

const accentConfig: Record<Accent, { bar: string; iconBg: string; iconText: string; valueText: string }> = {
  blue:   { bar: "bg-brand-blue",   iconBg: "bg-brand-blue/8",   iconText: "text-brand-blue",   valueText: "text-brand-blue"   },
  red:    { bar: "bg-brand-red",    iconBg: "bg-brand-red/8",    iconText: "text-brand-red",    valueText: "text-brand-red"    },
  green:  { bar: "bg-success",      iconBg: "bg-success/8",      iconText: "text-success",      valueText: "text-success"      },
  orange: { bar: "bg-warning",      iconBg: "bg-warning/8",      iconText: "text-warning",      valueText: "text-warning"      },
};

/* ── Components ── */

function InfoPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "red" | "blue" | "green";
}) {
  const cls = {
    red:   "text-brand-red   bg-red-50   border-red-100",
    blue:  "text-brand-blue  bg-blue-50  border-blue-100",
    green: "text-success     bg-green-50 border-green-100",
  }[color];

  return (
    <div className="flex items-center justify-between rounded-lg bg-white border border-border-soft px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <span className="text-text-muted">{icon}</span>
        {label}
      </div>
      <span className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
        {value}
      </span>
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
  accent?: string;
}) {
  const cfg = accentConfig[accent as Accent] ?? accentConfig.blue;

  return (
    <div className="group relative bg-white rounded-xl border border-border-soft shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden p-5">
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.bar}`} />

      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${cfg.iconText}`} />
        </div>
      </div>

      <div className="mt-4">
        <p className={`text-2xl font-bold tracking-tight ${cfg.valueText}`}>{value}</p>
        <p className="text-[11px] font-medium text-text-muted mt-1 uppercase tracking-wider">{title}</p>
      </div>
    </div>
  );
}
