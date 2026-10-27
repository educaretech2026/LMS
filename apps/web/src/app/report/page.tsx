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
  ArrowUpRight,
  UserCheck,
  Percent,
  Receipt,
  CreditCard,
  Building,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import {
  MetricCard,
  DonutChart,
  FunnelChart,
  RadialGauge,
} from "@/components/report/analytics-charts";
import {
  ReportFilterBar,
  HierarchyFilterState,
} from "@/components/report/report-filters";
import { SortableHeader, SortDirection } from "@/components/report/sortable-header";
import { StudentReportModal } from "@/components/report/student-report-modal";
import { useAuth } from "@/components/providers/auth-provider";

type TabKey = "OVERVIEW" | "FINANCE" | "ACADEMICS" | "ATTENDANCE" | "CRM";

export default function ReportsPage() {
  const { role } = useAuth();
  const normalizedRole = role ? role.toUpperCase().replace(/\s+/g, '_') : '';
  const isStudent = normalizedRole === 'STUDENT';
  const isTeacher = normalizedRole === 'TEACHER';

  const [activeTab, setActiveTab] = useState<TabKey>("OVERVIEW");
  const [myStudentReport, setMyStudentReport] = useState<any>(null);
  const [loadingMyReport, setLoadingMyReport] = useState(false);

  useEffect(() => {
    if (isTeacher) {
      setActiveTab("ACADEMICS");
    }
    if (isStudent) {
      setLoadingMyReport(true);
      fetchApi<any>("/report/my-report")
        .then((data) => setMyStudentReport(data))
        .catch(() => {})
        .finally(() => setLoadingMyReport(false));
    }
  }, [isTeacher, isStudent]);

  // Hierarchy filter state
  const [filters, setFilters] = useState<HierarchyFilterState>(() => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    return {
      datePreset: "month",
      startDate: firstDay.toISOString().split("T")[0],
      endDate: d.toISOString().split("T")[0],
      academicYearId: "",
      centreId: "",
      boardId: "",
      standardId: "",
      batchId: "",
      subjectId: "",
    };
  });

  // Hierarchy master state
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

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

  // Table query filter
  const [tableSearch, setTableSearch] = useState("");

  // Table Sorting state per tab
  const [financeSort, setFinanceSort] = useState<{ field: string; direction: SortDirection }>({
    field: "date",
    direction: "desc",
  });
  const [academicSort, setAcademicSort] = useState<{ field: string; direction: SortDirection }>({
    field: "academicYearName",
    direction: "desc",
  });
  const [attendanceSort, setAttendanceSort] = useState<{ field: string; direction: SortDirection }>({
    field: "centreName",
    direction: "asc",
  });

  // Initial load of master metadata
  useEffect(() => {
    Promise.all([
      fetchApi("/setup/academic-years").catch(() => []),
      fetchApi("/setup/centres").catch(() => []),
      fetchApi("/setup/boards").catch(() => []),
      fetchApi("/setup/subjects").catch(() => []),
    ]).then(([y, c, b, s]) => {
      setAcademicYears(Array.isArray(y) ? y : []);
      setCentres(Array.isArray(c) ? c : []);
      setBoards(Array.isArray(b) ? b : []);
      setSubjects(Array.isArray(s) ? s : []);
    });
  }, []);

  // Cascading Standards based on Board
  useEffect(() => {
    if (filters.boardId) {
      fetchApi(`/setup/standards?boardId=${filters.boardId}`)
        .then((st) => setStandards(Array.isArray(st) ? st : []))
        .catch(() => setStandards([]));
    } else {
      fetchApi("/setup/standards")
        .then((st) => setStandards(Array.isArray(st) ? st : []))
        .catch(() => setStandards([]));
    }
  }, [filters.boardId]);

  // Cascading Batches based on Centre / Standard
  useEffect(() => {
    let q = "";
    if (filters.centreId && filters.standardId) {
      q = `?centreId=${filters.centreId}&standardId=${filters.standardId}${filters.boardId ? `&boardId=${filters.boardId}` : ""}`;
    }
    fetchApi(q ? `/attendance/batches/filter${q}` : "/setup/batches")
      .then((b) => setBatches(Array.isArray(b) ? b : []))
      .catch(() => setBatches([]));
  }, [filters.centreId, filters.standardId, filters.boardId]);

  // Fetch report data on tab or filter change
  useEffect(() => {
    loadTabData(activeTab, filters);
  }, [
    activeTab,
    filters.startDate,
    filters.endDate,
    filters.academicYearId,
    filters.centreId,
    filters.boardId,
    filters.standardId,
    filters.batchId,
    filters.subjectId,
  ]);

  const loadTabData = async (tab: TabKey, f: HierarchyFilterState) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (f.startDate) q.set("startDate", f.startDate);
      if (f.endDate) q.set("endDate", f.endDate);
      if (f.academicYearId) q.set("academicYearId", f.academicYearId);
      if (f.centreId) q.set("centreId", f.centreId);
      if (f.boardId) q.set("boardId", f.boardId);
      if (f.standardId) q.set("standardId", f.standardId);
      if (f.batchId) q.set("batchId", f.batchId);
      if (f.subjectId) q.set("subjectId", f.subjectId);

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

  const handleSortToggle = (
    currentSort: { field: string; direction: SortDirection },
    setSort: React.Dispatch<React.SetStateAction<{ field: string; direction: SortDirection }>>,
    field: string
  ) => {
    if (currentSort.field === field) {
      setSort({
        field,
        direction: currentSort.direction === "asc" ? "desc" : currentSort.direction === "desc" ? null : "asc",
      });
    } else {
      setSort({ field, direction: "asc" });
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
      csvContent += "Date,Classification,Category/Head,Payment Mode,Authorized By/Student,Amount\n";
      const tx = financeData.transactions || [];
      const fees = financeData.feeRecords || [];
      tx.forEach((t: any) => {
        csvContent += `"${new Date(t.date).toLocaleDateString()}","${t.type}","${t.category}","-","${t.recordedBy?.firstName || 'System'}","${t.amount}"\n`;
      });
      fees.forEach((f: any) => {
        csvContent += `"${new Date(f.date).toLocaleDateString()}","FEE PAID","${f.feeHead}","${f.paymentMode}","${f.studentName} (${f.admissionNo})","${f.amount}"\n`;
      });
    } else if (activeTab === "ACADEMICS" && academicData) {
      csvContent += "Academic Year,Centre,Class,Batch,Subject,Topic,Exam Title,Attempts,Avg Score %,Top Score\n";
      sortedExams.forEach((e: any) => {
        csvContent += `"${e.academicYearName}","${e.centreName}","${e.standardName}","${e.batchName}","${e.subjectName}","${e.topicName}","${e.title}","${e.attemptsCount}","${e.averagePercentage}%","${e.topScore}"\n`;
      });
    } else if (activeTab === "ATTENDANCE" && attendanceData) {
      csvContent += "Centre,Class,Batch,Student Name,Admission No,Sessions Held,Present,Attendance %\n";
      sortedAttendance.forEach((s: any) => {
        csvContent += `"${s.centreName}","${s.standardName}","${s.batchName}","${s.name}","${s.admissionNo}","${s.total}","${s.present}","${s.percentage}%"\n`;
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
  // SORTED & FILTERED DATA COMPUTATION
  // ─────────────────────────────────────────────────────────────

  // 1. Finance items (combining transactions + fee records with live details)
  const combinedFinanceRecords = useMemo(() => {
    if (!financeData) return [];
    const items: any[] = [];

    (financeData.transactions || []).forEach((t: any) => {
      items.push({
        id: `tx-${t.id}`,
        date: new Date(t.date).getTime(),
        dateStr: new Date(t.date).toLocaleDateString("en-IN"),
        type: t.type,
        category: t.category || "General",
        mode: "-",
        authorizedBy: t.recordedBy ? `${t.recordedBy.firstName} ${t.recordedBy.lastName}` : "System",
        amount: t.amount,
        isFee: false,
      });
    });

    (financeData.feeRecords || []).forEach((f: any) => {
      items.push({
        id: `fee-${f.id}`,
        date: new Date(f.date).getTime(),
        dateStr: new Date(f.date).toLocaleDateString("en-IN"),
        type: "FEE PAID",
        category: f.feeHead || "Tuition Fee",
        mode: f.paymentMode || "CASH",
        authorizedBy: `${f.studentName} (${f.admissionNo})`,
        amount: f.amount,
        isFee: true,
      });
    });

    let filtered = items;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(
        (it) =>
          it.category.toLowerCase().includes(q) ||
          it.type.toLowerCase().includes(q) ||
          it.authorizedBy.toLowerCase().includes(q) ||
          it.amount.toString().includes(q)
      );
    }

    if (financeSort.direction) {
      filtered = [...filtered].sort((a, b) => {
        const valA = a[financeSort.field];
        const valB = b[financeSort.field];
        if (typeof valA === "number" && typeof valB === "number") {
          return financeSort.direction === "asc" ? valA - valB : valB - valA;
        }
        return financeSort.direction === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return filtered;
  }, [financeData, tableSearch, financeSort]);

  // 2. Academic Exams (hierarchically sorted: Year -> Centre -> Class -> Subject -> Topic -> Exam)
  const sortedExams = useMemo(() => {
    if (!academicData?.exams) return [];
    let list = [...academicData.exams];

    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (e: any) =>
          e.title?.toLowerCase().includes(q) ||
          e.centreName?.toLowerCase().includes(q) ||
          e.standardName?.toLowerCase().includes(q) ||
          e.subjectName?.toLowerCase().includes(q) ||
          e.batchName?.toLowerCase().includes(q)
      );
    }

    if (academicSort.direction) {
      list.sort((a, b) => {
        const valA = a[academicSort.field];
        const valB = b[academicSort.field];
        if (typeof valA === "number" && typeof valB === "number") {
          return academicSort.direction === "asc" ? valA - valB : valB - valA;
        }
        return academicSort.direction === "asc"
          ? String(valA || "").localeCompare(String(valB || ""))
          : String(valB || "").localeCompare(String(valA || ""));
      });
    } else {
      // Default Academic Hierarchy Sorting: Year -> Centre -> Class -> Subject -> Title
      list.sort((a, b) => {
        if (a.academicYearName !== b.academicYearName)
          return b.academicYearName.localeCompare(a.academicYearName);
        if (a.centreName !== b.centreName)
          return a.centreName.localeCompare(b.centreName);
        if (a.standardName !== b.standardName)
          return a.standardName.localeCompare(b.standardName);
        if (a.subjectName !== b.subjectName)
          return a.subjectName.localeCompare(b.subjectName);
        return a.title.localeCompare(b.title);
      });
    }

    return list;
  }, [academicData, tableSearch, academicSort]);

  // 3. Attendance Registers (hierarchically sorted: Centre -> Class -> Batch -> Student Name)
  const sortedAttendance = useMemo(() => {
    if (!attendanceData?.studentList) return [];
    let list = [...attendanceData.studentList];

    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (s: any) =>
          s.name?.toLowerCase().includes(q) ||
          s.admissionNo?.toLowerCase().includes(q) ||
          s.centreName?.toLowerCase().includes(q) ||
          s.standardName?.toLowerCase().includes(q) ||
          s.batchName?.toLowerCase().includes(q)
      );
    }

    if (attendanceSort.direction) {
      list.sort((a, b) => {
        const valA = a[attendanceSort.field];
        const valB = b[attendanceSort.field];
        if (typeof valA === "number" && typeof valB === "number") {
          return attendanceSort.direction === "asc" ? valA - valB : valB - valA;
        }
        return attendanceSort.direction === "asc"
          ? String(valA || "").localeCompare(String(valB || ""))
          : String(valB || "").localeCompare(String(valA || ""));
      });
    } else {
      // Default Hierarchy: Centre -> Class -> Batch -> Name
      list.sort((a, b) => {
        if (a.centreName !== b.centreName) return a.centreName.localeCompare(b.centreName);
        if (a.standardName !== b.standardName) return a.standardName.localeCompare(b.standardName);
        if (a.batchName !== b.batchName) return a.batchName.localeCompare(b.batchName);
        return a.name.localeCompare(b.name);
      });
    }

    return list;
  }, [attendanceData, tableSearch, attendanceSort]);

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
                {
                  label: "Converted Admissions",
                  count: crm.converted || 0,
                  percentage: crm.conversionRate,
                  color: "#10b981",
                },
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
    const feeRecords = financeData.feeRecords || [];
    const feeTotal = financeData.feeTotal || 0;

    const expenseTotal = transactions
      .filter((t: any) => t.type === "EXPENSE")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const adhocIncome = transactions
      .filter((t: any) => t.type === "INCOME")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalIncome = feeTotal + adhocIncome;
    const netProfit = totalIncome - expenseTotal;

    return (
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Realized Revenue
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
              {transactions.filter((t: any) => t.type === "EXPENSE").length} Vouchers Logged
            </p>
          </div>

          <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <p className="text-[11px] font-bold text-brand-blue uppercase tracking-wider">
              Net Operating Balance
            </p>
            <p className="text-2xl font-black text-brand-blue mt-1 flex items-center">
              <IndianRupee className="h-5 w-5" />
              {netProfit.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-brand-blue/80 font-medium mt-1">
              Net Operating Margin: {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* Live Transaction Ledger Table with Complete Details */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Live Transaction & Fee Collection Ledger
              </h3>
              <p className="text-xs text-text-muted">
                Complete statement with voucher details, student receipt links, and payment modes
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search transactions, student, category..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface sticky top-0 border-b border-border-soft z-10">
                <tr>
                  <SortableHeader
                    label="Date"
                    field="date"
                    currentSortField={financeSort.field}
                    currentDirection={financeSort.direction}
                    onSort={(f) => handleSortToggle(financeSort, setFinanceSort, f)}
                  />
                  <SortableHeader
                    label="Classification"
                    field="type"
                    currentSortField={financeSort.field}
                    currentDirection={financeSort.direction}
                    onSort={(f) => handleSortToggle(financeSort, setFinanceSort, f)}
                  />
                  <SortableHeader
                    label="Category / Purpose"
                    field="category"
                    currentSortField={financeSort.field}
                    currentDirection={financeSort.direction}
                    onSort={(f) => handleSortToggle(financeSort, setFinanceSort, f)}
                  />
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Payment Mode</th>
                  <SortableHeader
                    label="Authorized By / Student"
                    field="authorizedBy"
                    currentSortField={financeSort.field}
                    currentDirection={financeSort.direction}
                    onSort={(f) => handleSortToggle(financeSort, setFinanceSort, f)}
                  />
                  <SortableHeader
                    label="Amount"
                    field="amount"
                    align="right"
                    currentSortField={financeSort.field}
                    currentDirection={financeSort.direction}
                    onSort={(f) => handleSortToggle(financeSort, setFinanceSort, f)}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {combinedFinanceRecords.length > 0 ? (
                  combinedFinanceRecords.map((item: any) => (
                    <tr key={item.id} className="hover:bg-surface/50">
                      <td className="px-5 py-3 font-medium text-text-secondary whitespace-nowrap">
                        {item.dateStr}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            item.type === "INCOME"
                              ? "bg-cyan-100 text-cyan-800"
                              : item.type === "FEE PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-text-primary">
                        {item.category}
                      </td>
                      <td className="px-5 py-3 text-text-muted font-mono uppercase text-[11px]">
                        {item.mode}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {item.authorizedBy}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-text-primary whitespace-nowrap">
                        ₹{item.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-text-muted">
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
    const summary = academicData.summary || {};

    const gradeEntries = Object.entries(summary.gradeDistribution || {}).map(([grade, count]: any) => ({
      name: grade,
      value: count,
      color:
        grade === "A+" || grade === "A"
          ? "#10b981"
          : grade === "B+" || grade === "B"
          ? "#3b82f6"
          : grade === "C"
          ? "#f59e0b"
          : "#f43f5e",
    }));

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
            value={sortedExams.length > 0 ? Math.max(...sortedExams.map((e: any) => e.topScore)) : 0}
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

        {/* Academic Hierarchy Exams Table */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>Academic Hierarchy Examination Directory</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue">
                  Year → Centre → Class → Subject → Topic
                </span>
              </h3>
              <p className="text-xs text-text-muted">
                Sorted hierarchically by institutional setup with multi-level column sort
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search exam, class, subject..."
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
                  <SortableHeader
                    label="Academic Year"
                    field="academicYearName"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Centre"
                    field="centreName"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Class / Board"
                    field="standardName"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Subject / Topic"
                    field="subjectName"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Exam Title"
                    field="title"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Attempts"
                    field="attemptsCount"
                    align="center"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Batch Avg %"
                    field="averagePercentage"
                    align="center"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                  <SortableHeader
                    label="Top Score"
                    field="topScore"
                    align="right"
                    currentSortField={academicSort.field}
                    currentDirection={academicSort.direction}
                    onSort={(f) => handleSortToggle(academicSort, setAcademicSort, f)}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {sortedExams.length > 0 ? (
                  sortedExams.map((exam: any) => (
                    <tr key={exam.id} className="hover:bg-surface/50">
                      <td className="px-5 py-3 font-semibold text-text-muted">
                        {exam.academicYearName}
                      </td>
                      <td className="px-5 py-3 font-medium text-text-secondary">
                        {exam.centreName}
                      </td>
                      <td className="px-5 py-3 font-semibold text-text-primary">
                        {exam.standardName}
                        {exam.boardName !== "-" && (
                          <span className="text-[10px] text-text-muted block">{exam.boardName}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-bold text-text-primary">{exam.subjectName}</span>
                        {exam.topicName !== "-" && (
                          <span className="text-[10px] text-text-muted block truncate max-w-[140px]">
                            {exam.topicName}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-bold text-text-primary">
                        {exam.title}
                        <span className="text-[10px] text-text-muted block font-normal">
                          {exam.batchName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-text-secondary">
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
                    <td colSpan={8} className="p-8 text-center text-text-muted">
                      No examinations found matching your filter hierarchy.
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
            value={sortedAttendance.length}
            subtitle="Students tracked in batch/filter"
            icon={Users}
            accentColor="violet"
          />
        </div>

        {/* Student Attendance Register organized by hierarchy */}
        <div className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-border-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span>Student Attendance Standing Register</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue">
                  Centre → Class → Batch → Student
                </span>
              </h3>
              <p className="text-xs text-text-muted">
                Mirrors Attendance module setup. Click any student row to view and print their comprehensive dossier
              </p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search student, class, batch..."
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
                  <SortableHeader
                    label="Centre"
                    field="centreName"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <SortableHeader
                    label="Class"
                    field="standardName"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <SortableHeader
                    label="Batch"
                    field="batchName"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <SortableHeader
                    label="Student Name"
                    field="name"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <th className="px-5 py-3 font-bold text-text-muted uppercase">Admission No</th>
                  <SortableHeader
                    label="Sessions"
                    field="total"
                    align="center"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <SortableHeader
                    label="Present"
                    field="present"
                    align="center"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <SortableHeader
                    label="Attendance %"
                    field="percentage"
                    align="center"
                    currentSortField={attendanceSort.field}
                    currentDirection={attendanceSort.direction}
                    onSort={(f) => handleSortToggle(attendanceSort, setAttendanceSort, f)}
                  />
                  <th className="px-5 py-3 font-bold text-text-muted uppercase text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {sortedAttendance.length > 0 ? (
                  sortedAttendance.map((s: any) => (
                    <tr
                      key={s.id}
                      onClick={() => openStudentDossier(s.id)}
                      className="hover:bg-brand-blue/5 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3 font-medium text-text-secondary whitespace-nowrap">
                        {s.centreName}
                      </td>
                      <td className="px-5 py-3 font-semibold text-text-primary whitespace-nowrap">
                        {s.standardName}
                      </td>
                      <td className="px-5 py-3 text-text-secondary whitespace-nowrap">
                        {s.batchName}
                      </td>
                      <td className="px-5 py-3 font-bold text-text-primary group-hover:text-brand-blue whitespace-nowrap">
                        {s.name}
                      </td>
                      <td className="px-5 py-3 text-text-muted font-mono whitespace-nowrap">
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
                    <td colSpan={9} className="p-8 text-center text-text-muted">
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

  if (isStudent) {
    return (
      <DashboardLayout title="My Academic Report">
        <PageShell
          title="My Academic Performance Dossier"
          subtitle="Your personal examination records, attendance statistics, and academic progress."
          icon={BarChart3}
          accentColor="blue"
        >
          {loadingMyReport ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
              <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
              <span>Loading your academic dossier...</span>
            </div>
          ) : myStudentReport ? (
            <div className="space-y-6">
              {/* Student Header */}
              <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 text-brand-blue font-black text-xl flex items-center justify-center">
                    {myStudentReport.name?.charAt(0) || "S"}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">{myStudentReport.name}</h2>
                    <p className="text-xs text-text-muted">
                      Admission No: <span className="font-mono font-bold text-text-primary">{myStudentReport.admissionNo}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors shadow-2xs"
                >
                  <Printer className="h-4 w-4 text-text-muted" />
                  <span>Print Dossier</span>
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                  title="Attendance Rate"
                  value={`${myStudentReport.attendanceDetails?.percentage || 0}%`}
                  subtitle={`${myStudentReport.attendanceDetails?.presentDays || 0} of ${myStudentReport.attendanceDetails?.totalDays || 0} sessions present`}
                  icon={UserCheck}
                  accentColor="emerald"
                  trend={{
                    value: parseFloat(myStudentReport.attendanceDetails?.percentage || 0) >= 75 ? "Good Standing" : "Needs Improvement",
                    isPositive: parseFloat(myStudentReport.attendanceDetails?.percentage || 0) >= 75,
                  }}
                />
                <MetricCard
                  title="Examinations Taken"
                  value={`${myStudentReport.examResults?.length || 0}`}
                  subtitle="Completed assessments"
                  icon={Award}
                  accentColor="blue"
                />
                <MetricCard
                  title="Average Exam Score"
                  value={`${
                    myStudentReport.examResults?.length > 0
                      ? (
                          myStudentReport.examResults.reduce((acc: number, r: any) => acc + (r.percentage || 0), 0) /
                          myStudentReport.examResults.length
                        ).toFixed(1)
                      : "0"
                  }%`}
                  subtitle="Cumulative assessment average"
                  icon={TrendingUp}
                  accentColor="violet"
                />
              </div>

              {/* Exam Results Table */}
              <div className="bg-white rounded-2xl border border-border-soft p-5 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-text-primary">Examination Records</h3>
                {myStudentReport.examResults?.length === 0 ? (
                  <p className="text-xs text-text-muted py-6 text-center">No examination records recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border-soft text-text-muted font-bold text-[11px] uppercase tracking-wider">
                          <th className="pb-3 pl-2">Exam Title</th>
                          <th className="pb-3">Type</th>
                          <th className="pb-3">Marks Obtained</th>
                          <th className="pb-3">Total Marks</th>
                          <th className="pb-3">Percentage</th>
                          <th className="pb-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-soft/60">
                        {myStudentReport.examResults.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-surface/50">
                            <td className="py-3 pl-2 font-semibold text-text-primary">{r.exam?.title || "Assessment"}</td>
                            <td className="py-3 font-medium text-text-muted">{r.exam?.type || "Standard"}</td>
                            <td className="py-3 font-bold text-text-primary">{r.marksObtained ?? "N/A"}</td>
                            <td className="py-3 text-text-muted">{r.totalMarks ?? "N/A"}</td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  (r.percentage || 0) >= 50
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : "N/A"}
                              </span>
                            </td>
                            <td className="py-3 text-text-muted">
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-text-muted text-xs">
              Unable to load your student dossier at this time.
            </div>
          )}
        </PageShell>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Reports & Analytics">
      {/* 60% Print scale styling injected for Bug 5 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          html, body {
            zoom: 60% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      <PageShell
        title="Reports & Analytics"
        subtitle="Executive institutional metrics, live financial ledgers, cohort academics, and operational reports."
        icon={BarChart3}
        accentColor="blue"
      >
        <div className="space-y-4 sm:space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-border-soft p-3.5 sm:p-4 shadow-2xs print:hidden">
            {/* Quick Student Deep-dive lookup */}
            <div className="relative w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Student lookup (name or adm #)..."
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
                <div className="absolute left-0 top-11 z-50 w-full sm:w-80 bg-white rounded-xl shadow-xl border border-border-soft p-2 space-y-1 max-h-60 overflow-y-auto">
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
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={exportCurrentTabCSV}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-text-muted" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 border border-border-soft text-xs font-bold text-text-primary transition-colors shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-text-muted" />
                <span>Print (60%)</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-border-soft overflow-x-auto no-scrollbar pb-px print:hidden">
            {[
              { key: "OVERVIEW", label: "Executive Overview", icon: Layers, roles: ["SUPER_ADMIN", "CENTRE_ADMIN"] },
              { key: "FINANCE", label: "Financials & Revenue", icon: DollarSign, roles: ["SUPER_ADMIN", "CENTRE_ADMIN"] },
              { key: "ACADEMICS", label: "Academics & Exams", icon: BookOpen, roles: ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"] },
              { key: "ATTENDANCE", label: "Attendance & Registers", icon: UserCheck, roles: ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"] },
              { key: "CRM", label: "CRM & Admissions", icon: Users, roles: ["SUPER_ADMIN", "CENTRE_ADMIN"] },
            ]
              .filter((tab) => !tab.roles || tab.roles.includes(normalizedRole || "SUPER_ADMIN"))
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as TabKey);
                    setTableSearch("");
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? "border-brand-blue text-brand-blue bg-brand-blue/5 rounded-t-lg"
                      : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-soft"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cascading Hierarchy Filter Bar */}
          <ReportFilterBar
            filters={filters}
            onChange={(newF) => setFilters(newF)}
            academicYears={academicYears}
            centres={centres}
            boards={boards}
            standards={standards}
            batches={batches}
            subjects={subjects}
            onRefresh={() => loadTabData(activeTab, filters)}
            loading={loading}
          />

          {/* Tab Content Display */}
          <div className="min-h-[450px]">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-text-muted gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
                <p className="text-xs font-semibold">Live fetching and computing analytical metrics...</p>
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
