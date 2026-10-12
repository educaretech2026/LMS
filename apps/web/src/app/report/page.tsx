"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import {
  BarChart3,
  Download,
  Printer,
  Loader2,
  IndianRupee,
  Users,
  Search,
  Calendar,
  BookOpen,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpRight,
  UserCheck,
  Percent,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import {
  MetricCard,
  DonutChart,
  BarComparisonChart,
  FunnelChart,
  RadialGauge,
} from "@/components/report/analytics-charts";
import { ReportFilterBar, FilterState } from "@/components/report/report-filters";
import { StudentReportModal } from "@/components/report/student-report-modal";

type TabKey = "OVERVIEW" | "FINANCE" | "ACADEMICS" | "ATTENDANCE" | "CRM";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("OVERVIEW");

  // Filter state
  const [filters, setFilters] = useState<FilterState>(() => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    return {
      datePreset: "month",
      startDate: firstDay.toISOString().split("T")[0],
      endDate: d.toISOString().split("T")[0],
      batchId: "",
      centreId: "",
    };
  });

  const [batches, setBatches] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);

  // Analytics states
  const [loading, setLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [academicData, setAcademicData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [crmData, setCrmData] = useState<any>(null);

  // Student Search / Drilldown state
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Table sorting & query filter
  const [tableSearch, setTableSearch] = useState("");

  // Initial load of master metadata
  useEffect(() => {
    fetchApi("/setup/batches")
      .then((b) => setBatches(Array.isArray(b) ? b : []))
      .catch(() => {});
    fetchApi("/setup/centres")
      .then((c) => setCentres(Array.isArray(c) ? c : []))
      .catch(() => {});
  }, []);

  // Fetch report data on tab or filter change
  useEffect(() => {
    loadTabData(activeTab, filters);
  }, [activeTab, filters.startDate, filters.endDate, filters.batchId, filters.centreId]);

  const loadTabData = async (tab: TabKey, f: FilterState) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (f.startDate) q.set("startDate", f.startDate);
      if (f.endDate) q.set("endDate", f.endDate);
      if (f.batchId) q.set("batchId", f.batchId);
      if (f.centreId) q.set("centreId", f.centreId);

      const qs = q.toString() ? `?${q.toString()}` : "";

      if (tab === "OVERVIEW") {
        const res = await fetchApi(`/report/overview${qs}`);
        setOverviewData(res);
      } else if (tab === "FINANCE") {
        const res = await fetchApi(`/report/finance${qs}`);
        setFinanceData(res);
      } else if (tab === "ACADEMICS") {
        const res = await fetchApi(`/report/exams-analytics${qs}`);
        setAcademicData(res);
      } else if (tab === "ATTENDANCE") {
        const res = await fetchApi(`/report/attendance-analytics${qs}`);
        setAttendanceData(res);
      } else if (tab === "CRM") {
        const res = await fetchApi(`/report/enquiries${qs}`);
        setCrmData(res);
      }
    } catch (e) {
      console.error("Error loading analytics data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSearch = async () => {
    if (!studentSearch || studentSearch.length < 2) return;
    setSearchingStudent(true);
    setSearchResults([]);
    try {
      const res = await fetchApi(`/students/search?q=${encodeURIComponent(studentSearch)}`);
      setSearchResults(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingStudent(false);
    }
  };

  const openStudentDossier = async (studentId: string) => {
    setModalLoading(true);
    try {
      const res = await fetchApi(`/report/student-performance/${studentId}`);
      setSelectedStudent(res);
    } catch (e) {
      alert("Failed to load student performance record.");
    } finally {
      setModalLoading(false);
    }
  };

  // ── CSV Export ───────────────────────────────────────────────
  const exportCurrentTabCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const filename = `educare_${activeTab.toLowerCase()}_${new Date().toISOString().split("T")[0]}.csv`;

    if (activeTab === "OVERVIEW" && overviewData) {
      csvContent += "Metric,Value\n";
      csvContent += `Total Revenue,₹${overviewData.financials?.totalRevenue || 0}\n`;
      csvContent += `Fee Collections,₹${overviewData.financials?.feeTotal || 0}\n`;
      csvContent += `Ad-hoc Income,₹${overviewData.financials?.adhocIncome || 0}\n`;
      csvContent += `Total Expenses,₹${overviewData.financials?.expenses || 0}\n`;
      csvContent += `Net Profit,₹${overviewData.financials?.netProfit || 0}\n`;
      csvContent += `Attendance Rate,${overviewData.attendance?.rate || 0}%\n`;
      csvContent += `Academic Avg Score,${overviewData.academics?.avgScore || 0}%\n`;
      csvContent += `Exam Pass Rate,${overviewData.academics?.passRate || 0}%\n`;
      csvContent += `Total Enquiries,${overviewData.crm?.totalEnquiries || 0}\n`;
      csvContent += `CRM Conversion Rate,${overviewData.crm?.conversionRate || 0}%\n`;
    } else if (activeTab === "FINANCE" && financeData) {
      csvContent += "Date,Type,Category,Amount\n";
      (financeData.transactions || []).forEach((t: any) => {
        csvContent += `"${new Date(t.date).toLocaleDateString()}","${t.type}","${t.category}","${t.amount}"\n`;
      });
    } else if (activeTab === "ACADEMICS" && academicData) {
      csvContent += "Exam Title,Batch,Subject,Attempts,Average Score %,Top Score\n";
      (academicData.exams || []).forEach((e: any) => {
        csvContent += `"${e.title}","${e.batchName}","${e.subjectName}","${e.attemptsCount}","${e.averagePercentage}%","${e.topScore}"\n`;
      });
    } else if (activeTab === "ATTENDANCE" && attendanceData) {
      csvContent += "Student Name,Admission No,Total Sessions,Present,Attendance %\n";
      (attendanceData.studentList || []).forEach((s: any) => {
        csvContent += `"${s.name}","${s.admissionNo}","${s.total}","${s.present}","${s.percentage}%"\n`;
      });
    } else if (activeTab === "CRM" && crmData) {
      csvContent += "Status,Count\n";
      Object.entries(crmData.counts || {}).forEach(([k, v]) => {
        csvContent += `"${k}","${v}"\n`;
      });
      csvContent += `"Total","${crmData.total}"\n`;
      csvContent += `"Conversion Rate","${crmData.conversionRate?.toFixed(1)}%"\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER TABS
  // ─────────────────────────────────────────────────────────────

  const renderOverviewTab = () => {
    if (!overviewData) return null;
    const f = overviewData.financials || {};
    const att = overviewData.attendance || {};
    const acad = overviewData.academics || {};
    const crm = overviewData.crm || {};

    return (
      <div className="space-y-6">
        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={`₹${(f.totalRevenue || 0).toLocaleString("en-IN")}`}
            subtitle={`Fees: ₹${(f.feeTotal || 0).toLocaleString()} • Ad-hoc: ₹${(f.adhocIncome || 0).toLocaleString()}`}
            icon={TrendingUp}
            accentColor="emerald"
            trend={{
              value: `Net Profit: ₹${(f.netProfit || 0).toLocaleString()}`,
              isPositive: (f.netProfit || 0) >= 0,
            }}
          />
          <MetricCard
            title="Total Expenditure"
            value={`₹${(f.expenses || 0).toLocaleString("en-IN")}`}
            subtitle={`Pending Fees: ₹${(f.pendingFees || 0).toLocaleString()}`}
            icon={DollarSign}
            accentColor="rose"
            trend={{
              value: `Overdue: ₹${(f.overdueFees || 0).toLocaleString()}`,
              isPositive: false,
            }}
          />
          <MetricCard
            title="Attendance Rate"
            value={`${att.rate || 0}%`}
            subtitle={`${att.presentRecords || 0} of ${att.totalRecords || 0} session attendances`}
            icon={UserCheck}
            accentColor="blue"
            trend={{
              value: (att.rate || 0) >= 75 ? "Optimal Standing" : "Requires Attention",
              isPositive: (att.rate || 0) >= 75,
            }}
          />
          <MetricCard
            title="Exam Pass Rate"
            value={`${acad.passRate || 0}%`}
            subtitle={`Cohort Average: ${acad.avgScore || 0}%`}
            icon={Award}
            accentColor="violet"
            trend={{
              value: `${acad.totalAttempts || 0} Attempts Evaluated`,
              isNeutral: true,
            }}
          />
        </div>

        {/* Visual Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue & Margin Breakdown */}
          <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Financial Composition
              </h4>
              <span className="text-xs font-bold text-emerald-600">
                ₹{(f.totalRevenue || 0).toLocaleString()} Total
              </span>
            </div>
            <DonutChart
              centerTitle="Net Margin"
              centerValue={`₹${Math.max(0, f.netProfit || 0).toLocaleString()}`}
              segments={[
                { label: "Fee Collections", value: f.feeTotal || 0, color: "#10b981" },
                { label: "Ad-hoc Income", value: f.adhocIncome || 0, color: "#06b6d4" },
                { label: "Total Expenses", value: f.expenses || 0, color: "#f43f5e" },
              ]}
            />
          </div>

          {/* Academic & Attendance Performance */}
          <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Engagement & Examination Gauges
            </h4>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <RadialGauge
                value={att.rate || 0}
                label="Attendance"
                sublabel={`${att.presentRecords || 0} Present`}
                color="#2563eb"
              />
              <RadialGauge
                value={acad.passRate || 0}
                label="Pass Rate"
                sublabel={`${acad.avgScore || 0}% Average`}
                color="#7c3aed"
              />
            </div>
          </div>

          {/* CRM Funnel */}
          <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Admissions Conversion
              </h4>
              <span className="text-xs font-bold text-brand-blue">
                {crm.conversionRate || 0}% Conv.
              </span>
            </div>
            <FunnelChart
              stages={[
                { label: "Total Inquiries", count: crm.totalEnquiries || 0, color: "#3b82f6" },
                { label: "Converted Admissions", count: crm.converted || 0, percentage: crm.conversionRate, color: "#10b981" },
              ]}
            />
            <div className="pt-2 text-center">
              <button
                onClick={() => setActiveTab("CRM")}
                className="text-xs font-bold text-brand-blue hover:underline inline-flex items-center gap-1"
              >
                Inspect Pipeline In Detail <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinanceTab = () => {
    if (!financeData) return null;
    const transactions = financeData.transactions || [];
    const feeTotal = financeData.feeTotal || 0;

    const expenseTotal = transactions
      .filter((t: any) => t.type === "EXPENSE")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const adhocIncome = transactions
      .filter((t: any) => t.type === "INCOME")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalIncome = feeTotal + adhocIncome;
    const netProfit = totalIncome - expenseTotal;

    // Filtered transactions
    const filteredTx = transactions.filter((t: any) => {
      if (!tableSearch) return true;
      const q = tableSearch.toLowerCase();
      return (
        t.category?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        t.amount?.toString().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Revenue Realized
            </p>
            <p className="text-2xl font-black text-emerald-700 mt-1 flex items-center">
              <IndianRupee className="h-5 w-5" />
              {totalIncome.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              Fee Collections: ₹{feeTotal.toLocaleString()} | Ad-hoc: ₹{adhocIncome.toLocaleString()}
            </p>
          </div>

          <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Total Expenses
            </p>
            <p className="text-2xl font-black text-rose-700 mt-1 flex items-center">
              <IndianRupee className="h-5 w-5" />
              {expenseTotal.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-rose-600 font-medium mt-1">
              {transactions.filter((t: any) => t.type === "EXPENSE").length} Expense Entries Logged
            </p>
          </div>

          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <p className="text-[11px] font-bold text-brand-blue uppercase tracking-wider">
              Net Financial Balance
            </p>
            <p className="text-2xl font-black text-brand-blue mt-1 flex items-center">
              <IndianRupee className="h-5 w-5" />
              {netProfit.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-brand-blue/80 font-medium mt-1">
              Operating Profit Margin: {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* Transaction Ledger Table */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Financial Transaction Ledger
              </h3>
              <p className="text-xs text-text-muted">
                Detailed statement of income and expense vouchers
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Filter transactions..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface sticky top-0 border-b border-border-soft z-10">
                <tr>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Date</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Classification</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Category / Purpose</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Authorized By</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {filteredTx.length > 0 ? (
                  filteredTx.map((t: any) => (
                    <tr key={t.id} className="hover:bg-surface/50">
                      <td className="px-5 py-3 font-medium text-text-secondary">
                        {new Date(t.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            t.type === "INCOME"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-text-primary">
                        {t.category}
                      </td>
                      <td className="px-5 py-3 text-text-muted">
                        {t.recordedBy ? `${t.recordedBy.firstName} ${t.recordedBy.lastName}` : "System"}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-text-primary">
                        ₹{t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">
                      No transaction records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAcademicsTab = () => {
    if (!academicData) return null;
    const exams = academicData.exams || [];
    const summary = academicData.summary || {};

    const gradeEntries = Object.entries(summary.gradeDistribution || {}).map(([grade, count]: any) => ({
      name: grade,
      value: count,
      color: grade === "A+" || grade === "A" ? "#10b981" : grade === "B+" || grade === "B" ? "#3b82f6" : grade === "C" ? "#f59e0b" : "#f43f5e",
    }));

    const filteredExams = exams.filter((e: any) => {
      if (!tableSearch) return true;
      const q = tableSearch.toLowerCase();
      return (
        e.title?.toLowerCase().includes(q) ||
        e.batchName?.toLowerCase().includes(q) ||
        e.subjectName?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Assessments"
            value={summary.totalExams || 0}
            subtitle={`${summary.totalAttempts || 0} Total Attempt Submissions`}
            icon={BookOpen}
            accentColor="violet"
          />
          <MetricCard
            title="Cohort Average Score"
            value={`${summary.overallAverage || 0}%`}
            subtitle="Calculated across all evaluated student tests"
            icon={Award}
            accentColor="blue"
          />
          <MetricCard
            title="Highest Score Index"
            value={exams.length > 0 ? Math.max(...exams.map((e: any) => e.topScore)) : 0}
            subtitle="Top mark awarded in selected period"
            icon={TrendingUp}
            accentColor="emerald"
          />
        </div>

        {/* Grade Distribution Bar */}
        <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs">
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">
            Cohort Grade Spread
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {gradeEntries.map((g) => (
              <div
                key={g.name}
                className="p-3 rounded-xl border border-border-soft text-center bg-surface/40"
              >
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-black mb-1"
                  style={{ color: g.color }}
                >
                  Grade {g.name}
                </span>
                <p className="text-xl font-black text-text-primary">{g.value}</p>
                <p className="text-[10px] text-text-muted font-medium mt-0.5">
                  {summary.totalAttempts > 0
                    ? `${((g.value / summary.totalAttempts) * 100).toFixed(0)}%`
                    : "0%"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Exams Table */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Examinations & Assessment Reports
              </h3>
              <p className="text-xs text-text-muted">
                Cohort performance analytics across batches
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search exam, batch, or subject..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface sticky top-0 border-b border-border-soft z-10">
                <tr>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Exam Title</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Batch</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Subject</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-center">Attempts</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-center">Batch Avg %</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-right">Top Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {filteredExams.length > 0 ? (
                  filteredExams.map((exam: any) => (
                    <tr key={exam.id} className="hover:bg-surface/50">
                      <td className="px-5 py-3 font-bold text-text-primary">
                        {exam.title}
                      </td>
                      <td className="px-5 py-3 text-text-secondary font-medium">
                        {exam.batchName}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {exam.subjectName}
                      </td>
                      <td className="px-5 py-3 text-center font-bold">
                        {exam.attemptsCount}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                            exam.averagePercentage >= 75
                              ? "bg-emerald-100 text-emerald-800"
                              : exam.averagePercentage >= 50
                              ? "bg-blue-100 text-brand-blue"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {exam.averagePercentage}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-black text-text-primary">
                        {exam.topScore}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-text-muted">
                      No examinations found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceTab = () => {
    if (!attendanceData) return null;
    const summary = attendanceData.summary || {};
    const studentList = attendanceData.studentList || [];
    const dailyTrends = attendanceData.dailyTrends || [];

    const filteredStudents = studentList.filter((s: any) => {
      if (!tableSearch) return true;
      const q = tableSearch.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.admissionNo?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <MetricCard
            title="Overall Attendance"
            value={`${summary.overallRate || 0}%`}
            subtitle={`${summary.totalRecords || 0} Individual Attendances Marked`}
            icon={UserCheck}
            accentColor="blue"
          />
          <MetricCard
            title="Classroom Sessions"
            value={summary.totalSessions || 0}
            subtitle="Conducted within active timeframe"
            icon={Calendar}
            accentColor="emerald"
          />
          <MetricCard
            title="Chronic Absenteeism"
            value={summary.atRiskCount || 0}
            subtitle="Students falling below 75% threshold"
            icon={AlertTriangle}
            accentColor="rose"
            trend={{
              value: `${summary.atRiskCount || 0} Students At Risk`,
              isPositive: false,
            }}
          />
          <MetricCard
            title="Active Cohort Size"
            value={studentList.length}
            subtitle="Students tracked in batch/filter"
            icon={Users}
            accentColor="violet"
          />
        </div>

        {/* Student Attendance Register */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Student Attendance & Standing Register
              </h3>
              <p className="text-xs text-text-muted">
                Click any student row to view and print their comprehensive dossier
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search student or admission no..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface sticky top-0 border-b border-border-soft z-10">
                <tr>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Student Name</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Admission No</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-center">Sessions Held</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-center">Present</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-center">Attendance %</th>
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s: any) => (
                    <tr
                      key={s.id}
                      onClick={() => openStudentDossier(s.id)}
                      className="hover:bg-brand-blue/5 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3 font-bold text-text-primary group-hover:text-brand-blue">
                        {s.name}
                      </td>
                      <td className="px-5 py-3 text-text-muted font-mono">
                        {s.admissionNo}
                      </td>
                      <td className="px-5 py-3 text-center font-semibold">
                        {s.total}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-emerald-700">
                        {s.present}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                            s.percentage >= 75
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {s.percentage}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity">
                          View Dossier <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-text-muted">
                      No student attendance logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCrmTab = () => {
    if (!crmData) return null;
    const counts = crmData.counts || {};
    const total = crmData.total || 0;
    const rate = crmData.conversionRate || 0;

    const stages = [
      { label: "New Lead Inquiries", count: counts.NEW || 0, color: "#3b82f6" },
      { label: "Contacted / Telecalled", count: counts.CONTACTED || 0, color: "#6366f1" },
      { label: "Campus Visited", count: counts.VISITED || 0, color: "#8b5cf6" },
      { label: "Qualified Aspirants", count: counts.QUALIFIED || 0, color: "#d946ef" },
      { label: "Enrolled & Converted", count: counts.CONVERTED || 0, color: "#10b981" },
      { label: "Lost / Closed", count: counts.LOST || 0, color: "#94a3b8" },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Admissions Inquiries"
            value={total}
            subtitle="Prospect pipeline inquiries recorded"
            icon={Users}
            accentColor="blue"
          />
          <MetricCard
            title="Converted Admissions"
            value={counts.CONVERTED || 0}
            subtitle="Formal enrollments generated"
            icon={CheckCircle2}
            accentColor="emerald"
          />
          <MetricCard
            title="Overall Conversion Yield"
            value={`${rate.toFixed(1)}%`}
            subtitle="Inquiry-to-Admission conversion velocity"
            icon={Percent}
            accentColor="violet"
          />
        </div>

        {/* Funnel visualization */}
        <div className="bg-white rounded-2xl border border-border-soft p-6 shadow-2xs">
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-5">
            Admissions Pipeline Funnel Stages
          </h4>
          <div className="max-w-2xl mx-auto">
            <FunnelChart stages={stages} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title="Reports & Analytics">
      <PageShell
        title="Reports & Analytics"
        subtitle="Executive institutional metrics, revenue realization, cohort academics, and operational reports."
        icon={BarChart3}
        accentColor="blue"
      >
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-border-soft p-4 shadow-2xs print:hidden">
            {/* Quick Student Deep-dive lookup */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="Student lookup (name or admission #)..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStudentSearch()}
                  className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 pr-8 text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
                <button
                  onClick={handleStudentSearch}
                  disabled={searchingStudent}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {searchingStudent ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Student Quick Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-44 z-50 w-80 bg-white rounded-xl shadow-xl border border-border-soft p-2 space-y-1 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-text-muted uppercase">
                    <span>Search Matches</span>
                    <button onClick={() => setSearchResults([])} className="hover:underline">Dismiss</button>
                  </div>
                  {searchResults.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSearchResults([]);
                        openStudentDossier(s.id);
                      }}
                      className="p-2 rounded-lg hover:bg-brand-blue/5 cursor-pointer flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-xs font-bold text-text-primary group-hover:text-brand-blue">
                          {s.user?.firstName} {s.user?.lastName}
                        </p>
                        <p className="text-[10px] text-text-muted font-mono">{s.admissionNo}</p>
                      </div>
                      <span className="text-[10px] font-bold text-brand-blue">Dossier →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Global Actions: CSV Export and Print */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={exportCurrentTabCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-text-muted" />
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-text-muted" />
                Print Statement
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-border-soft overflow-x-auto pb-px print:hidden">
            {[
              { key: "OVERVIEW", label: "Executive Overview", icon: Layers },
              { key: "FINANCE", label: "Financials & Revenue", icon: DollarSign },
              { key: "ACADEMICS", label: "Academics & Exams", icon: BookOpen },
              { key: "ATTENDANCE", label: "Attendance & Registers", icon: UserCheck },
              { key: "CRM", label: "CRM & Admissions", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as TabKey);
                    setTableSearch("");
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? "border-brand-blue text-brand-blue bg-brand-blue/5 rounded-t-lg"
                      : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-soft"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Unified Filter Bar */}
          <ReportFilterBar
            filters={filters}
            onChange={(newF) => setFilters(newF)}
            batches={batches}
            centres={centres}
            onRefresh={() => loadTabData(activeTab, filters)}
            loading={loading}
          />

          {/* Tab Content Display */}
          <div className="min-h-[450px]">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-text-muted gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                <p className="text-xs font-semibold">Aggregating real-time analytical metrics...</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                {activeTab === "OVERVIEW" && renderOverviewTab()}
                {activeTab === "FINANCE" && renderFinanceTab()}
                {activeTab === "ACADEMICS" && renderAcademicsTab()}
                {activeTab === "ATTENDANCE" && renderAttendanceTab()}
                {activeTab === "CRM" && renderCrmTab()}
              </div>
            )}
          </div>
        </div>

        {/* Student Dossier Modal */}
        {selectedStudent && (
          <StudentReportModal
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </PageShell>
    </DashboardLayout>
  );
}
