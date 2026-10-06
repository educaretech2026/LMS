"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { BarChart3, Download, FileText, Loader2, IndianRupee, Users, Percent, Search } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("FINANCE");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // New Student Search State
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [singleStudentData, setSingleStudentData] = useState<any>(null);

  useEffect(() => {
    fetchApi("/setup/batches").then(b => setBatches(Array.isArray(b) ? b : [])).catch(() => {});
  }, []);


  const generateReport = async () => {
    setLoading(true);
    setData(null);
    setSingleStudentData(null);
    setSearchResults([]);
    try {
      let endpoint = "";
      if (reportType === "FINANCE") endpoint = `/report/finance?startDate=${startDate}&endDate=${endDate}`;
      if (reportType === "FEES") endpoint = `/report/fees?startDate=${startDate}&endDate=${endDate}`;
      if (reportType === "ENQUIRIES") endpoint = `/report/enquiries?startDate=${startDate}&endDate=${endDate}`;
      if (reportType === "PERFORMANCE") endpoint = `/report/performance?batchId=${batchId}`;

      const res = await fetchApi(endpoint);
      setData(res);
    } catch (e) {
      console.error(e);
      alert("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const renderFinanceReport = () => {
    if (!data) return null;
    const expenseTotal = data.transactions.filter((t: any) => t.type === 'EXPENSE').reduce((sum: number, t: any) => sum + t.amount, 0);
    const adhocIncome = data.transactions.filter((t: any) => t.type === 'INCOME').reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalIncome = adhocIncome + data.feeTotal;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <p className="text-[11px] font-bold text-green-700 uppercase">Total Income</p>
            <p className="text-2xl font-black text-green-700 mt-1 flex items-center"><IndianRupee className="h-5 w-5" />{totalIncome.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-green-600 mt-1">Fees: ₹{data.feeTotal} | Ad-hoc: ₹{adhocIncome}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <p className="text-[11px] font-bold text-red-700 uppercase">Total Expense</p>
            <p className="text-2xl font-black text-red-700 mt-1 flex items-center"><IndianRupee className="h-5 w-5" />{expenseTotal.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-brand-blue/5 rounded-xl p-4 border border-brand-blue/10">
            <p className="text-[11px] font-bold text-brand-blue uppercase">Net Profit</p>
            <p className="text-2xl font-black text-brand-blue mt-1 flex items-center"><IndianRupee className="h-5 w-5" />{(totalIncome - expenseTotal).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="overflow-auto border border-border-soft rounded-lg max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-surface sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-[11px] font-bold text-text-muted">Date</th>
                <th className="text-left px-4 py-2 text-[11px] font-bold text-text-muted">Type</th>
                <th className="text-left px-4 py-2 text-[11px] font-bold text-text-muted">Category</th>
                <th className="text-right px-4 py-2 text-[11px] font-bold text-text-muted">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {data.transactions.map((t: any) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-xs">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs font-bold" style={{ color: t.type === 'INCOME' ? 'green' : 'red' }}>{t.type}</td>
                  <td className="px-4 py-2 text-xs">{t.category}</td>
                  <td className="px-4 py-2 text-xs text-right font-bold">₹{t.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderEnquiriesReport = () => {
    if (!data) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface rounded-xl p-4 border border-border-soft text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase">Total Enquiries</p>
            <p className="text-3xl font-black text-text-primary mt-1">{data.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center">
            <p className="text-[11px] font-bold text-green-700 uppercase">Converted</p>
            <p className="text-3xl font-black text-green-700 mt-1">{data.counts.CONVERTED}</p>
          </div>
          <div className="bg-brand-blue/5 rounded-xl p-4 border border-brand-blue/10 text-center">
            <p className="text-[11px] font-bold text-brand-blue uppercase">Conversion Rate</p>
            <p className="text-3xl font-black text-brand-blue mt-1 flex items-center justify-center gap-1">{data.conversionRate.toFixed(1)} <Percent className="h-6 w-6" /></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-border-soft">
          <h4 className="text-sm font-bold mb-4">Lead Funnel</h4>
          <div className="space-y-3">
            {Object.entries(data.counts).map(([status, count]: any) => (
              <div key={status} className="flex items-center gap-4">
                <div className="w-24 text-xs font-bold text-text-secondary">{status}</div>
                <div className="flex-1 h-4 bg-surface rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-blue" 
                    style={{ width: `${data.total ? (count / data.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-10 text-xs font-bold text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleStudentSearch = async () => {
    if (!studentSearch || studentSearch.length < 2) return;
    setSearchingStudent(true);
    setSearchResults([]);
    setData(null);
    setSingleStudentData(null);
    try {
      const res = await fetchApi(`/students/search?q=${studentSearch}`);
      setSearchResults(Array.isArray(res) ? res : []);
    } catch (e) {
      alert("Error searching students");
    } finally {
      setSearchingStudent(false);
    }
  };

  const loadSingleStudentReport = async (stdId: string) => {
    setLoading(true);
    setSingleStudentData(null);
    setSearchResults([]);
    try {
      const res = await fetchApi(`/report/student-performance/${stdId}`);
      setSingleStudentData(res);
    } catch (e) {
      alert("Error loading student report");
    } finally {
      setLoading(false);
    }
  };

  const renderPerformanceReport = () => {
    if (singleStudentData) {
      const s = singleStudentData;
      const percentage = parseFloat(s.attendanceDetails.percentage);
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border-soft p-6 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center gap-4 border-b border-border-soft pb-4 mb-4">
              <div className="h-16 w-16 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue font-black text-2xl">
                {s.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-black text-text-primary">{s.name}</h3>
                <p className="text-sm text-text-secondary font-bold">Admission No: {s.admissionNo}</p>
              </div>
            </div>
            
            <h4 className="text-sm font-bold text-text-primary mb-3">Attendance Overview</h4>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="bg-surface rounded-lg p-4">
                <p className="text-[10px] font-bold text-text-muted uppercase">Total Classes</p>
                <p className="text-2xl font-black mt-1">{s.attendanceDetails.totalDays}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-green-700">
                <p className="text-[10px] font-bold uppercase">Classes Attended</p>
                <p className="text-2xl font-black mt-1">{s.attendanceDetails.presentDays}</p>
              </div>
              <div className={`rounded-lg p-4 ${percentage >= 75 ? 'bg-brand-blue/10 text-brand-blue' : 'bg-red-50 text-red-700'}`}>
                <p className="text-[10px] font-bold uppercase">Attendance %</p>
                <p className="text-2xl font-black mt-1">{percentage}%</p>
              </div>
            </div>

            <h4 className="text-sm font-bold text-text-primary mb-3">Exam Results</h4>
            {s.examResults && s.examResults.length > 0 ? (
              <div className="overflow-x-auto border border-border-soft rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-text-muted uppercase">Exam</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-text-muted uppercase">Marks</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-text-muted uppercase">Grade</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-text-muted uppercase">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {s.examResults.map((r: any) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-bold text-text-primary">{r.exam?.title}</td>
                        <td className="px-4 py-3 text-center">{r.marksObtained} / {r.maxMarks}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-black text-xs">{r.grade || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">{r.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-muted bg-surface p-4 rounded-lg text-center font-medium">No exam results available.</p>
            )}
          </div>
        </div>
      );
    }

    if (searchResults && searchResults.length > 0) {
      return (
        <div className="bg-white rounded-xl border border-border-soft p-4 shadow-sm max-w-2xl mx-auto">
          <h4 className="text-sm font-bold mb-4">Search Results</h4>
          <div className="space-y-2">
            {searchResults.map(s => (
              <div key={s.id} onClick={() => loadSingleStudentReport(s.id)} className="flex items-center justify-between p-3 rounded-lg border border-border-soft hover:border-brand-blue hover:bg-brand-blue/5 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-surface rounded-full flex items-center justify-center text-text-muted font-bold">
                    {s.user.firstName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-text-primary group-hover:text-brand-blue transition-colors">{s.user.firstName} {s.user.lastName}</p>
                    <p className="text-xs text-text-muted">{s.admissionNo}</p>
                  </div>
                </div>
                <div className="text-xs font-bold text-brand-blue px-3 py-1.5 bg-brand-blue/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  View Report
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!data || data.length === 0) return <p className="text-center text-text-muted py-10">Select a batch and generate to view batch-wide attendance, or search for a specific student.</p>;

    return (
      <div className="overflow-auto border border-border-soft rounded-lg max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="bg-surface sticky top-0">
            <tr>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted">Student Name</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted">Admission No</th>
              <th className="text-center px-5 py-3 text-[11px] font-bold text-text-muted">Total Days</th>
              <th className="text-center px-5 py-3 text-[11px] font-bold text-text-muted">Present</th>
              <th className="text-right px-5 py-3 text-[11px] font-bold text-text-muted">Attendance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {data.map((s: any) => (
              <tr key={s.studentId}>
                <td className="px-5 py-3 font-bold text-text-primary">{s.name}</td>
                <td className="px-5 py-3 text-xs text-text-secondary">{s.admissionNo}</td>
                <td className="px-5 py-3 text-center">{s.attendanceDetails.totalDays}</td>
                <td className="px-5 py-3 text-center">{s.attendanceDetails.presentDays}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    parseFloat(s.attendanceDetails.percentage) >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {s.attendanceDetails.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <DashboardLayout title="Reports & Analytics">
      <PageShell
        title="Reports & Analytics"
        subtitle="Generate comprehensive insights on academics, financials, and CRM."
        icon={BarChart3}
        accentColor="blue"
      >
        <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
          {/* Report Configuration */}
          <div className="flex flex-wrap items-end gap-4 pb-6 border-b border-border-soft mb-6">
            <div className="w-64">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Select Report Type</label>
              <select 
                value={reportType}
                onChange={e => {
                  setReportType(e.target.value);
                  setData(null);
                  setSingleStudentData(null);
                  setSearchResults([]);
                }}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="FINANCE">Finance (Income vs Expense)</option>
                <option value="ENQUIRIES">Enquiries / CRM Conversion</option>
                <option value="PERFORMANCE">Student Attendance & Performance</option>
              </select>
            </div>

            {reportType === "PERFORMANCE" ? (
              <div className="flex gap-4">
                <div className="w-56">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Search Student</label>
                  <div className="flex">
                    <input 
                      type="text"
                      placeholder="Name or Admission No"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleStudentSearch()}
                      className="w-full h-10 rounded-l-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20 outline-none"
                    />
                    <button 
                      onClick={handleStudentSearch}
                      disabled={searchingStudent}
                      className="h-10 px-3 bg-surface border border-l-0 border-border-soft rounded-r-lg hover:bg-surface-2 transition-colors flex items-center justify-center"
                    >
                      {searchingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center text-text-muted font-bold text-xs uppercase px-2">OR</div>
                <div className="w-56">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Select Batch</label>
                  <select 
                    value={batchId}
                    onChange={e => setBatchId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
                  >
                    <option value="">All Batches</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20" />
                </div>
              </>
            )}

            <button 
              onClick={generateReport}
              disabled={loading}
              className="h-10 px-6 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Generate</>}
            </button>

            {data && (
               <button className="h-10 px-4 flex items-center justify-center gap-2 rounded-lg bg-surface border border-border-soft text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-surface-2 ml-auto">
                 <Download className="h-4 w-4" /> Export CSV
               </button>
            )}
          </div>

          {/* Report Viewer */}
          <div className="min-h-[400px]">
            {!data && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-text-muted pt-16">
                <FileText className="h-16 w-16 opacity-20 mb-4" />
                <p>Select parameters and generate a report</p>
              </div>
            )}
            
            {loading && (
               <div className="h-full flex items-center justify-center pt-20">
                 <Loader2 className="h-10 w-10 animate-spin text-brand-blue" />
               </div>
            )}

            {!loading && data && (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                {reportType === "FINANCE" && renderFinanceReport()}
                {reportType === "ENQUIRIES" && renderEnquiriesReport()}
                {reportType === "PERFORMANCE" && renderPerformanceReport()}
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
