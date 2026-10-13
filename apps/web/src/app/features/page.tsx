"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Users,
  BarChart3,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  Star,
  ArrowRight,
  GraduationCap,
  Building2,
  CalendarCheck,
  IndianRupee,
  MessageSquare,
  Video,
  Award,
  Layers,
  Database,
  Cloud,
  Lock,
  Cpu,
  Sparkles,
  ChevronDown,
  FileText,
  Bell,
  Search,
  PieChart,
  ClipboardList,
  UserCheck,
  Trophy,
  Brain,
  Rocket,
  Code2,
} from "lucide-react";

// ── Intersection Observer Hook ──────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Animated Counter ────────────────────────────────────────────
function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, inView } = useInView(0.5);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / 60;
    const t = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [inView, to]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── Feature Card ────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  description,
  tags,
  accentColor,
  delay = 0,
}: {
  icon: any;
  title: string;
  description: string;
  tags: string[];
  accentColor: string;
  delay?: number;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
      className="group relative bg-white rounded-2xl border border-[#E8E8E4] p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      {/* subtle background gradient on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at top left, ${accentColor}08 0%, transparent 70%)`,
        }}
      />
      <div className="relative z-10">
        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
          style={{ background: `${accentColor}15` }}
        >
          <Icon className="h-5.5 w-5.5" style={{ color: accentColor }} />
        </div>
        <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-[#5A5A72] leading-relaxed mb-4">{description}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
              style={{ background: `${accentColor}12`, color: accentColor }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section Heading ─────────────────────────────────────────────
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centered = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`${centered ? "text-center" : ""} mb-12`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      <p className="inline-block text-[11px] font-black uppercase tracking-[0.18em] text-[#0162b1] bg-[#0162b1]/8 px-3 py-1.5 rounded-full mb-4">
        {eyebrow}
      </p>
      <h2 className="text-3xl sm:text-4xl font-black text-[#1A1A2E] tracking-tight leading-tight mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base sm:text-lg text-[#5A5A72] max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Main Module Data ─────────────────────────────────────────────
const modules = [
  {
    icon: Brain,
    title: "Examination & Assessment Engine",
    description:
      "Full-featured MCQ examinations with custom positive/negative marking, image-enriched questions, timed attempts, real-time grading, and detailed scorecard analytics.",
    tags: ["MCQ Tests", "Auto Grading", "Live Timers", "Grade Analytics"],
    accentColor: "#7c3aed",
  },
  {
    icon: Users,
    title: "User, Role & Identity Management",
    description:
      "Strict RBAC across Super Admin, Centre Admin, Teacher, and Student roles. JWT authentication with Redis-backed session enforcement and active session invalidation.",
    tags: ["RBAC", "JWT Auth", "Redis Sessions", "Multi-Role"],
    accentColor: "#0162b1",
  },
  {
    icon: Building2,
    title: "Academic Hierarchy & Setup",
    description:
      "Complete multi-tier institutional configuration: Academic Years, Multi-Campus Centres, Boards, Classes, Batches, Subjects, Chapters, Topics, and Competitive Tracks.",
    tags: ["Multi-Campus", "Hierarchical", "Boards & Batches", "Track System"],
    accentColor: "#059669",
  },
  {
    icon: BookOpen,
    title: "E-Study & Content Management",
    description:
      "Digital study material distribution mapped to chapters and topics, video lecture embedding with dedicated player, progress tracking, and topic-level quiz assessments.",
    tags: ["PDF Materials", "Video Lectures", "Progress Tracking", "Topic Quizzes"],
    accentColor: "#d97706",
  },
  {
    icon: CalendarCheck,
    title: "Attendance Management",
    description:
      "Batch-wise daily attendance recording (Present, Absent, Late, Excused) for students and staff. Percentage reporting, historical logs, and at-risk student detection.",
    tags: ["Daily Records", "Staff Attendance", "At-Risk Alerts", "History Logs"],
    accentColor: "#0891b2",
  },
  {
    icon: IndianRupee,
    title: "Fee & Financial Management",
    description:
      "Customizable fee structures, scholarship allocations, installment scheduling, payment collection recording, outstanding dues tracking, and automated receipt generation.",
    tags: ["Fee Engine", "Scholarships", "Installments", "Receipt Gen"],
    accentColor: "#16a34a",
  },
  {
    icon: ClipboardList,
    title: "Dynamic Form Builder & Admissions",
    description:
      "No-code drag-and-drop form builder, public form sharing URLs, lead tracking, counselor assignment, follow-up management, and seamless enrollment conversion pipeline.",
    tags: ["Form Builder", "CRM", "Lead Tracking", "Admissions"],
    accentColor: "#dc2626",
  },
  {
    icon: Bell,
    title: "Communications & Notifications",
    description:
      "Real-time in-app notification drawer, campus-wide notice board with scheduling, and bulk SMS gateway with parent alert logs and reusable message templates.",
    tags: ["Real-Time Alerts", "Notice Board", "Bulk SMS", "SMS Templates"],
    accentColor: "#7c3aed",
  },
  {
    icon: Video,
    title: "Live Classes & Virtual Classroom",
    description:
      "WebRTC/LiveKit-powered live class scheduling per batch and subject, real-time video, audio, screen sharing, and automated room access token issuance.",
    tags: ["LiveKit", "WebRTC", "Screen Share", "Batch Scheduling"],
    accentColor: "#0162b1",
  },
  {
    icon: Award,
    title: "Certificates & Achievement Records",
    description:
      "Templated certificate generation for course completions and student milestones, with digital ID card generation and QR code verification for every student.",
    tags: ["Cert Generator", "Digital ID Card", "QR Codes", "Achievement"],
    accentColor: "#f59e0b",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics Dashboard",
    description:
      "Executive analytics dashboard with financial ledgers, academic hierarchy exam reports, attendance registers, CRM pipeline funnels, and student performance dossiers.",
    tags: ["KPI Dashboard", "Finance Analytics", "Hierarchy Reports", "CSV Export"],
    accentColor: "#0891b2",
  },
  {
    icon: FileText,
    title: "Support Help Desk",
    description:
      "Internal ticketing system for students, teachers, and administrators. Track, assign, and resolve support queries with full audit trails.",
    tags: ["Ticketing", "Internal Support", "Audit Trail", "Assignment"],
    accentColor: "#64748b",
  },
];

const techStack = [
  { icon: Code2, label: "Next.js 16", sub: "App Router + RSC", color: "#1A1A2E" },
  { icon: Cpu, label: "NestJS API", sub: "TypeScript + Guards", color: "#e0234e" },
  { icon: Database, label: "PostgreSQL", sub: "Prisma ORM", color: "#336791" },
  { icon: Zap, label: "Redis", sub: "Session & Cache", color: "#d82c20" },
  { icon: Cloud, label: "S3 Storage", sub: "MinIO / AWS S3", color: "#ff9900" },
  { icon: Lock, label: "JWT + RBAC", sub: "Strict Auth Guards", color: "#059669" },
];

const stats = [
  { value: 11, suffix: "+", label: "Core Modules", icon: Layers },
  { value: 4, suffix: "", label: "Role Levels", icon: Shield },
  { value: 7, suffix: "", label: "Hierarchy Tiers", icon: Building2 },
  { value: 99, suffix: "%", label: "Uptime SLA", icon: Rocket },
];

// ── PAGE ─────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-inter text-[#1A1A2E]">
      {/* ── Floating Nav ─────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-[#E8E8E4] shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0162b1] to-[#7c3aed] flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-[15px] tracking-tight">
              <span className="text-[#0162b1]">edu</span>care
              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-[#9494A8] align-middle">
                LMS
              </span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {["Modules", "Technology", "Analytics"].map((s) => (
              <a
                key={s}
                href={`#${s.toLowerCase()}`}
                className="text-[13px] font-semibold text-[#5A5A72] hover:text-[#0162b1] transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0162b1] text-white text-[13px] font-bold hover:bg-[#014d8a] transition-colors shadow-md shadow-[#0162b1]/20"
          >
            Sign In <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background decorative gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#0162b1]/6 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#7c3aed]/6 blur-[100px]" />
          <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-[#059669]/5 blur-[80px] -translate-x-1/2" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(#1A1A2E 1px, transparent 1px), linear-gradient(90deg, #1A1A2E 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0162b1]/10 border border-[#0162b1]/20 text-[#0162b1] text-[11px] font-black uppercase tracking-widest mb-8">
            <Sparkles className="h-3 w-3" />
            Comprehensive Learning Management System
            <Sparkles className="h-3 w-3" />
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[#1A1A2E] leading-[1.05] mb-6">
            The Complete Platform{" "}
            <br className="hidden sm:block" />
            <span className="relative inline-block">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#0162b1] via-[#2563eb] to-[#7c3aed]">
                for Education
              </span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-[#0162b1]/15 via-[#2563eb]/10 to-[#7c3aed]/15 blur-sm -z-10" />
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#5A5A72] max-w-3xl mx-auto leading-relaxed mb-10">
            Educare LMS is an enterprise-grade, all-in-one platform built for modern educational institutions.
            Manage exams, attendance, fees, live classes, analytics, and admissions — all from one intelligent dashboard.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#0162b1] to-[#2563eb] text-white font-bold text-[15px] hover:shadow-xl hover:shadow-[#0162b1]/25 hover:-translate-y-0.5 transition-all duration-200"
            >
              Access Platform <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#modules"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white border border-[#E8E8E4] text-[#1A1A2E] font-bold text-[15px] hover:border-[#0162b1]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              Explore Features <ChevronDown className="h-4 w-4 text-[#9494A8]" />
            </a>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="bg-white rounded-2xl border border-[#E8E8E4] p-4 shadow-sm"
                >
                  <Icon className="h-4 w-4 text-[#9494A8] mx-auto mb-1.5" />
                  <p className="text-2xl font-black text-[#1A1A2E] leading-none">
                    <Counter to={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[11px] text-[#9494A8] font-semibold mt-1">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#9494A8]">
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll to explore</span>
          <div className="w-5 h-8 rounded-full border-2 border-[#E8E8E4] flex items-start justify-center pt-1.5">
            <div className="w-1 h-1.5 rounded-full bg-[#9494A8] animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── Feature Highlights Strip ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0162b1] to-[#7c3aed] py-3 overflow-hidden">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
          {[
            "MCQ Examinations",
            "Live Classes",
            "Fee Management",
            "Digital Attendance",
            "E-Study Materials",
            "Analytics Dashboard",
            "CRM & Admissions",
            "SMS Alerts",
            "Certificate Generator",
            "Multi-Campus Support",
            "RBAC Security",
            "Redis Sessions",
            "MCQ Examinations",
            "Live Classes",
            "Fee Management",
            "Digital Attendance",
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-2 text-white/90 text-[12px] font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Modules Grid ─────────────────────────────────────────── */}
      <section id="modules" className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="Complete Module Suite"
          title="Everything Your Institution Needs"
          subtitle="11 deeply integrated modules designed to streamline every academic, administrative, and financial workflow — from enrollment to graduation."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod, i) => (
            <FeatureCard
              key={mod.title}
              icon={mod.icon}
              title={mod.title}
              description={mod.description}
              tags={mod.tags}
              accentColor={mod.accentColor}
              delay={Math.min(i % 3, 2) * 80}
            />
          ))}
        </div>
      </section>

      {/* ── Analytics Spotlight ──────────────────────────────────── */}
      <section id="analytics" className="bg-[#1A1A2E] py-24 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-5%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#0162b1]/20 blur-[120px]" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[#7c3aed]/15 blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: text */}
            <div>
              <p className="inline-block text-[11px] font-black uppercase tracking-[0.18em] text-[#60a5fa] bg-[#60a5fa]/10 px-3 py-1.5 rounded-full mb-5">
                Executive Analytics
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-5">
                Institutional Intelligence{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]">
                  at Your Fingertips
                </span>
              </h2>
              <p className="text-[#94a3b8] text-base leading-relaxed mb-8">
                The executive analytics dashboard gives decision-makers a real-time, 360° view of every dimension of
                institutional performance — from financial cashflow to cohort academic outcomes.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: PieChart,
                    title: "Financial Ledger & Revenue Analytics",
                    desc: "Live fee collection ledger, expense tracking, and net margin visualization with donut charts.",
                  },
                  {
                    icon: Trophy,
                    title: "Academic Hierarchy Exam Reports",
                    desc: "Exam performance sorted by Year → Centre → Class → Subject → Topic with grade spread charts.",
                  },
                  {
                    icon: UserCheck,
                    title: "Attendance Standing Registers",
                    desc: "Centre → Class → Batch → Student registers with at-risk detection and dossier drilldown.",
                  },
                  {
                    icon: Search,
                    title: "Student Performance Dossiers",
                    desc: "Instant student lookup with comprehensive attendance, exam, and fee history in one modal.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#0162b1]/20 border border-[#0162b1]/30 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-[#60a5fa]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-white mb-0.5">{item.title}</p>
                        <p className="text-[12px] text-[#64748b]">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: mock dashboard panel */}
            <div className="relative">
              <div className="bg-[#0f172a] rounded-2xl border border-white/10 p-5 shadow-2xl">
                {/* Tab bar */}
                <div className="flex items-center gap-1 mb-4 border-b border-white/10 pb-3">
                  {["Overview", "Finance", "Academics", "Attendance"].map((t, i) => (
                    <span
                      key={t}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg ${
                        i === 0
                          ? "bg-[#0162b1] text-white"
                          : "text-[#64748b] hover:text-white"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* KPI Cards mock */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {[
                    { label: "Total Revenue", val: "₹12,40,000", color: "#10b981", sub: "Fee: ₹9.8L • Ad-hoc: ₹2.6L" },
                    { label: "Total Expenses", val: "₹4,20,000", color: "#f43f5e", sub: "32 Vouchers logged" },
                    { label: "Attendance Rate", val: "87.3%", color: "#3b82f6", sub: "3,240 sessions held" },
                    { label: "Exam Pass Rate", val: "91.2%", color: "#a78bfa", sub: "Avg: 74.5% cohort" },
                  ].map((k) => (
                    <div key={k.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wide mb-1">{k.label}</p>
                      <p className="text-lg font-black" style={{ color: k.color }}>{k.val}</p>
                      <p className="text-[9px] text-[#475569] mt-0.5">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Donut chart mock */}
                <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="relative w-14 h-14 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="60 40" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#06b6d4" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-60" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f43f5e" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-80" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">Net</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { dot: "#10b981", label: "Fee Collections — 60%" },
                      { dot: "#06b6d4", label: "Ad-hoc Income — 20%" },
                      { dot: "#f43f5e", label: "Expenses — 20%" },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.dot }} />
                        <span className="text-[10px] text-[#94a3b8]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-gradient-to-br from-[#7c3aed] to-[#0162b1] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg">
                LIVE DATA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Technology Stack ─────────────────────────────────────── */}
      <section id="technology" className="max-w-7xl mx-auto px-6 py-24">
        <SectionHeading
          eyebrow="Technology Stack"
          title="Built on Enterprise-Grade Infrastructure"
          subtitle="Every layer of Educare LMS is engineered for performance, security, and scalability — from the React frontend to the Dockerized deployment pipeline."
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {techStack.map(({ icon: Icon, label, sub, color }) => (
            <div
              key={label}
              className="group flex flex-col items-center text-center bg-white rounded-2xl border border-[#E8E8E4] p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300"
                style={{ background: `${color}12` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <p className="text-[13px] font-black text-[#1A1A2E] leading-tight">{label}</p>
              <p className="text-[10px] text-[#9494A8] font-semibold mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Architecture highlights */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Globe,
              title: "Monorepo Architecture",
              desc: "Turborepo-powered monorepo with shared packages for database, config, and types — ensuring consistency across the web and API layers.",
              color: "#0162b1",
            },
            {
              icon: Lock,
              title: "End-to-End Security",
              desc: "JWT access tokens, Redis-backed session enforcement, concurrency control, per-role route guards, and parameterized Prisma queries prevent SQLi and XSS.",
              color: "#dc2626",
            },
            {
              icon: Cloud,
              title: "S3-Compatible Storage",
              desc: "Presigned upload URLs directly to MinIO or AWS S3 for exam images, study materials, expense receipts, and student profile photos — zero bandwidth through the API server.",
              color: "#f59e0b",
            },
            {
              icon: Zap,
              title: "Redis Caching Layer",
              desc: "Session tokens, rate-limit counters, live class states, and notification queues run through Redis for sub-millisecond response on high-frequency operations.",
              color: "#d82c20",
            },
            {
              icon: Database,
              title: "Relational Data Integrity",
              desc: "PostgreSQL with a comprehensive Prisma schema featuring cascading deletes, relational constraints, and indexed queries across all entity relationships.",
              color: "#336791",
            },
            {
              icon: Rocket,
              title: "Coolify & Nixpacks Deploy",
              desc: "Zero-config Nixpacks build pipeline with Coolify orchestration and Docker containerization — deployed and live in minutes with full environment isolation.",
              color: "#7c3aed",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-white rounded-2xl border border-[#E8E8E4] p-5 hover:shadow-md transition-all duration-300">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${item.color}12` }}
                >
                  <Icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <p className="text-[14px] font-bold text-[#1A1A2E] mb-1.5">{item.title}</p>
                <p className="text-[12px] text-[#5A5A72] leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Compliance & Security ────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#F4F4F1] to-[#FAFAF8] py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <SectionHeading
            eyebrow="Security & Compliance"
            title="Institutional-Grade Security Standards"
            subtitle="Role-based access, session security, encrypted tokens, and data integrity controls meet the rigorous standards educational institutions demand."
          />

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {[
              "JWT Access Tokens",
              "Refresh Token Rotation",
              "Redis Single-Session Enforcement",
              "Role-Based Route Guards",
              "Parameterized Queries (No SQLi)",
              "Presigned S3 Uploads",
              "HTTPS-First Architecture",
              "Concurrency Control",
              "Audit Trails",
              "Data Validation Pipes",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-[#E8E8E4] text-[12px] font-semibold text-[#5A5A72] shadow-sm"
              >
                <CheckCircle className="h-3 w-3 text-[#059669]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1A1A2E] py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0162b1]/25 blur-[140px]" />
          <div className="absolute bottom-[-30%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#7c3aed]/20 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-[11px] font-bold uppercase tracking-widest mb-6">
            <Star className="h-3 w-3 text-yellow-400" />
            Ready to Transform Education
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
            Your Institution.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]">
              Fully Empowered.
            </span>
          </h2>
          <p className="text-[#94a3b8] text-base leading-relaxed mb-8">
            Access the complete Educare LMS platform — examinations, analytics, admissions, and everything in between —
            designed to run at institutional scale.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#0162b1] to-[#7c3aed] text-white font-black text-base hover:shadow-2xl hover:shadow-[#0162b1]/30 hover:-translate-y-1 transition-all duration-300"
          >
            Launch Platform <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-[#0f172a] py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0162b1] to-[#7c3aed] flex items-center justify-center">
              <GraduationCap className="h-3 w-3 text-white" />
            </div>
            <span className="text-[13px] font-black text-white">
              <span className="text-[#60a5fa]">edu</span>care LMS
            </span>
          </div>
          <p className="text-[11px] text-[#475569] font-medium">
            Built with Next.js · NestJS · PostgreSQL · Redis
          </p>
          <p className="text-[11px] text-[#475569]">
            © {new Date().getFullYear()} Educare Technologies
          </p>
        </div>
      </footer>

      {/* ── Marquee Animation ────────────────────────────────────── */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
