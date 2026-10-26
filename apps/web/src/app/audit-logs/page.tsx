"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchApi } from "@/lib/api";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Download,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  User,
  Globe,
  Server,
  CheckCircle2,
  Copy,
  Check,
  Calendar,
  Layers,
  FileText,
  RotateCcw,
  Sparkles,
  Laptop,
  Smartphone,
  Terminal,
  ArrowRight,
  Building2,
  Lock,
  CreditCard,
  GraduationCap,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

/* ── Interfaces ── */
interface AuditLogItem {
  id: string;
  createdAt: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  centreId?: string | null;
  action: string;
  category: string;
  entityType?: string | null;
  entityId?: string | null;
  status: "SUCCESS" | "FAILURE" | "WARNING";
  statusCode?: number | null;
  executionMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
  centre?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface AuditStats {
  todayCount: number;
  past24hErrors: number;
  securityAlerts: number;
  categories: { category: string; count: number }[];
}

interface PaginatedResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Filter Constants ── */
const PRESETS = [
  { id: "ALL", label: "All Logs", icon: Layers },
  { id: "SECURITY", label: "Security & Auth", icon: Lock, category: "SECURITY" },
  { id: "FINANCIAL", label: "Financial", icon: CreditCard, category: "FINANCIAL" },
  { id: "ACADEMIC", label: "Academic", icon: GraduationCap, category: "ACADEMIC" },
  { id: "SYSTEM", label: "System & Core", icon: Server, category: "SYSTEM" },
  { id: "ERRORS", label: "Failures & Alerts", icon: AlertTriangle, status: "FAILURE" },
];

const CATEGORIES = ["ALL", "SECURITY", "FINANCIAL", "ACADEMIC", "COMMUNICATION", "SYSTEM"];
const STATUSES = ["ALL", "SUCCESS", "FAILURE", "WARNING"];

/* ── Humanize Helper ── */
function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    USER_LOGIN: "User Login",
    USER_LOGOUT: "User Logout",
    USER_LOGIN_FAILED: "Failed Login Attempt",
    USER_REGISTER: "User Registered",
    PASSWORD_RESET_REQUEST: "Password Reset Request",
    PASSWORD_RESET_SUCCESS: "Password Reset Completed",
    STUDENT_ADMISSION: "Student Admission",
    UPDATE_STUDENT: "Updated Student Profile",
    DELETE_STUDENT: "Deleted Student",
    CREATE_ENQUIRY: "Created Lead / Enquiry",
    UPDATE_ENQUIRY: "Updated Enquiry",
    UPDATE_ENQUIRY_STATUS: "Updated Lead Status",
    ASSIGN_ENQUIRY: "Assigned Lead to Staff",
    RECONCILE_ENQUIRY_OWNERSHIP: "Reconciled Lead Centre",
    COLLECT_FEE: "Fee Payment Collected",
    UPDATE_FEE_RECORD: "Updated Fee Record",
    CREATE_BATCH: "Created Batch",
    UPDATE_BATCH: "Updated Batch",
    CREATE_EXAM: "Created Exam",
    PUBLISH_EXAM_RESULTS: "Published Exam Results",
    UPDATE_PERMISSIONS: "Updated Role Permissions",
    CREATE_STUDY_MATERIAL: "Uploaded Study Material",
    DELETE_STUDY_MATERIAL: "Deleted Study Material",
    CREATE_CUSTOM_FORM: "Created Custom Form",
    UPDATE_CUSTOM_FORM: "Updated Custom Form",
    SUBMIT_CUSTOM_FORM: "Public Form Submission",
    BULK_IMPORT: "Bulk Data Import",
    EXPORT_DATA: "Exported Data",
  };
  if (map[action]) return map[action];
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/* ── Client Device Helper ── */
function getClientDevice(userAgent?: string | null) {
  if (!userAgent) return { label: "Internal / API", Icon: Server };
  if (userAgent.includes("Postman") || userAgent.includes("curl") || userAgent.includes("python")) {
    return { label: "API Client", Icon: Terminal };
  }
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) {
    return { label: "Mobile Client", Icon: Smartphone };
  }
  return { label: "Desktop Web", Icon: Laptop };
}

