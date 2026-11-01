"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import {
  Webhook,
  Search,
  Users,
  Building,
  Calendar,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Code2,
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface CrmAdmissionItem {
  id: string;
  admissionNo: string;
  source?: string;
  externalCrmId?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  address?: string;
  dateOfBirth?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  enrollments?: Array<{
    id: string;
    batch?: {
      id: string;
      name: string;
      centre?: { id: string; name: string; code: string };
      academicYear?: { id: string; name: string };
      board?: { id: string; name: string };
      standard?: { id: string; name: string };
    };
  }>;
}

export default function CrmAdmissionsPage() {
  const [data, setData] = useState<CrmAdmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [thisMonth, setThisMonth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const res: any = await fetchApi("/integrations/crm-admissions?limit=100");
      if (res && res.data) {
        setData(res.data);
        setTotal(res.total || 0);
        setThisMonth(res.thisMonth || 0);
      }
    } catch (err) {
      console.error("Failed to load CRM admissions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = data.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fullName = `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.toLowerCase();
    const admNo = (item.admissionNo || "").toLowerCase();
    const crmId = (item.externalCrmId || "").toLowerCase();
    const email = (item.user?.email || "").toLowerCase();
    const phone = (item.parentPhone || "").toLowerCase();
    return (
      fullName.includes(q) ||
      admNo.includes(q) ||
      crmId.includes(q) ||
      email.includes(q) ||
      phone.includes(q)
    );
  });

  return (
    <DashboardLayout title="CRM Admissions">
      <PageShell
        title="CRM Admissions Feed"
        subtitle="Live automated dispatch feed of admissions originating from your external CRM webhook integration"
        icon={Webhook}
        accentColor="blue"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-soft bg-surface-2 hover:bg-white text-text-secondary transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors"
            >
              <Code2 className="h-3.5 w-3.5" />
              API & Webhook Keys
            </Link>
          </div>
        }
      >
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Total CRM Admissions</span>
              <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-2">{total}</p>
            <p className="text-[11px] text-text-muted mt-1">Dispatched automatically</p>
          </div>

          <div className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Enrolled This Month</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{thisMonth}</p>
            <p className="text-[11px] text-text-muted mt-1">Current calendar month</p>
          </div>

          <div className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Integration Status</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-bold text-text-primary">Webhook Listener Active</p>
            </div>
            <p className="text-[11px] text-text-muted mt-1">HMAC SHA-256 Verified</p>
          </div>

          <div className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">LMS Directory</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <Link
              href="/students?source=CRM Webhook"
              className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:underline mt-2"
            >
              View in All Students <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <p className="text-[11px] text-text-muted mt-1">Filtered by CRM source</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-border-soft p-4 mb-6 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, admission no, CRM reference ID, email, or parent phone..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border-soft bg-surface-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/40"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between bg-surface-2/40">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-purple-600" />
              <h2 className="text-sm font-bold text-text-primary">CRM Enrolled Students</h2>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                {filtered.length} records
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-text-muted text-sm">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent mb-2" />
              <p>Loading CRM admissions...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 px-6 text-center max-w-lg mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
                <Webhook className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">No CRM Admissions Yet</h3>
              <p className="text-xs text-text-muted mb-6 leading-relaxed">
                When your CRM marks an enquiry as <code className="bg-surface-2 px-1 py-0.5 rounded text-purple-700 font-semibold">ENROLLED</code> or opportunity as <code className="bg-surface-2 px-1 py-0.5 rounded text-purple-700 font-semibold">WON</code>, it will automatically dispatch a webhook to Educare LMS and populate this live feed.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
              >
                <Code2 className="h-4 w-4" /> View API Keys & Setup Instructions
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-2 text-text-secondary border-b border-border-soft uppercase tracking-wider text-[11px] font-semibold">
                    <th className="px-5 py-3">Admission No</th>
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-5 py-3">CRM Ref ID</th>
                    <th className="px-5 py-3">Parent / Contact</th>
                    <th className="px-5 py-3">Academic Program</th>
                    <th className="px-5 py-3">Centre</th>
                    <th className="px-5 py-3">Enrolled At</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.map((item) => {
                    const primaryEnrollment = item.enrollments?.[0];
                    const batch = primaryEnrollment?.batch;
                    const crmId = item.externalCrmId || "N/A";
                    const isCopied = copiedId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-brand-blue/10 text-brand-blue">
                            {item.admissionNo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-text-primary text-sm">
                            {item.user?.firstName} {item.user?.lastName}
                          </div>
                          <div className="text-[11px] text-text-muted">{item.user?.email}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="inline-flex items-center gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {crmId}
                            </span>
                            <button
                              onClick={() => copyToClipboard(crmId, item.id)}
                              className="text-text-muted hover:text-purple-600 transition-colors p-0.5"
                              title="Copy CRM ID"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-text-primary">
                            {item.parentName || "—"}
                          </div>
                          <div className="text-[11px] text-text-muted">
                            {item.parentPhone || "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-text-primary">
                            {batch?.standard?.name || "Class"} • {batch?.board?.name || "Board"}
                          </div>
                          <div className="text-[11px] text-text-muted">
                            {batch?.name} ({batch?.academicYear?.name || "2025-26"})
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-text-primary font-medium">
                            {batch?.centre?.name || "Main Campus"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-text-muted text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/students/${item.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-border-soft bg-white hover:bg-surface-2 text-brand-blue transition-colors shadow-2xs"
                            >
                              Profile <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
