"use client";

import Link from "next/link";
import {
  Users,
  CalendarCheck,
  BookOpenCheck,
  BookOpen,
  UserCheck,
  UserX,
  ArrowRight,
  GraduationCap,
  FileText,
  Bell,
} from "lucide-react";

export function TeacherDashboard({ user, stats, notices = [] }: { user: any; stats: any; notices?: any[] }) {
  const ds = stats || {};
  const recentNotices = notices.slice(0, 5);
  const batches: any[] = ds.batches || [];
  const subjects: any[] = ds.subjects || [];

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const quickLinks = [
    { label: "Mark Attendance", href: "/attendance", icon: CalendarCheck, color: "blue" },
    { label: "Syllabus Tracker", href: "/syllabus", icon: BookOpenCheck, color: "blue" },
    { label: "eStudy Materials", href: "/estudy", icon: BookOpen, color: "blue" },
    { label: "Exams", href: "/exam", icon: FileText, color: "blue" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">

      {/* Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-blue-dark via-brand-blue to-brand-blue-light p-6 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-full opacity-10">
          <div className="absolute top-0 right-8 w-32 h-32 rounded-full border-[24px] border-white -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full border-[12px] border-white translate-y-1/2" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-brand-red/0 via-brand-red/60 to-brand-red/0" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white font-bold text-lg shadow-inner uppercase">
              {user?.firstName?.charAt(0) || "T"}
            </div>
            <div>
              <p className="text-white/65 text-xs font-medium tracking-wide mb-0.5">Welcome back</p>
              <h2 className="text-white font-semibold text-xl tracking-tight">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-white/55 text-xs mt-0.5">{today}</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold tracking-widest text-white uppercase">
            Teacher
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "My Batches", value: batches.length, icon: GraduationCap, color: "blue" },
          { label: "My Students", value: ds.totalStudents || 0, icon: Users, color: "blue" },
          { label: "Today Present", value: ds.todayPresent || 0, icon: UserCheck, color: "green" },
          { label: "Today Absent", value: ds.todayAbsent || 0, icon: UserX, color: "red" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="relative bg-white rounded-xl border border-border-soft shadow-sm p-5 overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${color === "green" ? "bg-success" : color === "red" ? "bg-brand-red" : "bg-brand-blue"}`} />
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-4 ${color === "green" ? "bg-success/8" : color === "red" ? "bg-brand-red/8" : "bg-brand-blue/8"}`}>
              <Icon className={`h-4 w-4 ${color === "green" ? "text-success" : color === "red" ? "text-brand-red" : "text-brand-blue"}`} />
            </div>
            <p className={`text-2xl font-bold tracking-tight ${color === "green" ? "text-success" : color === "red" ? "text-brand-red" : "text-brand-blue"}`}>{value}</p>
            <p className="text-[11px] font-medium text-text-muted mt-1 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Batches */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand-blue" />
              My Assigned Batches
            </h3>
            <Link href="/attendance" className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1">
              Take Attendance <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border-soft">
            {batches.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No batches assigned yet.</p>
            ) : (
              batches.map((b) => (
                <div key={b.id} className="px-5 py-4 flex items-center justify-between hover:bg-surface-2 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-text-primary">{b.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {b.standard} · {b.board} · {b.centre}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-text-secondary bg-surface-2 border border-border-soft px-2.5 py-1 rounded-full">
                    <Users className="h-3 w-3" />
                    {b.studentCount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border-soft">
              <h3 className="text-sm font-bold text-text-primary">Quick Actions</h3>
            </div>
            <div className="divide-y divide-border-soft">
              {quickLinks.map(({ label, href, icon: Icon }) => (
                <Link key={label} href={href} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-text-muted group-hover:text-brand-blue transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-text-primary group-hover:text-brand-blue transition-colors">{label}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border-soft">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-blue" />
                  My Subjects
                </h3>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {subjects.map((s, i) => (
                  <span key={i} className="inline-flex flex-col px-3 py-1.5 rounded-lg bg-brand-blue/5 border border-brand-blue/15 text-xs">
                    <span className="font-bold text-brand-blue">{s.name}</span>
                    <span className="text-text-muted font-medium">{s.batchName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Notices */}
          <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-blue" />
                Notice Board
              </h3>
            </div>
            {recentNotices.length > 0 ? (
              <div className="divide-y divide-border-soft">
                {recentNotices.map((notice: any) => (
                  <div key={notice.id} className="p-4 hover:bg-surface-2 transition-colors">
                    <h4 className="text-sm font-semibold text-text-primary">{notice.title}</h4>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{notice.content}</p>
                    {notice.imageUrl && (
                      <div className="mt-2 relative h-32 w-full max-w-sm rounded-lg overflow-hidden border border-border-soft">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={notice.imageUrl} alt="Notice Image" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="text-[10px] font-medium text-text-muted mt-1.5">
                      {new Date(notice.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                <Bell className="h-6 w-6 text-text-muted/50" />
                <p className="text-xs font-medium text-text-muted">No new notices.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