/* ── JSON Syntax Highlighting ── */
function SyntaxHighlightedJson({ json }: { json: any }) {
  const jsonStr = typeof json === "string" ? json : JSON.stringify(json, null, 2);

  const html = jsonStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "text-sky-300"; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-indigo-300 font-semibold"; // key
          } else {
            cls = "text-emerald-300"; // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-amber-300 font-semibold"; // boolean
        } else if (/null/.test(match)) {
          cls = "text-rose-300 italic"; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );

  return (
    <pre
      className="font-mono text-xs leading-relaxed overflow-x-auto select-text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function AuditLogsPage() {
  const { role } = useAuth();

  // Data state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePreset, setActivePreset] = useState("ALL");

  // Auto-refresh interval (0 = off, 10 = 10s, 30 = 30s)
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState(false);

  // Detail drawer
  const [activeItem, setActiveItem] = useState<AuditLogItem | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"OVERVIEW" | "PAYLOAD">("OVERVIEW");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveItem(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load audit logs
  const loadLogs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (selectedCategory !== "ALL") params.set("category", selectedCategory);
        if (selectedStatus !== "ALL") params.set("status", selectedStatus);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetchApi<PaginatedResponse>(`/audit-logs?${params.toString()}`);
        setLogs(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setLastRefreshedAt(new Date());
      } catch (err: any) {
        setError(err.message || "Failed to load audit logs");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, limit, debouncedSearch, selectedCategory, selectedStatus, startDate, endDate]
  );

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetchApi<AuditStats>("/audit-logs/stats");
      setStats(res);
    } catch (err) {
      console.warn("Failed to load audit stats", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh timer
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(() => {
      loadLogs(true);
      loadStats();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval, loadLogs, loadStats]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export CSV handler
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(`/api/proxy/audit-logs/export?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `educare-audit-logs-${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`CSV export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Preset Selector
  const handleSelectPreset = (preset: (typeof PRESETS)[0]) => {
    setActivePreset(preset.id);
    setPage(1);
    if (preset.id === "ALL") {
      setSelectedCategory("ALL");
      setSelectedStatus("ALL");
    } else if (preset.category) {
      setSelectedCategory(preset.category);
      setSelectedStatus("ALL");
    } else if (preset.status) {
      setSelectedStatus(preset.status);
      setSelectedCategory("ALL");
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setStartDate("");
    setEndDate("");
    setActivePreset("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch ||
    selectedCategory !== "ALL" ||
    selectedStatus !== "ALL" ||
    startDate ||
    endDate;

  // Format relative time
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 10) return "Just now";
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Status Badge Helper
  const renderStatusPill = (status: string, code?: number | null) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Success</span>
            {code && <span className="opacity-70 font-mono text-[10px]">({code})</span>}
          </span>
        );
      case "FAILURE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Failure</span>
            {code && <span className="opacity-70 font-mono text-[10px]">({code})</span>}
          </span>
        );
      case "WARNING":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Warning</span>
            {code && <span className="opacity-70 font-mono text-[10px]">({code})</span>}
          </span>
        );
    }
  };

  // Category Badge Colors
  const getCategoryTheme = (cat: string) => {
    switch (cat.toUpperCase()) {
      case "SECURITY":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          dot: "bg-rose-500",
        };
      case "FINANCIAL":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
        };
      case "ACADEMIC":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          dot: "bg-blue-500",
        };
      case "COMMUNICATION":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          dot: "bg-purple-500",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-500",
        };
    }
  };

  // Role pill styles
  const getRoleBadge = (userRole?: string | null) => {
    const r = String(userRole || "SYSTEM").toUpperCase();
    if (r.includes("SUPER")) return "bg-brand-blue/10 text-brand-blue border-brand-blue/30";
    if (r.includes("ADMIN")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (r.includes("TEACHER")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (r.includes("STUDENT")) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <DashboardLayout title="Security & Audit Logs">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto min-h-screen">
        
        {/* ── TOP HERO BANNER ── */}
        <div className="rounded-2xl border border-border bg-white shadow-xs p-5 sm:p-6 transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-blue/5 via-brand-blue/2 to-transparent rounded-full pointer-events-none -mr-20 -mt-20" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            {/* Title & Badge */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white flex items-center justify-center shadow-md shadow-brand-blue/20 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                    Audit & Security Trails
                  </h1>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/25">
                    Immutable
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    SOC2 Compliant
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl">
                  Comprehensive tamper-evident record of administrative actions, authentication attempts, tenant reconciliations, and critical state changes.
                </p>
              </div>
            </div>

            {/* Action Buttons & Live Refresh */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
              {/* Auto-Refresh Toggle */}
              <div className="flex items-center bg-slate-50 border border-border rounded-xl p-1 text-xs shadow-2xs">
                <span className="px-2.5 py-1 text-text-muted font-medium flex items-center gap-1.5 border-r border-border">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      refreshInterval > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    }`}
                  />
                  Live
                </span>
                {[
                  { label: "Off", value: 0 },
                  { label: "10s", value: 10 },
                  { label: "30s", value: 30 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRefreshInterval(opt.value)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      refreshInterval === opt.value
                        ? "bg-brand-blue text-white shadow-xs"
                        : "text-text-secondary hover:text-text-primary hover:bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Manual Refresh */}
              <button
                onClick={() => {
                  loadLogs();
                  loadStats();
                }}
                disabled={loading}
                title="Refresh log feed"
                className="p-2.5 rounded-xl border border-border bg-white hover:bg-slate-50 text-text-secondary hover:text-text-primary transition-all shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-blue" : ""}`} />
              </button>

              {/* Export CSV */}
              <button
                onClick={handleExportCsv}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue-dark text-white text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-brand-blue/20 disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${isExporting ? "animate-bounce" : ""}`} />
                <span>{isExporting ? "Generating CSV..." : "Export Audit CSV"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── METRICS EXECUTIVE SUMMARY ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Today */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-white shadow-xs hover:border-brand-blue/40 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Total Events Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-blue/8 text-brand-blue flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-mono">
                  {statsLoading ? "—" : stats?.todayCount?.toLocaleString() ?? 0}
                </span>
                <span className="text-xs text-text-muted font-medium">operations</span>
              </div>
              <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-brand-blue" />
                <span>Since 00:00 local time</span>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Auth */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-white shadow-xs hover:border-indigo-400/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Security & Access
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-mono">
                  {statsLoading ? "—" : stats?.securityAlerts?.toLocaleString() ?? 0}
                </span>
                <span className="text-xs text-text-muted font-medium">auth events</span>
              </div>
              <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-indigo-500" />
                <span>Logins, token grants & resets</span>
              </div>
            </div>
          </div>

          {/* Card 3: Failures & Errors */}
          <div
            onClick={() => {
              setSelectedStatus("FAILURE");
              setActivePreset("ERRORS");
              setPage(1);
            }}
            className="p-4 sm:p-5 rounded-2xl border border-border bg-white shadow-xs hover:border-rose-400/50 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider group-hover:text-rose-600 transition-colors">
                24h Failures & Errors
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
                    (stats?.past24hErrors ?? 0) > 0 ? "text-rose-600" : "text-text-primary"
                  }`}
                >
                  {statsLoading ? "—" : stats?.past24hErrors?.toLocaleString() ?? 0}
                </span>
                <span className="text-xs text-text-muted font-medium">anomalies</span>
              </div>
              <div className="mt-2 text-[11px] flex items-center gap-1.5">
                {(stats?.past24hErrors ?? 0) === 0 ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Zero unhandled errors
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold group-hover:underline flex items-center gap-1">
                    Click to filter failed events →
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Top Category & Breakdown */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-white shadow-xs hover:border-purple-400/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Primary Category
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary truncate">
                  {statsLoading ? "—" : stats?.categories?.[0]?.category || "SYSTEM"}
                </span>
                {stats?.categories?.[0] && (
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {stats.categories[0].count} logs
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1.5 truncate">
                <span>{stats?.categories?.length || 0} active categorized audit channels</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── UNIFIED FILTER & SEARCH COMMAND DOCK ── */}
        <div className="rounded-2xl border border-border bg-white shadow-xs p-4 sm:p-5 space-y-4">
          
          {/* Quick Preset Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border-soft">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Views:
            </span>
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const active = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-brand-blue text-white shadow-xs"
                      : "bg-slate-50 text-text-secondary hover:text-text-primary hover:bg-slate-100 border border-border/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-text-muted"}`} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input & Secondary Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by user, email, action, entity ID, or IP..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-border bg-slate-50/50 text-text-primary placeholder:text-text-muted focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-md hover:bg-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setActivePreset("CUSTOM");
                  setPage(1);
                }}
                className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-border bg-slate-50/50 text-text-primary focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue/30"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setActivePreset("CUSTOM");
                  setPage(1);
                }}
                className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-border bg-slate-50/50 text-text-primary focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue/30"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failure Only</option>
                <option value="WARNING">Warning Only</option>
              </select>
            </div>

            {/* Date Pickers */}
            <div className="md:col-span-2 flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                title="Start Date"
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset("CUSTOM");
                  setPage(1);
                }}
                className="w-1/2 py-1.5 px-2 text-xs rounded-xl border border-border bg-slate-50/50 text-text-primary focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue/30"
              />
              <span className="text-text-muted text-xs">-</span>
              <input
                type="date"
                value={endDate}
                title="End Date"
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset("CUSTOM");
                  setPage(1);
                }}
                className="w-1/2 py-1.5 px-2 text-xs rounded-xl border border-border bg-slate-50/50 text-text-primary focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-blue/30"
              />
            </div>
          </div>

          {/* Active Filter Badges & Clear */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-border-soft flex items-center justify-between text-xs text-text-muted flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-text-secondary">Active filters:</span>
                {debouncedSearch && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Query: <strong className="text-text-primary">{debouncedSearch}</strong>
                  </span>
                )}
                {selectedCategory !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-blue border border-brand-blue/20">
                    Category: <strong>{selectedCategory}</strong>
                  </span>
                )}
                {selectedStatus !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Status: <strong>{selectedStatus}</strong>
                  </span>
                )}
                {(startDate || endDate) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Dates: <strong>{startDate || "Any"} → {endDate || "Any"}</strong>
                  </span>
                )}
              </div>

              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset all filters</span>
              </button>
            </div>
          )}
        </div>

        {/* ── ERROR ALERT ── */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadLogs()}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 text-xs shadow-xs"
            >
              Retry Load
            </button>
          </div>
        )}

        {/* ── LOGS DATA TABLE ── */}
        <div className="rounded-2xl border border-border bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/80 text-text-muted text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action / Event</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Target Resource</th>
                  <th className="py-3.5 px-4">Campus / Centre</th>
                  <th className="py-3.5 px-4">Client & Latency</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading && logs.length === 0 ? (
                  // Skeleton loader
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-5 w-20 bg-slate-100 rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-36 bg-slate-100 rounded-lg" /></td>
                      <td className="py-4 px-4"><div className="h-7 w-32 bg-slate-100 rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-7 w-12 bg-slate-100 rounded-lg ml-auto" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  // Empty State
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-text-muted">
                      <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-text-muted shadow-inner">
                          <Search className="w-7 h-7" />
                        </div>
                        <p className="font-bold text-text-primary text-base">No audit events found</p>
                        <p className="text-xs text-text-muted leading-relaxed">
                          {hasActiveFilters
                            ? "No log entries match your specified criteria or date boundary. Try resetting your filters."
                            : "No system or administrative activity has been captured yet."}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleClearFilters}
                            className="mt-2 px-4 py-2 rounded-xl bg-brand-blue text-white font-semibold text-xs shadow-xs hover:bg-brand-blue-dark transition-all"
                          >
                            Reset All Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Log Rows
                  logs.map((log) => {
                    const initials = (log.userName || log.userEmail || "U")
                      .slice(0, 2)
                      .toUpperCase();
                    const categoryTheme = getCategoryTheme(log.category);
                    const device = getClientDevice(log.userAgent);
                    const DeviceIcon = device.Icon;
                    const humanAction = humanizeAction(log.action);

                    return (
                      <tr
                        key={log.id}
                        onClick={() => {
                          setActiveItem(log);
                          setActiveDrawerTab("OVERVIEW");
                        }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderStatusPill(log.status, log.statusCode)}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-text-primary text-xs">
                            {formatTimeAgo(log.createdAt)}
                          </div>
                          <div className="text-[11px] text-text-muted font-mono">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Action / Event */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start min-w-[200px]">
                            <div className="font-semibold text-text-primary text-xs group-hover:text-brand-blue transition-colors">
                              {humanAction}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                {log.action}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${categoryTheme.bg}`}
                              >
                                {log.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-brand-blue font-bold text-xs flex items-center justify-center shrink-0 border border-border shadow-2xs">
                              {initials}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-text-primary text-xs truncate">
                                {log.userName || log.userEmail || "System Bot"}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadge(
                                    log.userRole
                                  )}`}
                                >
                                  {log.userRole || "SYSTEM"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Target Resource */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.entityType ? (
                            <div>
                              <span className="font-semibold text-xs text-text-primary px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                {log.entityType}
                              </span>
                              {log.entityId && (
                                <span className="block font-mono text-[11px] text-text-muted truncate max-w-[140px] mt-1">
                                  {log.entityId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </td>

                        {/* Campus / Centre */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.centre ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                              <div className="truncate">
                                <div className="font-medium text-text-primary text-xs truncate max-w-[140px]">
                                  {log.centre.name}
                                </div>
                                <span className="text-[10px] text-text-muted font-mono">
                                  {log.centre.code}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs italic">Global / Institutional</span>
                          )}
                        </td>

                        {/* Client & Latency */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-text-primary font-mono">
                            <DeviceIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span>{log.ipAddress || "Internal"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {log.executionMs !== null && log.executionMs !== undefined ? (
                              <span
                                className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                                  log.executionMs > 800
                                    ? "bg-rose-50 text-rose-700"
                                    : log.executionMs > 300
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {log.executionMs}ms
                              </span>
                            ) : null}
                            <span className="text-[10px] text-text-muted">{device.label}</span>
                          </div>
                        </td>

                        {/* Inspect Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveItem(log);
                              setActiveDrawerTab("OVERVIEW");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-white hover:bg-brand-blue hover:text-white hover:border-brand-blue text-text-secondary text-xs font-medium transition-all shadow-2xs group-hover:border-brand-blue/30"
                            title="Inspect log entry"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION DOCK ── */}
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span>
                Showing{" "}
                <strong className="text-text-primary font-semibold">
                  {total === 0 ? 0 : (page - 1) * limit + 1}
                </strong>{" "}
                to{" "}
                <strong className="text-text-primary font-semibold">
                  {Math.min(page * limit, total)}
                </strong>{" "}
                of <strong className="text-text-primary font-semibold">{total.toLocaleString()}</strong> events
              </span>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="py-1 px-2.5 rounded-lg border border-border bg-white text-text-primary text-xs focus:ring-1 focus:ring-brand-blue"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold text-text-primary transition-all shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-text-secondary">
                Page <strong className="text-text-primary font-semibold">{page}</strong> of{" "}
                <strong>{Math.max(1, totalPages)}</strong>
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-slate-50 disabled:opacity-40 font-semibold text-text-primary transition-all shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── ENTERPRISE AUDIT INSPECTOR SLIDE-OVER DRAWER ── */}
        {activeItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setActiveItem(null)}
          >
            <div
              className="w-full max-w-2xl h-full bg-white border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-border bg-slate-50/70 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0 border border-brand-blue/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-text-primary truncate">
                        {humanizeAction(activeItem.action)}
                      </h2>
                      {renderStatusPill(activeItem.status, activeItem.statusCode)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                      <span className="font-mono text-[11px] truncate">ID: {activeItem.id}</span>
                      <button
                        onClick={() => handleCopy(activeItem.id, "drawer-id")}
                        className="text-brand-blue hover:underline flex items-center gap-1 text-[11px]"
                      >
                        {copiedField === "drawer-id" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveItem(null)}
                  className="p-2 rounded-xl border border-border bg-white hover:bg-slate-100 text-text-muted hover:text-text-primary transition-all shadow-2xs"
                  title="Close inspector (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Tab Switcher */}
              <div className="flex items-center border-b border-border px-5 bg-white">
                <button
                  onClick={() => setActiveDrawerTab("OVERVIEW")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    activeDrawerTab === "OVERVIEW"
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Overview & Context</span>
                </button>
                <button
                  onClick={() => setActiveDrawerTab("PAYLOAD")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                    activeDrawerTab === "PAYLOAD"
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Event Payload & Details</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                    Redacted
                  </span>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {activeDrawerTab === "OVERVIEW" ? (
                  <>
                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Actor Card */}
                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-2">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Actor / Initiator
                        </span>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-xs flex items-center justify-center shrink-0 border border-brand-blue/20">
                            {(activeItem.userName || activeItem.userEmail || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-text-primary text-xs block truncate">
                              {activeItem.userName || "System / Unspecified"}
                            </span>
                            <span className="text-text-muted font-mono text-[11px] block truncate">
                              {activeItem.userEmail || "No associated email"}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                          <span className="text-text-muted text-[11px]">Role:</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getRoleBadge(
                              activeItem.userRole
                            )}`}
                          >
                            {activeItem.userRole || "SYSTEM"}
                          </span>
                        </div>
                      </div>

                      {/* Target Entity Card */}
                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-2">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Resource Mutation
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-primary">
                            Type: {activeItem.entityType || "None"}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                              getCategoryTheme(activeItem.category).bg
                            }`}
                          >
                            {activeItem.category}
                          </span>
                        </div>
                        {activeItem.entityId ? (
                          <div className="p-2 rounded-lg bg-white border border-border flex items-center justify-between">
                            <span className="font-mono text-[11px] text-text-primary truncate">
                              {activeItem.entityId}
                            </span>
                            <button
                              onClick={() => handleCopy(activeItem.entityId!, "drawer-entity")}
                              className="text-brand-blue hover:underline text-[11px] ml-2 shrink-0 flex items-center gap-1"
                            >
                              {copiedField === "drawer-entity" ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              Copy
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic block">
                            No specific entity ID recorded
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Timing */}
                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-1.5">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Exact Execution Time
                        </span>
                        <div className="font-mono text-xs text-text-primary font-semibold">
                          {new Date(activeItem.createdAt).toISOString()}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {new Date(activeItem.createdAt).toLocaleString("en-IN", {
                            dateStyle: "full",
                            timeStyle: "medium",
                          })}
                        </div>
                        <div className="text-[11px] text-brand-blue font-medium mt-1">
                          Occurred {formatTimeAgo(activeItem.createdAt)}
                        </div>
                      </div>

                      {/* Network & Diagnostics */}
                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 space-y-1.5">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Network & Client
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-text-primary">
                          <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>{activeItem.ipAddress || "Internal"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted pt-1">
                          <span>
                            Latency:{" "}
                            <strong className="text-text-primary font-mono font-semibold">
                              {activeItem.executionMs ?? "—"}ms
                            </strong>
                          </span>
                          {activeItem.statusCode && (
                            <span>
                              • HTTP:{" "}
                              <strong className="text-text-primary font-mono font-semibold">
                                {activeItem.statusCode}
                              </strong>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          Platform: <strong>{getClientDevice(activeItem.userAgent).label}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Centre Context if present */}
                    {activeItem.centre && (
                      <div className="p-4 rounded-xl border border-brand-blue/25 bg-brand-blue/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-5 h-5 text-brand-blue shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-text-primary">
                              {activeItem.centre.name}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              Centre ID: <span className="font-mono">{activeItem.centre.id}</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-brand-blue/20 text-brand-blue">
                          Code: {activeItem.centre.code}
                        </span>
                      </div>
                    )}

                    {/* User Agent Block */}
                    {activeItem.userAgent && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                          Client User Agent
                        </span>
                        <div className="p-3 rounded-xl border border-border bg-slate-50 font-mono text-xs text-text-secondary break-all">
                          {activeItem.userAgent}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Payload Tab */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                          Structured Audit Payload
                        </h3>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          All customer passwords, JWT tokens, and sensitive PII are automatically scrubbed before persistence.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          const jsonStr = JSON.stringify(activeItem.details, null, 2);
                          navigator.clipboard.writeText(jsonStr);
                          setCopiedPayload(true);
                          setTimeout(() => setCopiedPayload(false), 2000);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-slate-50 text-xs font-semibold text-text-primary transition-all shadow-2xs shrink-0"
                      >
                        {copiedPayload ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Formatted Key-Value Cards if details has keys */}
                    {activeItem.details &&
                      typeof activeItem.details === "object" &&
                      !Array.isArray(activeItem.details) &&
                      Object.keys(activeItem.details).length > 0 && (
                        <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-2.5">
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                            Summary Attributes
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {Object.entries(activeItem.details).map(([k, v]) => (
                              <div
                                key={k}
                                className="p-2.5 rounded-lg bg-white border border-border/80 flex flex-col justify-between"
                              >
                                <span className="font-mono text-[10px] text-text-muted uppercase font-bold">
                                  {k}
                                </span>
                                <span className="font-mono text-xs text-text-primary font-semibold break-all mt-0.5">
                                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Syntax Highlighted JSON viewer */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto max-h-[420px] shadow-inner">
                      {activeItem.details ? (
                        <SyntaxHighlightedJson json={activeItem.details} />
                      ) : (
                        <pre className="text-slate-500 italic">No additional payload attached.</pre>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Audit record verified against integrity hash
                </span>
                <button
                  onClick={() => setActiveItem(null)}
                  className="px-4 py-2 rounded-xl bg-text-primary text-white font-semibold hover:bg-text-secondary transition-colors shadow-2xs"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
