"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CreditCard, Plus, Search, Filter, X, ChevronRight, BookOpen, ChevronDown, CheckCircle2, FileText, Download, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";

interface FeeRecord {
  id: string;
  receiptNo: string;
  studentName: string;
  course: string;
  amount: number;
  date: string;
  status: "PAID" | "PENDING" | "OVERDUE";
  paymentMode: string;
  studentId?: string;
  feeHead?: string;
  centreAddress?: string;
  centreName?: string;
}

export function FeeClient({ initialFees, students, tracks = [] }: { initialFees: FeeRecord[], students: any[], tracks?: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Records");
  const [fees, setFees] = useState<FeeRecord[]>(initialFees);
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("All Classes");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [filterMode, setFilterMode] = useState("All Modes");
  const [showModal, setShowModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeRecord | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const { role } = useAuth();

  const refresh = async () => {
    try {
      const data = await fetchApi(`/fee?t=${Date.now()}`, { 
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } 
      });
      const mapped = (data as any[]).map(d => ({
        id: d.id,
        receiptNo: d.receiptNo,
        studentName: d.student?.user?.firstName ? `${d.student.user.firstName} ${d.student.user.lastName}` : "Unknown",
        course: d.student?.enrollments?.[0]?.batch?.name || "N/A",
        amount: d.amount,
        date: new Date(d.createdAt || d.date || Date.now()).toLocaleDateString(),
        status: d.status,
        paymentMode: d.paymentMode || "-",
        feeHead: d.feeHead || "General",
        centreAddress: d.student?.enrollments?.[0]?.batch?.centre?.address,
        centreName: d.student?.enrollments?.[0]?.batch?.centre?.name
      }));
      setFees(mapped as FeeRecord[]);
      
      // Force Next.js to re-fetch Server Components if needed
      // Force Next.js to re-fetch Server Components
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };
  
  if (role === 'TEACHER') {
    return (
      <DashboardLayout title="Fee Management">
        <div className="flex h-[60vh] items-center justify-center flex-col text-center">
          <ShieldCheck className="h-16 w-16 text-brand-red/50 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">Teachers do not have permission to view or manage fee information. This section is restricted to administrators and students.</p>
        </div>
      </DashboardLayout>
    );
  }

  const filtered = fees.filter(f => {
    if (role === 'STUDENT') {
      const searchLower = search.toLowerCase();
      return f.amount.toString().includes(searchLower) || 
             (f.date && f.date.toLowerCase().includes(searchLower)) ||
             (f.feeHead && f.feeHead.toLowerCase().includes(searchLower));
    } else {
      const studentName = f.studentName || "";
      const receiptNo = f.receiptNo || "";
      const course = f.course || "";
      
      const matchSearch = studentName.toLowerCase().includes(search.toLowerCase()) || 
                          receiptNo.toLowerCase().includes(search.toLowerCase()) ||
                          course.toLowerCase().includes(search.toLowerCase());
      const matchCourse = filterCourse === "All Classes" || f.course === filterCourse;
      const matchStatus = filterStatus === "All Status" || f.status === filterStatus;
      const matchMode = filterMode === "All Modes" || f.paymentMode === filterMode;
      return matchSearch && matchCourse && matchStatus && matchMode;
    }
  });

  const totalCollected = fees.filter(f => f.status === 'PAID').reduce((sum, f) => sum + Number(f.amount), 0);
  const pendingFees = fees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + Number(f.amount), 0);
  const overdue = fees.filter(f => f.status === 'OVERDUE').reduce((sum, f) => sum + Number(f.amount), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonth = fees.filter(f => {
    if (f.status !== 'PAID') return false;
    const d = new Date(f.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, f) => sum + Number(f.amount), 0);

  const studentSummaries = students.map((s: any) => {
    const sFees = fees.filter(f => f.studentId === s.id);
    const totalPaid = sFees.filter(f => f.status === 'PAID').reduce((sum, f) => sum + Number(f.amount), 0);
    const pending = sFees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + Number(f.amount), 0);
    const overdue = sFees.filter(f => f.status === 'OVERDUE').reduce((sum, f) => sum + Number(f.amount), 0);
    const totalDue = pending + overdue;
    
    let status = "PAID";
    if (overdue > 0) status = "OVERDUE";
    else if (pending > 0) status = "PENDING";
    
    const phone = s.parentPhone || s.user?.phone || "";
    
    return {
      id: s.id,
      name: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim(),
      course: s.enrollments?.[0]?.batch?.name || "N/A",
      phone,
      totalPaid,
      totalDue,
      status
    };
  });

  const filteredStudents = studentSummaries.filter(s => {
    const searchLower = search.toLowerCase();
    return s.name.toLowerCase().includes(searchLower) || s.course.toLowerCase().includes(searchLower);
  });

  return (
    <DashboardLayout title="Fee Management">
      <div className="flex flex-col h-full bg-surface">
        
        {/* Header Section */}
        <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Fee Management</h1>
              <p className="text-xs text-text-muted mt-1">Track, collect, and manage student fee payments</p>
            </div>
          </div>
          {role !== 'STUDENT' && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
            >
              <Plus className="h-4 w-4" /> Collect Fee
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="px-6 lg:px-8 py-4 flex items-center gap-2 text-xs font-medium text-text-muted">
          <Link href="/" className="flex items-center gap-1.5 hover:text-text-primary transition-colors">
            <CreditCard className="h-3.5 w-3.5" /> Finance
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary">Fees</span>
        </div>

        <div className="px-6 lg:px-8 pb-8 space-y-6 flex-1 overflow-y-auto">

          {/* Summary Cards */}
          {role !== 'STUDENT' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Collected", value: `₹${totalCollected.toLocaleString()}`,  color: "text-brand-blue bg-brand-blue/10" },
                { label: "Pending Fees",    value: `₹${pendingFees.toLocaleString()}`,  color: "text-warning bg-warning/10"       },
                { label: "Overdue",         value: `₹${overdue.toLocaleString()}`,      color: "text-brand-red bg-brand-red/10"   },
                { label: "This Month",      value: `₹${thisMonth.toLocaleString()}`,  color: "text-success bg-success/10"       },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-2xl border border-border-soft p-6 shadow-sm">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${c.color} mb-4`}>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-bold text-text-primary tracking-tight">{c.value}</p>
                  <p className="text-xs font-bold text-text-muted mt-1 uppercase tracking-wider">{c.label}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Filters Section */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6 text-sm font-bold text-text-primary">
              <Filter className="h-4 w-4 text-brand-blue" /> Filter Records
            </div>
            
            <div className="flex mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={role === 'STUDENT' ? "Search by Amount, Date, or Fee Head..." : "Search by Student Name, Receipt No, or Course..."}
                  className="w-full h-10 rounded-l-lg border border-r-0 border-border-soft bg-surface-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <button className="h-10 px-6 rounded-r-lg bg-brand-blue-dark text-white text-sm font-semibold hover:bg-brand-blue transition-colors">
                Search
              </button>
            </div>

            {role !== 'STUDENT' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Class/Course", state: filterCourse, set: setFilterCourse, options: ["All Classes", "Class 11", "Class 12 (A)"] },
                  { label: "Status", state: filterStatus, set: setFilterStatus, options: ["All Status", "Paid", "Pending", "Overdue"] },
                  { label: "Payment Mode", state: filterMode, set: setFilterMode, options: ["All Modes", "Online", "-", "Cash", "Bank Transfer"] },
                  { label: "Rows", options: ["10", "20", "50"] },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">{f.label}</label>
                    <div className="relative">
                      <select
                        value={f.state}
                        onChange={(e) => f.set && f.set(e.target.value)}
                        className="w-full h-9 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                      >
                        {f.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List Section */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 border-b border-border-soft flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveTab("Records")}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "Records" ? "border-brand-blue text-brand-blue" : "border-transparent text-text-muted hover:text-text-primary"}`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> Fee Records
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab("Students")}
                  className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === "Students" ? "border-brand-blue text-brand-blue" : "border-transparent text-text-muted hover:text-text-primary"}`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Student Balances
                  </div>
                </button>
              </div>
              
              <div className="flex items-center gap-1 text-xs font-medium">
                <button className="px-2 py-1 text-text-muted hover:text-text-primary">« Previous</button>
                <button className="h-7 w-7 rounded bg-brand-blue text-white flex items-center justify-center shadow-sm">1</button>
                <button className="px-2 py-1 text-text-muted hover:text-text-primary">Next »</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {activeTab === "Records" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-white">
                    {role !== 'STUDENT' && (
                      <th className="px-6 py-4 text-left">
                        <input type="checkbox" className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20" />
                      </th>
                    )}
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Receipt No</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">{role === 'STUDENT' ? "Fee Head" : "Student & Course"}</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Date & Mode</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-sm text-text-muted">
                        No fee records match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-2/30 transition-colors">
                      {role !== 'STUDENT' && (
                        <td className="px-6 py-4">
                          <input type="checkbox" className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20" />
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-bold text-xs">
                          {f.receiptNo}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {role === 'STUDENT' ? (
                          <p className="font-bold text-text-primary">{f.feeHead}</p>
                        ) : (
                          <>
                            <p className="font-bold text-text-primary">{f.studentName}</p>
                            <p className="text-[11px] text-text-muted mt-0.5">{f.course}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-bold text-text-primary">₹{f.amount}</span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs font-medium text-text-primary">{f.date}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{f.paymentMode}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                          f.status === "PAID" ? "bg-success/10 border-success/20 text-success" : 
                          f.status === "PENDING" ? "bg-warning/10 border-warning/20 text-warning" :
                          "bg-brand-red/10 border-brand-red/20 text-brand-red"
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {f.status === "PAID" && (
                            <button 
                              onClick={() => setSelectedReceipt(f)}
                              className="inline-flex items-center gap-1.5 text-brand-blue hover:text-brand-blue-dark text-xs font-bold transition-colors">
                              <Download className="h-3.5 w-3.5" /> Receipt
                            </button>
                          )}
                          {role !== 'STUDENT' && f.status !== "PAID" && (
                            <button 
                              onClick={async () => {
                                await fetchApi(`/fee/${f.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'PAID' }) });
                                setFees(fees.map(r => r.id === f.id ? { ...r, status: 'PAID' } : r));
                              }}
                              className="inline-flex items-center gap-1 text-success hover:text-green-700 text-xs font-bold transition-colors">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                            </button>
                          )}
                          {role !== 'STUDENT' && f.status === "PAID" && (
                            <button 
                              onClick={async () => {
                                await fetchApi(`/fee/${f.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'PENDING' }) });
                                setFees(fees.map(r => r.id === f.id ? { ...r, status: 'PENDING' } : r));
                              }}
                              className="inline-flex items-center gap-1 text-warning hover:text-yellow-700 text-xs font-bold transition-colors">
                              <X className="h-3.5 w-3.5" /> Mark Unpaid
                            </button>
                          )}
                          {role !== 'STUDENT' && (
                            <button 
                              onClick={() => setDeleteRecordId(f.id)}
                              className="inline-flex items-center gap-1 text-text-muted hover:text-brand-red text-xs font-bold transition-colors">
                              <X className="h-3.5 w-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-white">
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Student & Course</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Paid</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Due</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-sm text-text-muted">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-text-primary">{s.name}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{s.course}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-secondary">{s.phone || "N/A"}</td>
                        <td className="px-4 py-4 font-bold text-success">₹{s.totalPaid}</td>
                        <td className="px-4 py-4 font-bold text-brand-red">₹{s.totalDue}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            s.status === "PAID" ? "bg-success/10 border-success/20 text-success" : 
                            s.status === "PENDING" ? "bg-warning/10 border-warning/20 text-warning" :
                            "bg-brand-red/10 border-brand-red/20 text-brand-red"
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {(s.totalDue > 0 && s.phone) && (
                            <button 
                              onClick={async (e) => {
                                const btn = e.currentTarget;
                                btn.disabled = true;
                                btn.innerText = "Sending...";
                                try {
                                  await fetchApi(`/fee/${s.id}/reminder`, {
                                    method: 'POST',
                                    body: JSON.stringify({ amount: s.totalDue })
                                  });
                                  btn.innerText = "Sent!";
                                  btn.classList.replace("bg-green-500", "bg-brand-blue");
                                  btn.classList.replace("hover:bg-green-600", "hover:bg-brand-blue-dark");
                                } catch (err) {
                                  btn.innerText = "Failed";
                                  btn.classList.replace("bg-green-500", "bg-brand-red");
                                }
                                setTimeout(() => {
                                  if (btn) {
                                    btn.disabled = false;
                                    btn.innerText = "Send Reminder";
                                    btn.className = "inline-flex items-center gap-1.5 rounded bg-green-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-600 transition-colors";
                                  }
                                }, 3000);
                              }}
                              className="inline-flex items-center gap-1.5 rounded bg-green-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-600 transition-colors">
                              Send Reminder
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collect Fee Modal */}
      {showModal && <CollectFeeModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); refresh(); }} students={students} tracks={tracks} />}
      
      {/* Print Receipt Modal */}
      {selectedReceipt && <PrintReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
      
      {/* Delete Record Modal */}
      {deleteRecordId && <DeleteRecordModal id={deleteRecordId} onClose={() => setDeleteRecordId(null)} onSuccess={() => { setDeleteRecordId(null); refresh(); }} />}
    </DashboardLayout>
  );
}

function CollectFeeModal({ onClose, onSuccess, students, tracks }: { onClose: () => void, onSuccess: () => void, students: any[], tracks: any[] }) {
  const [activeTab, setActiveTab] = useState("Payment Details");
  const [loading, setLoading] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [feeHead, setFeeHead] = useState("Tuition Fee");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [status, setStatus] = useState("PAID");
  const [targetTrack, setTargetTrack] = useState("");

  const handleSave = async () => {
    if (!studentId || !amount || !targetTrack) return;
    setLoading(true);
    try {
      await fetchApi('/fee', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          feeHead,
          amount: Number(amount),
          paymentMode,
          status,
          targetTrack
        })
      });
      onSuccess();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const TABS = [
    { id: "Payment Details", icon: CreditCard },
    { id: "Student Info", icon: User },
    { id: "Remarks", icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-text-primary">Collect Fee</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 border-b border-border-soft flex items-center gap-6 overflow-x-auto shrink-0 hide-scrollbar">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 py-4 min-w-max border-b-2 transition-colors ${
                  active ? "border-brand-blue" : "border-transparent hover:border-border-soft"
                }`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shadow-sm ${
                  active ? "bg-brand-blue text-white" : "bg-surface-2 text-text-secondary"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-xs font-bold ${active ? "text-brand-blue" : "text-text-secondary"}`}>
                  {tab.id}
                </span>
              </button>
            )
          })}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          <div className="bg-white rounded-xl border border-border-soft p-6">
            {activeTab === "Payment Details" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Select Student <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      value={studentId} 
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="">---Select Student---</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.user?.firstName} {s.user?.lastName} ({s.admissionNo})</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Fee Head <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      value={feeHead}
                      onChange={e => setFeeHead(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="Tuition Fee">Tuition Fee</option>
                      <option value="Admission Fee">Admission Fee</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Amount (₹) <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0" 
                      className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Payment Mode <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online / UPI">Online / UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Status <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                      <option value="OVERDUE">Overdue</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Target Audience <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      value={targetTrack}
                      onChange={e => setTargetTrack(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      required
                    >
                      <option value="" disabled>Select Target Audience</option>
                      {tracks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === "Student Info" && (
              <div className="flex flex-col gap-4">
                {!studentId ? (
                  <div className="py-8 text-center bg-surface-2 rounded-lg border border-border-soft">
                    <User className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-text-muted">Select a student in the Payment Details tab to view their information here.</p>
                  </div>
                ) : (
                  (() => {
                    const s = students.find(x => x.id === studentId);
                    if (!s) return null;
                    return (
                      <div className="bg-surface-2 p-6 rounded-lg border border-border-soft">
                        <h3 className="text-sm font-bold text-text-primary mb-4 border-b border-border-soft pb-2">Student Profile</h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Full Name</p>
                            <p className="font-semibold text-text-primary">{s.user?.firstName} {s.user?.lastName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Admission No</p>
                            <p className="font-semibold text-text-primary">{s.admissionNo || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Parent Name</p>
                            <p className="font-semibold text-text-primary">{s.parentName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Contact Number</p>
                            <p className="font-semibold text-text-primary">{s.parentPhone || s.user?.phone || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase font-bold text-text-muted mb-1">Address</p>
                            <p className="font-semibold text-text-primary">{s.address || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {activeTab === "Remarks" && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">
                    Internal Remarks (Optional)
                  </label>
                  <textarea 
                    className="w-full rounded-lg border border-border-soft bg-surface-2 p-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    rows={5}
                    placeholder="Add any notes about this fee payment (e.g. cheque number, late fee waiver reason)..."
                  ></textarea>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
                  <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>These remarks are stored locally for internal administrative use only. They will not appear on the student's final printed receipt.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-4 shrink-0 bg-white">
          <button onClick={onClose} className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading || !studentId || !amount}
            className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> {loading ? "Saving..." : "Record Payment"}
          </button>
        </div>

      </div>
    </div>
  );
}

function PrintReceiptModal({ receipt, onClose }: { receipt: FeeRecord, onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 print:p-0 print:bg-white print:backdrop-blur-none">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:rounded-none">
        
        {/* Modal Header - Hidden on Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0 print:hidden">
          <h2 className="text-base font-bold text-text-primary">Print Receipt</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-8 print:p-4 text-text-primary">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-brand-blue pb-6 mb-6">
            <div className="flex items-center gap-4">
              <img src="/logo2.png" alt="Educare Logo" className="h-16 w-auto object-contain" />
              <div>
                <h1 className="text-3xl font-black tracking-tight text-brand-blue uppercase">Educare</h1>
                <p className="text-xs font-medium text-text-secondary mt-1">{receipt.centreName || "Kalathipady, North Wing"}</p>
                {receipt.centreAddress && (
                  <p className="text-xs font-medium text-text-secondary">{receipt.centreAddress}</p>
                )}
                <p className="text-xs font-medium text-text-secondary">contact@educare.edu | +91 99999 99999</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold uppercase tracking-wider text-text-muted">Fee Receipt</h2>
              <p className="text-sm font-bold mt-2">No: <span className="text-brand-blue">{receipt.receiptNo}</span></p>
              <p className="text-xs font-medium text-text-secondary mt-1">Date: {receipt.date}</p>
            </div>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold text-text-muted uppercase mb-1">Received From</p>
              <p className="text-base font-bold">{receipt.studentName}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-text-muted uppercase mb-1">Course / Batch</p>
              <p className="text-base font-bold">{receipt.course}</p>
            </div>
          </div>

          {/* Payment Details Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-text-primary">
                <th className="py-2 text-left text-sm font-bold uppercase">Description</th>
                <th className="py-2 text-right text-sm font-bold uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-soft">
                <td className="py-4">
                  <p className="font-bold">Fee Payment</p>
                  <p className="text-xs text-text-secondary mt-1">Paid via {receipt.paymentMode}</p>
                </td>
                <td className="py-4 text-right font-bold">
                  ₹{receipt.amount.toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-border-soft">
                <td className="py-4 text-right font-bold uppercase text-text-muted">Total Paid</td>
                <td className="py-4 text-right font-black text-lg">₹{receipt.amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Footer / Signature */}
          <div className="flex justify-between items-end mt-16 pt-8">
            <div>
              <p className="text-xs italic text-text-secondary">This is a computer-generated receipt and does not require a physical signature.</p>
            </div>
            <div className="text-center">
              <div className="border-t border-text-primary w-40 mb-2"></div>
              <p className="text-xs font-bold uppercase">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Modal Footer - Hidden on Print */}
        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-4 shrink-0 bg-surface-2 print:hidden">
          <button onClick={onClose} className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            Close
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-blue-dark transition-colors">
            <Download className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>

      </div>
    </div>
  );
}

function DeleteRecordModal({ id, onClose, onSuccess }: { id: string, onClose: () => void, onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (password !== "delete123") {
      setError("Incorrect password.");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      await fetchApi(`/fee/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Failed to delete record");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-brand-red">Delete Fee Record</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 bg-surface text-text-primary">
          <p className="text-sm font-medium text-text-secondary mb-4">
            Are you sure you want to delete this fee record? This action cannot be undone. Please enter the deletion password to confirm.
          </p>
          
          <div className="mb-4">
            <label className="block text-xs font-bold text-text-secondary mb-1.5">
              Password <span className="text-brand-red">*</span>
            </label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password..." 
              className="w-full h-10 rounded-lg border border-border-soft bg-white pl-3 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red" 
            />
            {error && <p className="text-xs font-bold text-brand-red mt-1.5">{error}</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-3 shrink-0 bg-white">
          <button onClick={onClose} className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleDelete}
            disabled={loading || !password}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-red/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>

      </div>
    </div>
  );
}
