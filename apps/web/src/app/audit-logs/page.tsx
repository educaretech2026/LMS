"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ExternalLink,
  Laptop,
} from "lucide-react";

/* ── Types ── */
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

const CATEGORIES = ["ALL", "SECURITY", "FINANCIAL", "ACADEMIC", "COMMUNICATION", "SYSTEM"];
const STATUSES = ["ALL", "SUCCESS", "FAILURE", "WARNING"];

export default function AuditLogsPage() {
  const { role, email } = useAuth();
  
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

  // Auto-refresh interval (0 = off, 10 = 10s, 30 = 30s)
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  // Detail drawer / modal
  const [activeItem, setActiveItem] = useState<AuditLogItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load audit logs
  const loadLogs = useCallback(async (silent = false) => {
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
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedCategory, selectedStatus, startDate, endDate]);

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

  // Initial & filter triggers
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

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setStartDate("");
    setEndDate("");
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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // Status badge styling
  const renderStatusBadge = (status: string, code?: number | null) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Success</span>
            {code && <span className="opacity-75 text-[10px]">({code})</span>}
          </span>
        );
      case "FAILURE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failure</span>
            {code && <span className="opacity-75 text-[10px]">({code})</span>}
          </span>
        );
      case "WARNING":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Warning</span>
            {code && <span className="opacity-75 text-[10px]">({code})</span>}
          </span>
        );
    }
  };

  // Category badge color
  const getCategoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case "SECURITY":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800";
      case "FINANCIAL":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800";
      case "ACADEMIC":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800";
      case "COMMUNICATION":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
    }
  };

  return (
    <DashboardLayout title="Security & Audit Logs">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        
        {/* ── TOP HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0162b1] to-[#040f1e] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Audit & Security Logs
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0162b1] dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    Enterprise
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Immutable security audit trail, administrative operations, and multi-tenant system mutations.
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Auto-refresh selector */}
            <div className="flex items-center bg-card border border-border rounded-lg p-1 text-xs shadow-xs">
              <span className="px-2 text-muted-foreground font-medium flex items-center gap-1.5">
                {refreshInterval > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
                Live:
              </span>
              {[
                { label: "Off", value: 0 },
                { label: "10s", value: 10 },
                { label: "30s", value: 30 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRefreshInterval(opt.value)}
                  className={`px-2.5 py-1 rounded font-semibold transition-all ${
                    refreshInterval === opt.value
                      ? "bg-[#0162b1] text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Manual refresh */}
            <button
              onClick={() => {
                loadLogs();
                loadStats();
              }}
              disabled={loading}
              title="Refresh logs"
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#0162b1]" : ""}`} />
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0162b1] hover:bg-[#015294] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-600/20 disabled:opacity-60"
            >
              <Download className={`w-4 h-4 ${isExporting ? "animate-bounce" : ""}`} />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {/* ── METRIC STATS CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Actions */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card/60 backdrop-blur-xs shadow-xs hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#0162b1] flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {statsLoading ? "—" : stats?.todayCount?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">recorded</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#0162b1]" />
              <span>Since midnight local time</span>
            </div>
          </div>

          {/* Card 2: 24h Errors */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card/60 backdrop-blur-xs shadow-xs hover:border-rose-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                24h Failures & Errors
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                (stats?.past24hErrors ?? 0) > 0 ? "text-rose-600" : "text-foreground"
              }`}>
                {statsLoading ? "—" : stats?.past24hErrors?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">issues</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
              {(stats?.past24hErrors ?? 0) === 0 ? (
                <span className="text-emerald-600 font-medium">✓ Zero unhandled failures</span>
              ) : (
                <span className="text-rose-600 font-medium">Requires audit inspection</span>
              )}
            </div>
          </div>

          {/* Card 3: Security Alerts */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card/60 backdrop-blur-xs shadow-xs hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Security Alerts
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {statsLoading ? "—" : stats?.securityAlerts?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">auth events</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Logins, password & session audits</span>
            </div>
          </div>

          {/* Card 4: Dominant Activity Category */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-card/60 backdrop-blur-xs shadow-xs hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Top Category
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                {statsLoading
                  ? "—"
                  : stats?.categories?.[0]?.category || "SYSTEM"}
              </span>
              {stats?.categories?.[0] && (
                <span className="text-xs text-muted-foreground">
                  ({stats.categories[0].count})
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <span>{stats?.categories?.length || 0} active audit categories</span>
            </div>
          </div>
        </div>

        {/* ── SEARCH & FILTER TOOLBAR ── */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3.5">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user, email, action, entity ID, or IP address..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-[#0162b1]/40 focus:border-[#0162b1] transition-all text-foreground placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Status:</span>
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="py-2 px-3 text-xs sm:text-sm rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#0162b1]/40"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s === "ALL" ? "All Statuses" : s}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Pickers */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Dates:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#0162b1]/40"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#0162b1]/40"
              />
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-100 transition-all self-end lg:self-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-border/50 no-scrollbar">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Category:
            </span>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-[#0162b1] text-white shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── ERROR STATE ── */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadLogs()}
              className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700 text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── AUDIT LOGS TABLE ── */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource / Entity</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Origin / Client</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading && logs.length === 0 ? (
                  // Skeleton loader
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-5 w-16 bg-muted rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-24 bg-muted rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-32 bg-muted rounded" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-28 bg-muted rounded-full" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-20 bg-muted rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-12 bg-muted rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-24 bg-muted rounded" /></td>
                      <td className="py-4 px-4 text-right"><div className="h-6 w-12 bg-muted rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  // Empty state
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="max-w-sm mx-auto flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <Search className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-foreground text-sm">No audit logs found</p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? "No log entries match your active filters or search terms."
                            : "No system or administrative activity recorded yet."}
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleClearFilters}
                            className="mt-2 text-xs font-semibold text-[#0162b1] hover:underline"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Log Rows
                  logs.map(log => {
                    const initials = (log.userName || log.userEmail || "U")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setActiveItem(log)}
                        className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderStatusBadge(log.status, log.statusCode)}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-foreground text-xs">
                            {formatTimeAgo(log.createdAt)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0 border border-border">
                              {initials}
                            </div>
                            <div className="truncate">
                              <div className="font-medium text-foreground text-xs truncate">
                                {log.userName || log.userEmail || "System Bot"}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {log.userRole && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                                    {log.userRole}
                                  </span>
                                )}
                                {log.centre && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    • {log.centre.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action & Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {log.action}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getCategoryColor(
                                log.category
                              )}`}
                            >
                              {log.category}
                            </span>
                          </div>
                        </td>

                        {/* Resource / Entity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.entityType ? (
                            <div>
                              <span className="font-semibold text-xs text-foreground">
                                {log.entityType}
                              </span>
                              {log.entityId && (
                                <span className="block font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                                  {log.entityId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                          {log.executionMs !== null && log.executionMs !== undefined ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                log.executionMs > 1000
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                  : log.executionMs > 400
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {log.executionMs}ms
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>

                        {/* Origin / Client */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>{log.ipAddress || "Internal"}</span>
                          </div>
                          {log.userAgent && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[130px] mt-0.5">
                              {log.userAgent.includes("Mobile")
                                ? "Mobile Client"
                                : log.userAgent.includes("Mozilla")
                                ? "Desktop Web"
                                : "API Client"}
                            </div>
                          )}
                        </td>

                        {/* Details / Inspect */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setActiveItem(log);
                            }}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all group-hover:border-[#0162b1]/40"
                            title="Inspect log payload"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION CONTROLS ── */}
          <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/20">
            <div className="flex items-center gap-2">
              <span>
                Showing{" "}
                <strong className="text-foreground">
                  {total === 0 ? 0 : (page - 1) * limit + 1}
                </strong>{" "}
                to{" "}
                <strong className="text-foreground">
                  {Math.min(page * limit, total)}
                </strong>{" "}
                of <strong className="text-foreground">{total.toLocaleString()}</strong> logs
              </span>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={e => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="py-1 px-2 rounded border border-border bg-background text-foreground text-xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 font-medium text-foreground transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-foreground">
                Page {page} of {Math.max(1, totalPages)}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 font-medium text-foreground transition-all"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── INSPECT SLIDE-OVER DRAWER / MODAL ── */}
        {activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
              className="w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between gap-4 bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-[#0162b1] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-foreground font-mono truncate">
                        {activeItem.action}
                      </h2>
                      {renderStatusBadge(activeItem.status, activeItem.statusCode)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Log ID: <span className="font-mono">{activeItem.id}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveItem(null)}
                  className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                
                {/* Meta details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Exact Timestamp
                    </span>
                    <span className="font-mono text-foreground">
                      {new Date(activeItem.createdAt).toISOString()}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      ({formatTimeAgo(activeItem.createdAt)})
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Actor Identity
                    </span>
                    <span className="font-semibold text-foreground block">
                      {activeItem.userName || "Unknown"}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px] block truncate">
                      {activeItem.userEmail || "No email"}
                    </span>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                      {activeItem.userRole || "SYSTEM"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Target Entity
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {activeItem.entityType || "None"}
                      </span>
                      {activeItem.entityId && (
                        <button
                          onClick={() => handleCopy(activeItem.entityId!, "entityId")}
                          className="text-[10px] text-[#0162b1] hover:underline flex items-center gap-1"
                        >
                          {copiedField === "entityId" ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy ID
                        </button>
                      )}
                    </div>
                    {activeItem.entityId && (
                      <span className="font-mono text-[11px] text-muted-foreground block truncate mt-0.5">
                        {activeItem.entityId}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Network & Latency
                    </span>
                    <div className="flex items-center gap-1 text-foreground font-mono">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{activeItem.ipAddress || "Internal"}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>Latency: {activeItem.executionMs ?? "—"}ms</span>
                      {activeItem.statusCode && (
                        <span>• HTTP {activeItem.statusCode}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Centre information if attached */}
                {activeItem.centre && (
                  <div className="p-3 rounded-lg border border-border bg-blue-50/50 dark:bg-blue-950/20 text-xs">
                    <span className="text-[11px] font-bold text-[#0162b1] uppercase tracking-wider block mb-1">
                      Centre Context
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {activeItem.centre.name}
                      </span>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        Code: {activeItem.centre.code}
                      </span>
                    </div>
                  </div>
                )}

                {/* User Agent */}
                {activeItem.userAgent && (
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Client User Agent
                    </span>
                    <div className="p-3 rounded-lg border border-border bg-muted/30 font-mono text-xs text-muted-foreground break-all">
                      {activeItem.userAgent}
                    </div>
                  </div>
                )}

                {/* Redacted JSON Payload Viewer */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Event Payload Details
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        PII Redacted
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const jsonStr = JSON.stringify(activeItem.details, null, 2);
                        navigator.clipboard.writeText(jsonStr);
                        setCopiedPayload(true);
                        setTimeout(() => setCopiedPayload(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-all"
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

                  <div className="rounded-xl border border-border bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto max-h-[380px] shadow-inner">
                    <pre className="whitespace-pre-wrap break-all leading-relaxed">
                      {activeItem.details
                        ? JSON.stringify(activeItem.details, null, 2)
                        : "{\n  \"message\": \"No payload attached\"\n}"}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>Press ESC or click close to dismiss</span>
                <button
                  onClick={() => setActiveItem(null)}
                  className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
