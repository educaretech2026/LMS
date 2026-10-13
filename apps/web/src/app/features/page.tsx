"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Bell,
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
  Search,
  PieChart,
  ClipboardList,
  UserCheck,
  Trophy,
  Brain,
  Rocket,
  Code2,
  Menu,
  X,
} from "lucide-react";

// ── Particle Canvas ────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const particles: {
      x: number; y: number; vx: number; vy: number;
      r: number; alpha: number; color: string;
    }[] = [];
    const colors = ["#0162b1", "#7c3aed", "#059669", "#2563eb", "#a78bfa"];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Typewriter ─────────────────────────────────────────────────────
function Typewriter({ words }: { words: string[] }) {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];
    const delay = deleting ? 50 : charIdx === word.length ? 1800 : 80;
    const t = setTimeout(() => {
      if (!deleting && charIdx < word.length) {
        setDisplay(word.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      } else if (deleting && charIdx > 0) {
        setDisplay(word.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      } else if (!deleting && charIdx === word.length) {
        setDeleting(true);
      } else {
        setDeleting(false);
        setWordIdx((i) => (i + 1) % words.length);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [charIdx, deleting, wordIdx, words]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] via-[#a78bfa] to-[#34d399]">
      {display}
      <span className="animate-pulse text-[#60a5fa]">|</span>
    </span>
  );
}

// ── useInView ──────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
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

// ── AnimatedCounter ────────────────────────────────────────────────
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

// ── 3D Tilt Card ───────────────────────────────────────────────────
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale3d(1.02,1.02,1.02)`;
  }, []);
  const handleLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)";
  }, []);
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{ transition: "transform 0.15s ease-out", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

// ── Magnetic Button ────────────────────────────────────────────────
function MagneticButton({ children, href, primary = false }: { children: React.ReactNode; href: string; primary?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const handleMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) * 0.3;
    const y = (e.clientY - top - height / 2) * 0.3;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0,0)";
  };
  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transition: "transform 0.25s ease-out" }}
      className={`inline-flex items-center gap-2 font-bold rounded-2xl transition-all duration-300 px-8 py-4 text-base ${
        primary
          ? "bg-gradient-to-r from-[#0162b1] via-[#2563eb] to-[#7c3aed] text-white shadow-2xl shadow-[#0162b1]/40 hover:shadow-[#0162b1]/60 hover:-translate-y-0.5"
          : "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </a>
  );
}

// ── Floating Orb ───────────────────────────────────────────────────
function FloatingOrb({ color, size, top, left, delay = 0 }: { color: string; size: number; top: string; left: string; delay?: number }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size, top, left,
        background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        filter: "blur(60px)",
        animation: `orbFloat ${6 + delay}s ease-in-out infinite alternate`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

// ── Animated Section ───────────────────────────────────────────────
function AnimatedSection({ children }: { children: React.ReactNode }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(32px)",
        transition: "opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
}

// ── Stagger Card ───────────────────────────────────────────────────
function StaggerCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView(0.08);
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Module Data ────────────────────────────────────────────────────
const modules = [
  { icon: Brain, title: "Examination & Assessment Engine", description: "Full-featured MCQ examinations with custom positive/negative marking, image-enriched questions, timed attempts, real-time grading, and detailed scorecard analytics.", tags: ["MCQ Tests", "Auto Grading", "Live Timers", "Grade Analytics"], accentColor: "#7c3aed", glow: "rgba(124,58,237,0.3)" },
  { icon: Users, title: "User, Role & Identity Management", description: "Strict RBAC across Super Admin, Centre Admin, Teacher, and Student roles. JWT authentication with Redis-backed session enforcement and active session invalidation.", tags: ["RBAC", "JWT Auth", "Redis Sessions", "Multi-Role"], accentColor: "#0162b1", glow: "rgba(1,98,177,0.3)" },
  { icon: Building2, title: "Academic Hierarchy & Setup", description: "Complete multi-tier institutional configuration: Academic Years, Multi-Campus Centres, Boards, Classes, Batches, Subjects, Chapters, Topics, and Competitive Tracks.", tags: ["Multi-Campus", "Hierarchical", "Boards & Batches", "Track System"], accentColor: "#059669", glow: "rgba(5,150,105,0.3)" },
  { icon: BookOpen, title: "E-Study & Content Management", description: "Digital study material distribution mapped to chapters and topics, video lecture embedding with dedicated player, progress tracking, and topic-level quiz assessments.", tags: ["PDF Materials", "Video Lectures", "Progress Tracking", "Topic Quizzes"], accentColor: "#d97706", glow: "rgba(217,119,6,0.3)" },
  { icon: CalendarCheck, title: "Attendance Management", description: "Batch-wise daily attendance recording (Present, Absent, Late, Excused) for students and staff. Percentage reporting, historical logs, and at-risk student detection.", tags: ["Daily Records", "Staff Attendance", "At-Risk Alerts", "History Logs"], accentColor: "#0891b2", glow: "rgba(8,145,178,0.3)" },
  { icon: IndianRupee, title: "Fee & Financial Management", description: "Customizable fee structures, scholarship allocations, installment scheduling, payment collection recording, outstanding dues tracking, and automated receipt generation.", tags: ["Fee Engine", "Scholarships", "Installments", "Receipt Gen"], accentColor: "#16a34a", glow: "rgba(22,163,74,0.3)" },
  { icon: ClipboardList, title: "Dynamic Form Builder & Admissions", description: "No-code drag-and-drop form builder, public form sharing URLs, lead tracking, counselor assignment, follow-up management, and seamless enrollment conversion pipeline.", tags: ["Form Builder", "CRM", "Lead Tracking", "Admissions"], accentColor: "#dc2626", glow: "rgba(220,38,38,0.3)" },
  { icon: Bell, title: "Communications & Notifications", description: "Real-time in-app notification drawer, campus-wide notice board with scheduling, and bulk SMS gateway with parent alert logs and reusable message templates.", tags: ["Real-Time Alerts", "Notice Board", "Bulk SMS", "SMS Templates"], accentColor: "#7c3aed", glow: "rgba(124,58,237,0.3)" },
  { icon: Video, title: "Live Classes & Virtual Classroom", description: "WebRTC/LiveKit-powered live class scheduling per batch and subject, real-time video, audio, screen sharing, and automated room access token issuance.", tags: ["LiveKit", "WebRTC", "Screen Share", "Batch Scheduling"], accentColor: "#0162b1", glow: "rgba(1,98,177,0.3)" },
  { icon: Award, title: "Certificates & Achievement Records", description: "Templated certificate generation for course completions and student milestones, with digital ID card generation and QR code verification for every student.", tags: ["Cert Generator", "Digital ID Card", "QR Codes", "Achievement"], accentColor: "#f59e0b", glow: "rgba(245,158,11,0.3)" },
  { icon: BarChart3, title: "Reports & Analytics Dashboard", description: "Executive analytics dashboard with financial ledgers, academic hierarchy exam reports, attendance registers, CRM pipeline funnels, and student performance dossiers.", tags: ["KPI Dashboard", "Finance Analytics", "Hierarchy Reports", "CSV Export"], accentColor: "#0891b2", glow: "rgba(8,145,178,0.3)" },
  { icon: FileText, title: "Support Help Desk", description: "Internal ticketing system for students, teachers, and administrators. Track, assign, and resolve support queries with full audit trails.", tags: ["Ticketing", "Internal Support", "Audit Trail", "Assignment"], accentColor: "#64748b", glow: "rgba(100,116,139,0.3)" },
];

const techStack = [
  { icon: Code2, label: "Next.js 16", sub: "App Router + RSC", color: "#e2e8f0" },
  { icon: Cpu, label: "NestJS", sub: "TypeScript + Guards", color: "#e0234e" },
  { icon: Database, label: "PostgreSQL", sub: "Prisma ORM", color: "#336791" },
  { icon: Zap, label: "Redis", sub: "Session & Cache", color: "#d82c20" },
  { icon: Cloud, label: "S3 Storage", sub: "MinIO / AWS S3", color: "#ff9900" },
  { icon: Lock, label: "JWT + RBAC", sub: "Strict Auth Guards", color: "#34d399" },
];

const stats = [
  { value: 11, suffix: "+", label: "Core Modules", icon: Layers, color: "#60a5fa" },
  { value: 4, suffix: "", label: "Role Levels", icon: Shield, color: "#a78bfa" },
  { value: 7, suffix: "", label: "Hierarchy Tiers", icon: Building2, color: "#34d399" },
  { value: 99, suffix: "%", label: "Uptime SLA", icon: Rocket, color: "#fb923c" },
];

const navLinks = ["Modules", "Analytics", "Technology", "Security"];

// ── PAGE ───────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const max = document.body.scrollHeight - window.innerHeight;
      setScrolled(y > 60);
      setScrollProgress(max > 0 ? (y / max) * 100 : 0);
    };
    const handleMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-white overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <div
        className="fixed top-0 left-0 h-[2px] bg-gradient-to-r from-[#0162b1] via-[#a78bfa] to-[#34d399] z-[100] transition-all duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Cursor Glow (desktop only) */}
      <div
        className="fixed pointer-events-none z-40 hidden lg:block"
        style={{
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(1,98,177,0.08) 0%, transparent 70%)",
          transform: `translate(${mousePos.x - 150}px, ${mousePos.y - 150}px)`,
          transition: "transform 0.15s ease-out",
        }}
      />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className={`fixed left-0 right-0 z-50 px-4 transition-all duration-500 ${scrolled ? "top-0" : "top-2"}`}>
        <div className={`max-w-6xl mx-auto h-14 flex items-center justify-between px-5 rounded-2xl transition-all duration-500 ${scrolled ? "bg-[#080f1f]/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40" : "bg-transparent"}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0162b1] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#0162b1]/40">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-[15px] tracking-tight">
              <span className="text-[#60a5fa]">edu</span>care
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30 align-middle">LMS</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} className="text-[13px] font-semibold text-white/50 hover:text-white transition-colors duration-200 relative group">
                {s}
                <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-[#0162b1] to-[#a78bfa] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0162b1] to-[#2563eb] text-white text-[13px] font-bold shadow-lg shadow-[#0162b1]/30 hover:shadow-[#0162b1]/60 hover:-translate-y-0.5 transition-all duration-200">
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className={`md:hidden transition-all duration-300 overflow-hidden ${mobileOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="max-w-6xl mx-auto mt-2 px-5 py-4 bg-[#080f1f]/95 backdrop-blur-xl border border-white/10 rounded-2xl">
            {navLinks.map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} onClick={() => setMobileOpen(false)} className="block py-2.5 text-[14px] font-semibold text-white/60 hover:text-white transition-colors border-b border-white/5 last:border-0">
                {s}
              </a>
            ))}
            <a href="/login" className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#0162b1] to-[#7c3aed] text-white text-[14px] font-bold">
              Sign In <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
        <ParticleCanvas />
        <FloatingOrb color="#0162b1" size={600} top="-10%" left="-10%" delay={0} />
        <FloatingOrb color="#7c3aed" size={500} top="30%" left="60%" delay={2} />
        <FloatingOrb color="#059669" size={400} top="70%" left="20%" delay={4} />
        <FloatingOrb color="#d97706" size={300} top="10%" left="70%" delay={1} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#0162b1]/40 bg-[#0162b1]/10 backdrop-blur-sm text-[11px] font-black uppercase tracking-widest text-[#60a5fa] mb-8" style={{ animation: "fadeSlideDown 0.8s ease both" }}>
            <Sparkles className="h-3 w-3" />
            Enterprise Learning Management System
            <Sparkles className="h-3 w-3" />
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.02] mb-6" style={{ animation: "fadeSlideDown 0.9s 0.1s ease both" }}>
            <span className="text-white">The Complete Platform</span>
            <br />
            <span className="text-white">for </span>
            <Typewriter words={["Education.", "Excellence.", "Growth.", "Institutions."]} />
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10" style={{ animation: "fadeSlideDown 1s 0.2s ease both" }}>
            Educare LMS is an enterprise-grade, all-in-one platform built for modern educational institutions.
            Manage exams, attendance, fees, live classes, analytics, and admissions — all from one intelligent dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16" style={{ animation: "fadeSlideDown 1.1s 0.3s ease both" }}>
            <MagneticButton href="/login" primary>
              Access Platform <ArrowRight className="h-5 w-5" />
            </MagneticButton>
            <MagneticButton href="#modules">
              Explore Features <ChevronDown className="h-5 w-5 text-white/50" />
            </MagneticButton>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto" style={{ animation: "fadeSlideDown 1.2s 0.4s ease both" }}>
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="relative group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" style={{ background: `radial-gradient(circle at center, ${s.color}20 0%, transparent 70%)` }} />
                  <Icon className="h-4 w-4 mx-auto mb-2 relative z-10" style={{ color: s.color }} />
                  <p className="text-2xl font-black leading-none relative z-10" style={{ color: s.color }}>
                    <Counter to={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[10px] text-white/35 font-semibold mt-1 uppercase tracking-wide relative z-10">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-white/40" style={{ animation: "scrollDot 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      </section>

      {/* ── Marquee Strip ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-3">
        <div className="flex items-center gap-8 whitespace-nowrap" style={{ animation: "marquee 30s linear infinite" }}>
          {["MCQ Examinations", "Live Classes", "Fee Management", "Digital Attendance", "E-Study Materials", "Analytics Dashboard", "CRM & Admissions", "Bulk SMS Alerts", "Certificate Generator", "Multi-Campus Support", "RBAC Security", "Redis Sessions", "MCQ Examinations", "Live Classes", "Fee Management", "Digital Attendance"].map((item, i) => (
            <span key={i} className="flex items-center gap-2.5 text-white/30 text-[11px] font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0162b1]/60" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Modules ───────────────────────────────────────────────── */}
      <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-6 py-28">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-[#60a5fa] bg-[#60a5fa]/10 border border-[#60a5fa]/20 px-4 py-2 rounded-full mb-5">Complete Module Suite</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
              Everything Your Institution{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] to-[#a78bfa]">Needs</span>
            </h2>
            <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">
              11 deeply integrated modules designed to streamline every academic, administrative, and financial workflow — from enrollment to graduation.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <StaggerCard key={mod.title} delay={i % 3 * 100}>
                <TiltCard className="h-full">
                  <div className="relative h-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 overflow-hidden group cursor-default hover:border-white/20 transition-all duration-500" style={{ backdropFilter: "blur(10px)" }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" style={{ background: `radial-gradient(ellipse at top left, ${mod.glow} 0%, transparent 60%)` }} />
                    <div className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at top right, ${mod.accentColor}20 0%, transparent 70%)` }} />
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 group-hover:scale-110 transition-transform duration-300" style={{ background: `${mod.accentColor}20`, boxShadow: `0 0 20px ${mod.accentColor}30` }}>
                        <Icon className="h-5 w-5" style={{ color: mod.accentColor }} />
                      </div>
                      <h3 className="text-[15px] font-bold text-white mb-2.5 leading-tight">{mod.title}</h3>
                      <p className="text-[13px] text-white/45 leading-relaxed mb-4">{mod.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.tags.map((tag) => (
                          <span key={tag} className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border" style={{ background: `${mod.accentColor}15`, color: mod.accentColor, borderColor: `${mod.accentColor}30` }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </StaggerCard>
            );
          })}
        </div>
      </section>

      {/* ── Analytics Spotlight ────────────────────────────────────── */}
      <section id="analytics" className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050816] via-[#080f24] to-[#050816]" />
        <FloatingOrb color="#0162b1" size={700} top="-20%" left="-15%" delay={0} />
        <FloatingOrb color="#7c3aed" size={500} top="50%" left="60%" delay={3} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="text-center mb-16">
              <p className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/20 px-4 py-2 rounded-full mb-5">Executive Analytics</p>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
                Institutional Intelligence{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] to-[#60a5fa]">at a Glance</span>
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection>
              <div className="space-y-5">
                {[
                  { icon: PieChart, title: "Financial Ledger & Revenue Analytics", desc: "Live fee collection ledger, expense tracking, and net margin visualization with donut charts.", color: "#34d399" },
                  { icon: Trophy, title: "Academic Hierarchy Exam Reports", desc: "Exam performance sorted by Year → Centre → Class → Subject → Topic with grade spread charts.", color: "#a78bfa" },
                  { icon: UserCheck, title: "Attendance Standing Registers", desc: "Centre → Class → Batch → Student registers with at-risk detection and dossier drilldown.", color: "#60a5fa" },
                  { icon: Search, title: "Student Performance Dossiers", desc: "Instant student lookup with comprehensive attendance, exam, and fee history in one modal.", color: "#fb923c" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <StaggerCard key={item.title} delay={i * 120}>
                      <div className="flex gap-4 group">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ background: `${item.color}20`, boxShadow: `0 0 20px ${item.color}25` }}>
                          <Icon className="h-4 w-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-white mb-1">{item.title}</p>
                          <p className="text-[12px] text-white/35 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </StaggerCard>
                  );
                })}
              </div>
            </AnimatedSection>

            <AnimatedSection>
              <TiltCard>
                <div className="relative bg-[#080f24]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
                  <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 80px rgba(1,98,177,0.15) inset" }} />
                  <div className="flex items-center gap-1 mb-4 border-b border-white/10 pb-3 overflow-x-auto">
                    {["Overview", "Finance", "Academics", "Attendance"].map((t, i) => (
                      <span key={t} className={`text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 cursor-default transition-all ${i === 0 ? "bg-gradient-to-r from-[#0162b1] to-[#2563eb] text-white shadow-lg shadow-[#0162b1]/30" : "text-white/30 hover:text-white/60"}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    {[
                      { label: "Total Revenue", val: "₹12,40,000", color: "#34d399", sub: "Fee: ₹9.8L • Ad-hoc: ₹2.6L" },
                      { label: "Total Expenses", val: "₹4,20,000", color: "#f43f5e", sub: "32 Vouchers logged" },
                      { label: "Attendance Rate", val: "87.3%", color: "#60a5fa", sub: "3,240 sessions held" },
                      { label: "Exam Pass Rate", val: "91.2%", color: "#a78bfa", sub: "Avg: 74.5% cohort" },
                    ].map((k) => (
                      <div key={k.label} className="bg-white/[0.04] rounded-xl p-3 border border-white/5 hover:bg-white/[0.07] transition-colors">
                        <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wide mb-1">{k.label}</p>
                        <p className="text-lg font-black" style={{ color: k.color }}>{k.val}</p>
                        <p className="text-[9px] text-white/20 mt-0.5">{k.sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 bg-white/[0.04] rounded-xl p-3 border border-white/5">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#334155" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray="60 40" strokeLinecap="round" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#06b6d4" strokeWidth="3" strokeDasharray="20 80" strokeDashoffset="-60" strokeLinecap="round" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f43f5e" strokeWidth="3" strokeDasharray="20 80" strokeDashoffset="-80" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">Net</span>
                    </div>
                    <div className="space-y-1.5">
                      {[{ dot: "#34d399", label: "Fee Collections — 60%" }, { dot: "#06b6d4", label: "Ad-hoc Income — 20%" }, { dot: "#f43f5e", label: "Expenses — 20%" }].map((l) => (
                        <div key={l.label} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.dot }} />
                          <span className="text-[10px] text-white/40">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute -top-3 -right-3 flex items-center gap-1.5 bg-gradient-to-r from-[#7c3aed] to-[#0162b1] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                    LIVE DATA
                  </div>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Technology Stack ───────────────────────────────────────── */}
      <section id="technology" className="max-w-7xl mx-auto px-4 sm:px-6 py-28">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/20 px-4 py-2 rounded-full mb-5">Technology Stack</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
              Built on{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#34d399] to-[#60a5fa]">Enterprise-Grade</span>
              {" "}Infrastructure
            </h2>
            <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">Every layer is engineered for performance, security, and scalability.</p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {techStack.map(({ icon: Icon, label, sub, color }, i) => (
            <StaggerCard key={label} delay={i * 80}>
              <TiltCard>
                <div className="group flex flex-col items-center text-center bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 cursor-default">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300" style={{ background: `${color}18`, boxShadow: `0 0 20px ${color}25` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <p className="text-[13px] font-black text-white leading-tight">{label}</p>
                  <p className="text-[10px] text-white/30 font-semibold mt-0.5">{sub}</p>
                </div>
              </TiltCard>
            </StaggerCard>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Globe, title: "Monorepo Architecture", desc: "Turborepo-powered monorepo with shared packages for database, config, and types — ensuring consistency across the web and API layers.", color: "#60a5fa" },
            { icon: Lock, title: "End-to-End Security", desc: "JWT access tokens, Redis-backed session enforcement, concurrency control, per-role route guards, and parameterized Prisma queries prevent SQLi and XSS.", color: "#f43f5e" },
            { icon: Cloud, title: "S3-Compatible Storage", desc: "Presigned upload URLs directly to MinIO or AWS S3 for exam images, study materials, and student profile photos — zero bandwidth through the API server.", color: "#fb923c" },
            { icon: Zap, title: "Redis Caching Layer", desc: "Session tokens, rate-limit counters, live class states, and notification queues run through Redis for sub-millisecond response on high-frequency operations.", color: "#d82c20" },
            { icon: Database, title: "Relational Data Integrity", desc: "PostgreSQL with a comprehensive Prisma schema featuring cascading deletes, relational constraints, and indexed queries across all entity relationships.", color: "#336791" },
            { icon: Rocket, title: "Coolify & Nixpacks Deploy", desc: "Zero-config Nixpacks build pipeline with Coolify orchestration and Docker containerization — deployed and live in minutes with full environment isolation.", color: "#a78bfa" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <StaggerCard key={item.title} delay={i % 3 * 100}>
                <div className="group bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(circle at top left, ${item.color}15 0%, transparent 70%)` }} />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: `${item.color}18`, boxShadow: `0 0 20px ${item.color}25` }}>
                    <Icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <p className="text-[14px] font-bold text-white mb-2">{item.title}</p>
                  <p className="text-[12px] text-white/35 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerCard>
            );
          })}
        </div>
      </section>

      {/* ── Security ───────────────────────────────────────────────── */}
      <section id="security" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050816] via-[#07102a] to-[#050816]" />
        <FloatingOrb color="#dc2626" size={400} top="20%" left="70%" delay={2} />
        <FloatingOrb color="#7c3aed" size={350} top="60%" left="10%" delay={1} />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimatedSection>
            <p className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-[#f43f5e] bg-[#f43f5e]/10 border border-[#f43f5e]/20 px-4 py-2 rounded-full mb-6">Security & Compliance</p>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
              Institutional-Grade{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f43f5e] to-[#fb923c]">Security Standards</span>
            </h2>
            <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto leading-relaxed mb-12">
              Role-based access, session security, encrypted tokens, and data integrity controls meet the rigorous standards educational institutions demand.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["JWT Access Tokens", "Refresh Token Rotation", "Redis Single-Session Enforcement", "Role-Based Route Guards", "Parameterized Queries (No SQLi)", "Presigned S3 Uploads", "HTTPS-First Architecture", "Concurrency Control", "Audit Trails", "Data Validation Pipes"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-full text-[12px] font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-all duration-200 cursor-default">
                  <CheckCircle className="h-3 w-3 text-[#34d399]" />
                  {item}
                </span>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28">
        <div className="absolute inset-0 bg-[#030712]" />
        <FloatingOrb color="#0162b1" size={700} top="-30%" left="-15%" delay={0} />
        <FloatingOrb color="#7c3aed" size={600} top="20%" left="60%" delay={2} />
        <FloatingOrb color="#059669" size={400} top="70%" left="30%" delay={4} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-[11px] font-bold uppercase tracking-widest mb-8">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              Ready to Transform Education
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            </div>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] mb-6">
              Your Institution.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60a5fa] via-[#a78bfa] to-[#34d399]">Fully Empowered.</span>
            </h2>
            <p className="text-white/35 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              Access the complete Educare LMS platform — examinations, analytics, admissions, and everything in between — designed to run at institutional scale.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MagneticButton href="/login" primary>
                Launch Platform <ArrowRight className="h-5 w-5" />
              </MagneticButton>
              <MagneticButton href="#modules">
                View Features <ChevronDown className="h-5 w-5 text-white/40" />
              </MagneticButton>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#030712] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0162b1] to-[#7c3aed] flex items-center justify-center">
              <GraduationCap className="h-3 w-3 text-white" />
            </div>
            <span className="text-[13px] font-black text-white">
              <span className="text-[#60a5fa]">edu</span>care LMS
            </span>
          </div>
          <p className="text-[11px] text-white/20 font-medium">Built with Next.js · NestJS · PostgreSQL · Redis</p>
          <p className="text-[11px] text-white/20">© {new Date().getFullYear()} Educare Technologies</p>
        </div>
      </footer>

      {/* ── Global Keyframes ────────────────────────────────────────── */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes orbFloat {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollDot {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(10px); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
