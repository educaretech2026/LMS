"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";
import {
  Video, Calendar, Clock, User, Mail, Phone, Building,
  CheckCircle2, Copy, Check, ExternalLink, AlertCircle,
  ArrowRight, ShieldCheck, Sparkles, Radio, HelpCircle,
  CalendarPlus, RefreshCw
} from "lucide-react";

interface PublicWebinar {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  description?: string | null;
  scheduledAt: string;
  duration: number;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  isPublic: boolean;
  backgroundImageUrl?: string | null;
  createdAt: string;
}

function getPublicApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.educarelearning.in/api";
  const cleanBase = rawUrl.replace(/\/+$/, "");
  return cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
}

/* ─────────────────────────── Forge-style primitives ─────────────────────────── */

function ForgeLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
      style={{ color: "rgba(148,163,184,1)" }}
    >
      {children}
    </label>
  );
}

function ForgeInput({
  id, type = "text", value, onChange, onBlur, placeholder, required, isError,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  isError?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      required={required}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        background: isError ? "rgba(238,27,36,0.06)" : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${isError ? "rgba(238,27,36,0.5)" : "rgba(255,255,255,0.12)"}`,
        boxShadow: isError ? "0 0 0 3px rgba(238,27,36,0.08)" : "inset 0 1px 4px rgba(0,0,0,0.3)",
        color: "white",
        fontSize: "13px",
        fontFamily: "inherit",
        transition: "all 0.18s ease",
      }}
      className="w-full h-[42px] rounded-[10px] px-3.5 placeholder:text-slate-600 focus:outline-none focus:border-[#0162b1] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(1,98,177,0.18)] focus:bg-[rgba(1,98,177,0.04)]"
    />
  );
}

function ForgeFieldIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: "rgba(1,98,177,0.18)", border: "1px solid rgba(1,98,177,0.28)" }}
    >
      {icon}
    </div>
  );
}

/* ─────────────────────────────── Main Page ─────────────────────────────── */

export default function PublicLiveClassPage() {
  const params = useParams();
  const id = params?.id as string;

  const [webinar, setWebinar] = useState<PublicWebinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: "", email: "", phone: "", organization: "", honeypot: "" });
  const [touched, setTouched] = useState({ name: false, email: false, phone: false, organization: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isStarted: boolean }>(
    { days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: false }
  );

  useEffect(() => {
    if (!id) return;
    try {
      const storedAccess = localStorage.getItem(`live_access_${id}`);
      if (storedAccess) {
        const parsed = JSON.parse(storedAccess);
        if (parsed.meetUrl) {
          setMeetUrl(parsed.meetUrl);
          setRegistered(true);
          if (parsed.name) setFormData(prev => ({ ...prev, name: parsed.name, email: parsed.email || "", phone: parsed.phone || "", organization: parsed.organization || "" }));
        }
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${getPublicApiUrl()}/live-class/public/${id}`);
        if (!res.ok) throw new Error(res.status === 404 ? "This live session was not found or is no longer open to the public." : "Unable to load session details. Please refresh.");
        setWebinar(await res.json());
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  useEffect(() => {
    if (!webinar?.scheduledAt) return;
    const target = new Date(webinar.scheduledAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: true }); return; }
      setTimeLeft({ days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, seconds: Math.floor(diff / 1000) % 60, isStarted: false });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [webinar?.scheduledAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, organization: true });
    const n = formData.name.trim(), em = formData.email.trim(), ph = formData.phone.trim(), org = formData.organization.trim();
    if (!n) { setSubmitError("Please enter your full name."); return; }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setSubmitError("Please enter a valid email address."); return; }
    if (!ph || ph.replace(/\D/g, "").length < 7) { setSubmitError("Please enter a valid WhatsApp / mobile number."); return; }
    if (!org) { setSubmitError("Please enter your school, college, or organization name."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const res = await fetch(`${getPublicApiUrl()}/live-class/public/${id}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, email: em, phone: ph, organization: org, honeypot: formData.honeypot }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed. Please try again.");
      setMeetUrl(data.meetUrl);
      setRegistered(true);
      localStorage.setItem(`live_access_${id}`, JSON.stringify({ meetUrl: data.meetUrl, name: n, email: em, phone: ph, organization: org, registeredAt: new Date().toISOString() }));
    } catch (e: any) { setSubmitError(e.message || "An error occurred. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleCopyLink = () => { if (!meetUrl) return; navigator.clipboard.writeText(meetUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  const handleReset = () => { if (confirm("Register with a different attendee profile?")) { localStorage.removeItem(`live_access_${id}`); setRegistered(false); setMeetUrl(null); setFormData({ name: "", email: "", phone: "", organization: "", honeypot: "" }); setTouched({ name: false, email: false, phone: false, organization: false }); } };

  const googleCalendarUrl = useMemo(() => {
    if (!webinar) return "";
    try {
      const s = new Date(webinar.scheduledAt), e2 = new Date(s.getTime() + (webinar.duration || 60) * 60000);
      const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(webinar.title)}&dates=${fmt(s)}/${fmt(e2)}&details=${encodeURIComponent((webinar.description || "") + "\n\nJoin: " + (meetUrl || window.location.href))}&location=${encodeURIComponent(meetUrl || "Google Meet")}`;
    } catch { return ""; }
  }, [webinar, meetUrl]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ background: "linear-gradient(135deg,#061427 0%,#0a1e3d 50%,#04101e 100%)" }} className="min-h-screen flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle,#0162b1,transparent)" }} />
      <div className="relative flex flex-col items-center gap-4 z-10">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-white/10 border-t-[#0162b1] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center"><Video className="h-5 w-5 text-[#1a7fd4]" /></div>
        </div>
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-400">Connecting to Educare Live</p>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error || !webinar) return (
    <div style={{ background: "linear-gradient(135deg,#061427 0%,#0a1e3d 50%,#04101e 100%)" }} className="min-h-screen flex items-center justify-center p-6 text-white">
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }} className="max-w-md w-full rounded-2xl p-8 text-center shadow-2xl">
        <div style={{ background: "rgba(238,27,36,0.1)", border: "1px solid rgba(238,27,36,0.3)" }} className="h-14 w-14 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7" style={{ color: "#ee1b24" }} />
        </div>
        <h2 className="text-lg font-bold mb-2">Session Unavailable</h2>
        <p className="text-sm text-slate-400 mb-6">{error || "This live session is private or no longer available."}</p>
        <a href="/" style={{ background: "linear-gradient(135deg,#0162b1,#1a7fd4)", boxShadow: "0 4px 20px rgba(1,98,177,0.3)" }} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90">Return to Educare LMS</a>
      </div>
    </div>
  );

  const scheduledDate = new Date(webinar.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const formattedTime = scheduledDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const isLiveNow = webinar.status === "LIVE" || timeLeft.isStarted;
  const isEnded = webinar.status === "ENDED";

  const nameTouched = touched.name && !formData.name.trim();
  const emailTouched = touched.email && (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()));
  const phoneTouched = touched.phone && (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 7);
  const orgTouched = touched.organization && !formData.organization.trim();

  return (
    <div
      className="min-h-screen relative flex flex-col overflow-x-hidden"
      style={{
        backgroundImage: webinar.backgroundImageUrl ? `url("${webinar.backgroundImageUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: webinar.backgroundImageUrl ? "linear-gradient(135deg,rgba(4,16,32,0.97) 0%,rgba(7,28,58,0.93) 60%,rgba(2,11,24,0.96) 100%)" : "linear-gradient(135deg,#061427 0%,#0a1e3d 55%,#04101e 100%)" }} />
      {/* Ambient glow orbs */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] opacity-[0.22] pointer-events-none" style={{ background: "radial-gradient(circle at 30% 30%,#0162b1,transparent 70%)" }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-[0.12] pointer-events-none" style={{ background: "radial-gradient(circle at 70% 70%,#ee1b24,transparent 70%)" }} />

      {/* ── TOP HEADER / BRAND BAR ── */}
      <header className="relative z-20 w-full" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(4,16,32,0.6)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo — LARGER */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{ background: "white", borderRadius: "14px", padding: "8px 20px", boxShadow: "0 4px 24px rgba(1,98,177,0.22), 0 1px 4px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <Image src={logoImage} alt="Educare Group of Institutions" width={210} height={50} className="object-contain" style={{ height: "44px", width: "auto" }} priority />
            </div>
            <div className="hidden md:flex flex-col" style={{ borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "16px" }}>
              <span className="font-black text-white tracking-wide" style={{ fontSize: "13px" }}>Educare Live</span>
              <span style={{ fontSize: "11px", color: "rgba(148,163,184,0.8)", fontWeight: 500 }}>Virtual Campus & Webinars</span>
            </div>
          </div>

          {/* Status pill */}
          {isLiveNow ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold animate-pulse" style={{ fontSize: "11px", background: "rgba(238,27,36,0.18)", border: "1px solid rgba(238,27,36,0.4)", color: "#fca5a5" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#ee1b24", boxShadow: "0 0 6px #ee1b24" }} />
              LIVE NOW
            </div>
          ) : isEnded ? (
            <div className="px-4 py-1.5 rounded-full font-semibold" style={{ fontSize: "11px", background: "rgba(51,65,85,0.8)", border: "1px solid rgba(100,116,139,0.3)", color: "#94a3b8" }}>Session Concluded</div>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full font-semibold" style={{ fontSize: "11px", background: "rgba(1,98,177,0.2)", border: "1px solid rgba(1,98,177,0.4)", color: "#93c5fd" }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />
              Open Webinar
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="relative z-20 flex-1 w-full max-w-7xl mx-auto px-6 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/* ── LEFT: Session Info Panel ── */}
          <div className="lg:col-span-7 space-y-7 text-white">

            {/* Topic badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold tracking-widest uppercase" style={{ fontSize: "10px", background: "rgba(1,98,177,0.2)", border: "1px solid rgba(1,98,177,0.35)", color: "#93c5fd" }}>
                <Radio className="h-3 w-3" style={{ color: "#1a7fd4" }} />{webinar.subject}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold" style={{ fontSize: "10px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#6ee7b7" }}>
                <ShieldCheck className="h-3 w-3" />Verified LMS Session
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-[3.2rem] font-black leading-[1.1] tracking-tight drop-shadow-lg" style={{ color: "white" }}>
              {webinar.title}
            </h1>

            {/* Description — Forge "Panel" style */}
            {webinar.description && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: "rgba(1,98,177,0.12)", borderBottom: "1px solid rgba(1,98,177,0.2)" }}>
                  <span className="font-bold tracking-widest uppercase" style={{ fontSize: "10px", color: "#1a7fd4" }}>Session Overview</span>
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#cbd5e1" }}>{webinar.description}</p>
                </div>
              </div>
            )}

            {/* Forge-style Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Faculty */}
              <div className="flex items-center gap-3.5 rounded-xl p-4 transition-all hover:border-white/20" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: "linear-gradient(135deg,#0162b1,#014d8a)", boxShadow: "0 4px 12px rgba(1,98,177,0.35)" }}>
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold tracking-wider uppercase mb-0.5" style={{ fontSize: "9px", color: "#64748b" }}>Faculty / Speaker</p>
                  <p className="font-bold text-sm text-white">{webinar.teacherName}</p>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-3.5 rounded-xl p-4 transition-all hover:border-white/20" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: "linear-gradient(135deg,#059669,#0d9488)", boxShadow: "0 4px 12px rgba(5,150,105,0.35)" }}>
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold tracking-wider uppercase mb-0.5" style={{ fontSize: "9px", color: "#64748b" }}>Duration & Platform</p>
                  <p className="font-bold text-sm text-white">{webinar.duration} Min · Google Meet</p>
                </div>
              </div>

              {/* Date span full */}
              <div className="sm:col-span-2 flex items-center gap-3.5 rounded-xl p-4 transition-all hover:border-white/20" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: "linear-gradient(135deg,#d97706,#c2410c)", boxShadow: "0 4px 12px rgba(217,119,6,0.35)" }}>
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-bold tracking-wider uppercase mb-0.5" style={{ fontSize: "9px", color: "#64748b" }}>Date & Time</p>
                  <p className="font-bold text-sm text-white">{formattedDate} · {formattedTime} IST</p>
                </div>
              </div>
            </div>

            {/* Countdown — Forge "metric tiles" */}
            {!timeLeft.isStarted && !isEnded && (
              <div>
                <p className="font-bold uppercase tracking-[0.18em] mb-3 flex items-center gap-2" style={{ fontSize: "10px", color: "#64748b" }}>
                  <Clock className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />
                  Session Commences In
                </p>
                <div className="flex gap-2.5 sm:gap-3">
                  {[{ label: "Days", value: timeLeft.days }, { label: "Hrs", value: timeLeft.hours }, { label: "Min", value: timeLeft.minutes }, { label: "Sec", value: timeLeft.seconds }].map(({ label, value }) => (
                    <div key={label} className="flex-1 text-center rounded-xl py-3.5 px-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                      <p className="font-black font-mono text-white" style={{ fontSize: "28px", lineHeight: 1, letterSpacing: "-0.04em" }}>{String(value).padStart(2, "0")}</p>
                      <p className="font-bold uppercase tracking-widest mt-1" style={{ fontSize: "9px", color: "#475569" }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Forge Registration Panel ── */}
          <div className="lg:col-span-5 lg:sticky lg:top-8">
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: "rgba(7,20,40,0.94)",
                border: "1px solid rgba(255,255,255,0.13)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              {!registered ? (
                <>
                  {/* Forge panel header */}
                  <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Pill badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-4 font-bold uppercase tracking-widest" style={{ fontSize: "10px", background: "rgba(1,98,177,0.18)", border: "1px solid rgba(1,98,177,0.35)", color: "#1a7fd4" }}>
                      Free Admission
                    </div>
                    <h2 className="font-black text-white tracking-tight mb-1" style={{ fontSize: "22px" }}>Register to Join Live</h2>
                    <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
                      Complete the form below to receive your Google Meet access link.
                    </p>
                  </div>

                  {/* Form body */}
                  <div className="px-6 py-5">
                    {submitError && (
                      <div className="mb-4 flex items-center gap-2.5 px-3.5 py-3 rounded-xl" style={{ background: "rgba(238,27,36,0.1)", border: "1px solid rgba(238,27,36,0.28)", fontSize: "12px", color: "#fca5a5" }}>
                        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#ee1b24" }} />
                        <span className="font-medium">{submitError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit}>
                      {/* Honeypot */}
                      <input type="text" name="website" value={formData.honeypot} onChange={e => setFormData({ ...formData, honeypot: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />

                      <div className="space-y-4">
                        {/* Full Name */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ForgeFieldIcon icon={<User className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />} />
                            <ForgeLabel htmlFor="reg-name">Full Name <span style={{ color: "#ee1b24" }}>*</span></ForgeLabel>
                          </div>
                          <ForgeInput id="reg-name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} onBlur={() => setTouched(t => ({ ...t, name: true }))} placeholder="e.g. Rahul Sharma" required isError={nameTouched} />
                          {nameTouched && <p style={{ fontSize: "11px", color: "#f87171", marginTop: "5px" }}>Please enter your full name.</p>}
                        </div>

                        {/* Email */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ForgeFieldIcon icon={<Mail className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />} />
                            <ForgeLabel htmlFor="reg-email">Email Address <span style={{ color: "#ee1b24" }}>*</span></ForgeLabel>
                          </div>
                          <ForgeInput id="reg-email" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} onBlur={() => setTouched(t => ({ ...t, email: true }))} placeholder="e.g. rahul@example.com" required isError={emailTouched} />
                          {emailTouched && <p style={{ fontSize: "11px", color: "#f87171", marginTop: "5px" }}>Please enter a valid email address.</p>}
                        </div>

                        {/* Phone */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ForgeFieldIcon icon={<Phone className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />} />
                            <ForgeLabel htmlFor="reg-phone">WhatsApp / Mobile <span style={{ color: "#ee1b24" }}>*</span></ForgeLabel>
                          </div>
                          <ForgeInput id="reg-phone" type="tel" value={formData.phone} onChange={v => setFormData({ ...formData, phone: v })} onBlur={() => setTouched(t => ({ ...t, phone: true }))} placeholder="e.g. +91 98765 43210" required isError={phoneTouched} />
                          {phoneTouched && <p style={{ fontSize: "11px", color: "#f87171", marginTop: "5px" }}>Please enter a valid mobile number.</p>}
                        </div>

                        {/* Organization */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ForgeFieldIcon icon={<Building className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />} />
                            <ForgeLabel htmlFor="reg-org">School / College / Organization <span style={{ color: "#ee1b24" }}>*</span></ForgeLabel>
                          </div>
                          <ForgeInput id="reg-org" value={formData.organization} onChange={v => setFormData({ ...formData, organization: v })} onBlur={() => setTouched(t => ({ ...t, organization: true }))} placeholder="e.g. Delhi Public School" required isError={orgTouched} />
                          {orgTouched && <p style={{ fontSize: "11px", color: "#f87171", marginTop: "5px" }}>Please enter your institution name.</p>}
                        </div>
                      </div>

                      {/* Submit button — Forge primary action */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full mt-6 flex items-center justify-center gap-2.5 font-bold rounded-xl transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                        style={{ height: "48px", fontSize: "13px", letterSpacing: "0.04em", background: "linear-gradient(135deg,#0162b1 0%,#1a7fd4 100%)", boxShadow: "0 4px 20px rgba(1,98,177,0.4), 0 1px 0 rgba(255,255,255,0.12) inset", color: "white" }}
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            <span>Confirming Registration…</span>
                          </>
                        ) : (
                          <>
                            <span>Register & Get Google Meet Link</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                /* ── Unlocked / Confirmed Panel ── */
                <>
                  <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.35)" }}>
                        <CheckCircle2 className="h-7 w-7" style={{ color: "#34d399" }} />
                      </div>
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "9px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>Pass Confirmed</span>
                        <h2 className="font-black text-white" style={{ fontSize: "20px" }}>Registration Complete!</h2>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "#94a3b8" }}>Welcome, <span className="font-bold text-white">{formData.name || "Attendee"}</span>. Your attendee pass has been verified.</p>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {meetUrl ? (
                      <>
                        <a href={meetUrl} target="_blank" rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2.5 rounded-xl font-bold transition-all hover:opacity-90 active:scale-[0.99]"
                          style={{ height: "52px", fontSize: "14px", background: "linear-gradient(135deg,#059669,#0d9488)", boxShadow: "0 4px 20px rgba(5,150,105,0.4)", color: "white" }}>
                          <Video className="h-5 w-5" />
                          <span>Launch Google Meet</span>
                          <ExternalLink className="h-4 w-4 opacity-70" />
                        </a>
                        <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold transition-all hover:opacity-80" style={{ height: "40px", fontSize: "12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                          {copied ? <Check className="h-4 w-4" style={{ color: "#34d399" }} /> : <Copy className="h-4 w-4" style={{ color: "#94a3b8" }} />}
                          {copied ? "Link Copied to Clipboard!" : "Copy Google Meet Link"}
                        </button>
                      </>
                    ) : (
                      <div className="text-sm text-center rounded-xl py-4 px-5" style={{ background: "rgba(217,119,6,0.12)", border: "1px solid rgba(217,119,6,0.28)", color: "#fcd34d" }}>
                        The faculty will share the Google Meet link shortly before start time. Please refresh.
                      </div>
                    )}

                    {googleCalendarUrl && (
                      <a href={googleCalendarUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 font-semibold underline underline-offset-4 transition-colors hover:opacity-80" style={{ fontSize: "12px", color: "#1a7fd4" }}>
                        <CalendarPlus className="h-3.5 w-3.5" />Add to Google Calendar
                      </a>
                    )}

                    {/* Guidelines block */}
                    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="flex items-center gap-1.5 font-bold mb-2.5" style={{ fontSize: "11px", color: "white" }}>
                        <HelpCircle className="h-3.5 w-3.5" style={{ color: "#1a7fd4" }} />Webinar Guidelines
                      </p>
                      <ul className="space-y-1.5" style={{ fontSize: "11px", color: "#64748b" }}>
                        <li className="flex items-start gap-1.5"><span style={{ color: "#0162b1" }}>—</span>Keep your microphone muted upon entry.</li>
                        <li className="flex items-start gap-1.5"><span style={{ color: "#0162b1" }}>—</span>Use in-call chat for questions during Q&A.</li>
                        <li className="flex items-start gap-1.5"><span style={{ color: "#0162b1" }}>—</span>Your access is saved — no need to register again on refresh.</li>
                      </ul>
                    </div>

                    <button onClick={handleReset} className="flex items-center gap-1.5 mx-auto transition-colors hover:text-slate-300" style={{ fontSize: "11px", color: "#475569" }}>
                      <RefreshCw className="h-3 w-3" />Register a different attendee
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 text-center py-4 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(4,16,32,0.5)", backdropFilter: "blur(12px)", fontSize: "11px", color: "#475569" }}>
        © {new Date().getFullYear()} Educare Group of Institutions. All rights reserved. Powered by Educare LMS.
      </footer>
    </div>
  );
}
