"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExamTabs } from "@/components/exam/exam-tabs";
import { Trophy, TrendingUp, Users, CheckCircle2, Search, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchApi<any[]>('/exams/analytics/results')
      .then((data) => {
        setResults(data || []);
      })
      .catch((err) => {
        console.error("Failed to load results:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const totalAttempts = results.length;
  const avgPct = totalAttempts > 0
    ? Math.round(
        results.reduce((acc, r) => {
          const max = r.maxMarks || 1;
          return acc + (r.marksObtained / max) * 100;
        }, 0) / totalAttempts
      )
    : 0;

  const passedCount = results.filter((r) => {
    const max = r.maxMarks || 1;
    return (r.marksObtained / max) * 100 >= 40;
  }).length;

  const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;

  const topScorePct = totalAttempts > 0
    ? Math.round(
        Math.max(
          ...results.map((r) => {
            const max = r.maxMarks || 1;
            return (r.marksObtained / max) * 100;
          })
        )
      )
    : 0;

  const getStudentName = (r: any) => {
    if (!r.student?.user) return "Student";
    const fullName = `${r.student.user.firstName || ''} ${r.student.user.lastName || ''}`.trim();
    return fullName || r.student.user.email || "Student";
  };

  const filteredResults = results.filter((r) => {
    const studentName = getStudentName(r).toLowerCase();
    const examTitle = (r.exam?.title || "").toLowerCase();
    const query = search.toLowerCase();
    return studentName.includes(query) || examTitle.includes(query);
  });

  return (
    <DashboardLayout title="Results">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-border-soft bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/8 flex items-center justify-center">
              <Trophy className="h-4.5 w-4.5 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Results & Analytics</h2>
              <p className="text-xs text-text-muted mt-0.5">View scores, pass rates and student performance</p>
            </div>
          </div>
        </div>
        <ExamTabs />
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Attempts",  value: totalAttempts.toString(), icon: Users,        color: "text-brand-blue bg-brand-blue/8" },
              { label: "Average Score",   value: `${avgPct}%`,               icon: TrendingUp,  color: "text-warning    bg-warning/8"    },
              { label: "Pass Rate",       value: `${passRate}%`,             icon: CheckCircle2, color: "text-success bg-success/8" },
              { label: "Top Score",       value: `${topScorePct}%`,          icon: Trophy,      color: "text-warning    bg-warning/8"    },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color} mb-3`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
                <p className="text-[11px] font-medium text-text-muted mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border-soft flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-text-primary">All Results</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Filter student or exam..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border-soft focus:outline-none focus:border-brand-blue"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Student</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Exam</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Percentage</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Grade</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-sm text-text-muted">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand-blue" />
                      Loading examination results...
                    </td>
                  </tr>
                ) : filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-sm text-text-muted">
                      No results found.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r, idx) => {
                    const studentName = getStudentName(r);
                    const examTitle = r.exam?.title || "Exam";
                    const max = r.maxMarks || 1;
                    const pct = Math.round((r.marksObtained / max) * 100);
                    const isPassed = pct >= 40;
                    const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-";

                    return (
                      <tr key={r.id || idx} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3.5 text-xs text-text-muted">{idx + 1}</td>
                        <td className="px-5 py-3.5 text-sm font-medium text-text-primary">{studentName}</td>
                        <td className="px-5 py-3.5 text-xs text-text-secondary">{examTitle}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-text-primary">{r.marksObtained} / {r.maxMarks}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-surface-2 overflow-hidden">
                              <div className={`h-full rounded-full ${isPassed ? "bg-success" : "bg-brand-red"}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-text-primary">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-surface-2 text-text-primary">
                            {r.grade || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${isPassed ? "bg-success/8 text-success border-success/20" : "bg-brand-red/8 text-brand-red border-brand-red/20"}`}>
                            {isPassed ? "Passed" : "Failed"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-text-muted">{dateStr}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/exam/${r.examId}/results`}
                            className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline font-medium"
                          >
                            Breakdown <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
