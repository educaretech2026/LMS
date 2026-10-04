"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ExamTabs } from "@/components/exam/exam-tabs";
import { Trophy, Plus, TrendingUp, Users, CheckCircle2, Database, Layers, FileText } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";

export default function ExamOverviewPage() {
  const { role } = useAuth();
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
                { label: "Total Questions", value: "0",  icon: Database,    color: "text-brand-blue bg-brand-blue/8" },
                { label: "Active Exams",    value: "0",  icon: Layers,      color: "text-brand-red  bg-brand-red/8"  },
                { label: "Students Tested", value: "0",  icon: Users,       color: "text-success    bg-success/8"    },
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
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-sm text-text-muted">No exams created yet.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <StudentExamsList />
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

function StudentExamsList() {
  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden p-10 text-center">
      <Layers className="h-10 w-10 text-text-muted mx-auto mb-3" />
      <h3 className="text-sm font-semibold text-text-primary">No Upcoming Exams</h3>
      <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
        Your assigned exams will appear here when they are scheduled by your teachers.
      </p>
    </div>
  );
}
