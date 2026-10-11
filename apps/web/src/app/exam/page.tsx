"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExamTabs } from "@/components/exam/exam-tabs";
import { Trophy, Plus, TrendingUp, Users, CheckCircle2, Database, Layers, FileText } from "lucide-react";
import Link from "next/link";
import React from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
export default function ExamOverviewPage() {
  const { role } = useAuth();
    const [exams, setExams] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({ totalQuestions: 0, activeExams: 0, studentsTested: 0 });

  React.useEffect(() => {
    fetchApi('/exams').then((data: any) => {
      setExams(data || []);
      const activeCount = (data || []).length;
      setStats(prev => ({ ...prev, activeExams: activeCount }));
    }).catch(console.error);

    if (role && role.toUpperCase() !== 'STUDENT') {
      fetchApi('/exams/mcq').then((data: any) => {
        setStats(prev => ({ ...prev, totalQuestions: (data || []).length }));
      }).catch(console.error);
    }
  }, [role]);

  return (
    <DashboardLayout title="Exam">
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-border-soft bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-blue/8 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-brand-blue" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Examination</h2>
              <p className="text-xs text-text-muted mt-0.5">Manage question banks, MCQ exams, mock tests and results</p>
            </div>
          </div>
          {role?.toUpperCase() !== 'STUDENT' && (
            <Link
              href="/exam/mcq/create"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create Exam
            </Link>
          )}
        </div>

        {role?.toUpperCase() !== 'STUDENT' && <ExamTabs />}

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">

          {/* Stats */}
          {role?.toUpperCase() !== 'STUDENT' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Questions", value: stats.totalQuestions.toString(),  icon: Database,    color: "text-brand-blue bg-brand-blue/8" },
                { label: "Active Exams",    value: stats.activeExams.toString(),  icon: Layers,      color: "text-brand-red  bg-brand-red/8"  },
                { label: "Students Tested", value: stats.studentsTested.toString(),  icon: Users,       color: "text-success    bg-success/8"    },
                { label: "Avg. Score",      value: "—",  icon: TrendingUp,  color: "text-warning    bg-warning/8"    },
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
          )}

          {role?.toUpperCase() !== 'STUDENT' ? (
            <>
              {/* Quick Access */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Quick Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <QuickCard
                    href="/exam/questions"
                    icon={Database}
                    title="Question Bank"
                    desc="Add and manage MCQ questions grouped by subject and topic."
                    color="blue"
                  />
                  <QuickCard
                    href="/exam/mcq"
                    icon={Layers}
                    title="MCQ Exams"
                    desc="Create timed MCQ examinations and assign them to student batches."
                    color="red"
                  />
                  <QuickCard
                    href="/exam/mock"
                    icon={CheckCircle2}
                    title="Mock Tests"
                    desc="Set up practice tests with instant feedback and explanations."
                    color="green"
                  />
                </div>
              </div>

              {/* Recent Exams */}
              <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border-soft">
                  <h3 className="text-sm font-semibold text-text-primary">Recent Exams</h3>
                  <Link href="/exam/mcq" className="text-xs font-medium text-brand-blue hover:underline">View all</Link>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2">
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Exam Name</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Subject</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Questions</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Duration</th>
                      <th className="text-left px-5 py-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-sm text-text-muted">No exams created yet.</td>
                      </tr>
                    ) : (
                      exams.slice(0, 5).map(exam => (
                        <tr key={exam.id} className="border-t border-border-soft">
                          <td className="px-5 py-4 font-medium text-text-primary">{exam.title}</td>
                          <td className="px-5 py-4 text-text-secondary">{exam.subject?.name || '-'}</td>
                          <td className="px-5 py-4 text-text-secondary">{exam.mcqQuestions?.length || 0}</td>
                          <td className="px-5 py-4 text-text-secondary">60 mins</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold bg-success/10 border-success/20 text-success">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <StudentExamsList exams={exams} />
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickCard({ href, icon: Icon, title, desc, color }: { href: string; icon: React.ElementType; title: string; desc: string; color: "blue"|"red"|"green" }) {
  const cls = {
    blue:  "text-brand-blue bg-brand-blue/8",
    red:   "text-brand-red  bg-brand-red/8",
    green: "text-success    bg-success/8",
  }[color];
  return (
    <Link href={href} className="bg-white rounded-xl border border-border-soft p-5 shadow-sm hover:shadow-md transition-all group block">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cls} mb-4`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-text-primary group-hover:text-brand-blue transition-colors">{title}</p>
      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{desc}</p>
      <p className="mt-4 text-xs font-semibold text-brand-blue">Go to {title} →</p>
    </Link>
  );
}

function StudentExamsList({ exams }: { exams: any[] }) {
  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden p-10 text-center">
        <Layers className="h-10 w-10 text-text-muted mx-auto mb-3 opacity-40" />
        <h3 className="text-sm font-semibold text-text-primary">No Upcoming Exams</h3>
        <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
          Your assigned exams will appear here when they are scheduled by your teachers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Assigned Examinations</h3>
        <span className="text-xs text-text-muted">{exams.length} exams available</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map((exam) => {
          const subjectName = typeof exam.subject === 'object' ? exam.subject?.name : (exam.subject || 'General');
          const qCount = exam.mcqQuestions?.length ?? exam.questions ?? 0;
          const hasTaken = exam.results && exam.results.length > 0;
          const score = hasTaken ? exam.results[0].marksObtained : null;
          const maxMarks = hasTaken ? exam.results[0].maxMarks : null;

          return (
            <div key={exam.id} className="bg-white rounded-xl border border-border-soft shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">
                      {subjectName}
                    </span>
                    <h4 className="text-base font-semibold text-text-primary mt-1.5">{exam.title}</h4>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${hasTaken ? "bg-success/10 border-success/20 text-success" : "bg-brand-blue/10 border-brand-blue/20 text-brand-blue"}`}>
                    {hasTaken ? "Completed" : "Available"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted mt-3 mb-5">
                  <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{qCount} questions</span>
                  <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{exam.type || 'MCQ'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border-soft flex items-center justify-between">
                {hasTaken ? (
                  <>
                    <span className="text-xs font-bold text-success">
                      Score: {score} / {maxMarks}
                    </span>
                    <Link
                      href={`/exam/mcq/${exam.id}/take`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 transition-colors"
                    >
                      Review
                    </Link>
                  </>
                ) : (
                  <Link
                    href={`/exam/mcq/${exam.id}/take`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
                  >
                    Start Exam →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
