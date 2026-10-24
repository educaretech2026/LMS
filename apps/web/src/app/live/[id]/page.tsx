"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";
import {
  Video, Calendar, Clock, User, Mail, Phone, Building,
  CheckCircle2, Copy, Check, ExternalLink, AlertCircle,
  ArrowRight, ShieldCheck, Sparkles, Radio, HelpCircle,
  CalendarPlus, GraduationCap, RefreshCw, Lock
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

export default function PublicLiveClassPage() {
  const params = useParams();
  const id = params?.id as string;

  const [webinar, setWebinar] = useState<PublicWebinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form & Access states - ALL 4 FIELDS ARE STRICTLY MANDATORY
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    honeypot: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    organization: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Time remaining countdown
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isStarted: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: false });

  // 1. Check local storage for existing verified registration
  useEffect(() => {
    if (!id) return;
    try {
      const storedAccess = localStorage.getItem(`live_access_${id}`);
      if (storedAccess) {
        const parsed = JSON.parse(storedAccess);
        if (parsed.meetUrl) {
          setMeetUrl(parsed.meetUrl);
          setRegistered(true);
          if (parsed.name) {
            setFormData(prev => ({
              ...prev,
              name: parsed.name,
              email: parsed.email || "",
              phone: parsed.phone || "",
              organization: parsed.organization || "",
            }));
          }
        }
      }
    } catch {
      // ignore parsing error
    }
  }, [id]);

  // 2. Fetch public webinar data
  useEffect(() => {
    if (!id) return;
    const fetchPublicInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = getPublicApiUrl();
        const res = await fetch(`${apiUrl}/live-class/public/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This live session was not found or is no longer open to the public.");
          }
          throw new Error("Unable to load session details. Please check your connection and refresh.");
        }
        const data = await res.json();
        setWebinar(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicInfo();
  }, [id]);

  // 3. Countdown timer logic
  useEffect(() => {
    if (!webinar?.scheduledAt) return;
    const target = new Date(webinar.scheduledAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isStarted: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [webinar?.scheduledAt]);

  // Handle Form Submission with ALL 4 FIELDS MANDATORY
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, organization: true });

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedOrg = formData.organization.trim();

    // Strict frontend validation enforcing all 4 fields
    if (!trimmedName) {
      setSubmitError("Full Name is mandatory. Please enter your name.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSubmitError("A valid Email Address is mandatory.");
      return;
    }
    if (!trimmedPhone || trimmedPhone.replace(/\D/g, "").length < 7) {
      setSubmitError("A valid WhatsApp / Mobile Number is mandatory.");
      return;
    }
    if (!trimmedOrg) {
      setSubmitError("School, College, or Organization name is mandatory.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const apiUrl = getPublicApiUrl();
      const res = await fetch(`${apiUrl}/live-class/public/${id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          organization: trimmedOrg,
          honeypot: formData.honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register. Please verify your details.");
      }

      setMeetUrl(data.meetUrl);
      setRegistered(true);

      // Save to localStorage for browser session persistence
      localStorage.setItem(
        `live_access_${id}`,
        JSON.stringify({
          meetUrl: data.meetUrl,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          organization: trimmedOrg,
          registeredAt: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!meetUrl) return;
    navigator.clipboard.writeText(meetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetRegistration = () => {
    if (confirm("Register with a different attendee profile?")) {
      localStorage.removeItem(`live_access_${id}`);
      setRegistered(false);
      setMeetUrl(null);
      setFormData({ name: "", email: "", phone: "", organization: "", honeypot: "" });
      setTouched({ name: false, email: false, phone: false, organization: false });
    }
  };

  // Google Calendar Link Generator
  const googleCalendarUrl = useMemo(() => {
    if (!webinar) return "";
    try {
      const start = new Date(webinar.scheduledAt);
      const end = new Date(start.getTime() + (webinar.duration || 60) * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const details = `${webinar.description || ""}\n\nJoin Link: ${meetUrl || window.location.href}`;
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        webinar.title
      )}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
        meetUrl || "Google Meet"
      )}`;
    } catch {
      return "";
    }
  }, [webinar, meetUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07162c] flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#0162b1]/20 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#0162b1] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="h-6 w-6 text-[#1a7fd4]" />
            </div>
          </div>
          <p className="mt-5 text-xs font-semibold text-slate-300 tracking-widest uppercase">Connecting to Educare Live...</p>
        </div>
      </div>
    );
  }

  if (error || !webinar) {
    return (
      <div className="min-h-screen bg-[#07162c] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#ee1b24]/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="h-16 w-16 rounded-2xl bg-[#ee1b24]/10 border border-[#ee1b24]/30 flex items-center justify-center text-[#ee1b24] mb-4 mx-auto shadow-inner">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Live Session Unavailable</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {error || "This live session is private or no longer available."}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0162b1] to-[#1a7fd4] hover:from-[#014d8a] hover:to-[#0162b1] text-white text-xs font-bold shadow-lg shadow-[#0162b1]/25 transition-all"
          >
            Return to Educare LMS
          </a>
        </div>
      </div>
    );
  }

  const scheduledDate = new Date(webinar.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = scheduledDate.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isLiveNow = webinar.status === "LIVE" || timeLeft.isStarted;
  const isEnded = webinar.status === "ENDED";

  return (
    <div
      className="min-h-screen relative flex flex-col justify-between bg-cover bg-center bg-no-repeat selection:bg-[#0162b1] selection:text-white font-sans overflow-x-hidden"
      style={{
        backgroundImage: webinar.backgroundImageUrl
          ? `url("${webinar.backgroundImageUrl}")`
          : undefined,
      }}
    >
      {/* Background layer: If custom image exists, dark brand vignette. If not, LMS signature glowing gradient */}
      {webinar.backgroundImageUrl ? (
        <div className="absolute inset-0 bg-gradient-to-tr from-[#021124]/96 via-[#071c38]/92 to-[#020b18]/94 backdrop-blur-[2px] pointer-events-none" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#061426] via-[#0b203d] to-[#040e1d] pointer-events-none" />
      )}

      {/* Dynamic Glowing Ambient Orbs (Aligns with Educare LMS Login/Dashboard Aesthetics) */}
      <div className="absolute top-[-10%] left-[-8%] w-[580px] h-[580px] rounded-full bg-[#0162b1]/25 blur-[130px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[520px] h-[520px] rounded-full bg-[#ee1b24]/15 blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute top-[35%] right-[20%] w-[380px] h-[380px] rounded-full bg-blue-500/15 blur-[100px] mix-blend-screen pointer-events-none" />

      {/* Top Navigation / Brand Header */}
      <header className="relative z-20 px-6 py-4 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-11 px-4 rounded-xl bg-white shadow-lg flex items-center justify-center overflow-hidden border border-white/30">
            <Image
              src={logoImage}
              alt="Educare Group of Institutions"
              width={160}
              height={34}
              className="object-contain h-7 w-auto"
              priority
            />
          </div>
          <div className="hidden sm:flex flex-col border-l border-white/15 pl-3">
            <span className="text-[11px] font-extrabold tracking-wider text-white uppercase">Educare Live</span>
            <span className="text-[9px] text-slate-400 font-medium">Virtual Campus & Webinars</span>
          </div>
        </div>

        {/* Live / Status Indicator */}
        <div className="flex items-center gap-3">
          {isLiveNow ? (
            <div className="flex items-center gap-2 bg-[#ee1b24]/20 border border-[#ee1b24]/40 text-red-200 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-red-950/50 backdrop-blur-md animate-pulse">
              <span className="h-2 w-2 rounded-full bg-[#ee1b24]" />
              <span>LIVE NOW</span>
            </div>
          ) : isEnded ? (
            <div className="bg-slate-800/80 border border-slate-700 text-slate-300 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md">
              Session Concluded
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#0162b1]/25 border border-[#0162b1]/40 text-blue-200 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[#1a7fd4]" />
              <span>Open Webinar</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="relative z-20 max-w-7xl mx-auto w-full px-6 py-8 md:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Column: Session Information */}
          <div className="lg:col-span-7 space-y-6 text-white">
            
            {/* Subject & Verification Pill */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0162b1]/25 backdrop-blur-md border border-[#0162b1]/40 text-blue-300 text-xs font-bold tracking-wider uppercase">
                <Radio className="h-3.5 w-3.5 text-[#1a7fd4]" />
                {webinar.subject}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified LMS Session
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.18] drop-shadow-md">
              {webinar.title}
            </h1>

            {/* Description / Agenda Box */}
            {webinar.description && (
              <div className="relative bg-white/[0.06] backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#0162b1]/50 to-transparent" />
                <p className="text-xs uppercase font-bold tracking-widest text-[#1a7fd4] mb-1.5">Overview & Agenda</p>
                <p className="text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-line">
                  {webinar.description}
                </p>
              </div>
            )}

            {/* Institutional Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Faculty Card */}
              <div className="flex items-center gap-3.5 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#0162b1] to-[#014d8a] border border-white/20 flex items-center justify-center text-white shadow-md shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Faculty / Speaker</p>
                  <p className="text-sm font-bold text-white">{webinar.teacherName}</p>
                </div>
              </div>

              {/* Duration & Platform */}
              <div className="flex items-center gap-3.5 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 border border-white/20 flex items-center justify-center text-white shadow-md shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Duration & Platform</p>
                  <p className="text-sm font-bold text-white">{webinar.duration} Mins • Google Meet HD</p>
                </div>
              </div>

              {/* Schedule Date & Time */}
              <div className="sm:col-span-2 flex items-center gap-3.5 bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg hover:border-white/20 transition-all">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border border-white/20 flex items-center justify-center text-white shadow-md shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
                  <p className="text-sm font-bold text-white">
                    {formattedDate} • {formattedTime} IST
                  </p>
                </div>
              </div>
            </div>

            {/* Countdown Clock */}
            {!timeLeft.isStarted && !isEnded && (
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[#1a7fd4]" />
                  <span>Session Commences In:</span>
                </p>
                <div className="flex items-center gap-2 sm:gap-3">
                  {[
                    { label: "Days", value: timeLeft.days },
                    { label: "Hours", value: timeLeft.hours },
                    { label: "Minutes", value: timeLeft.minutes },
                    { label: "Seconds", value: timeLeft.seconds },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex-1 max-w-[90px] bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-2xl p-3 text-center shadow-xl"
                    >
                      <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                        {String(value).padStart(2, "0")}
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: High-End Registration Card OR Unlocked Live Meet Room */}
          <div className="lg:col-span-5">
            <div className="backdrop-blur-2xl bg-[#05152a]/92 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              
              {/* Highlight shine line at top of card */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

              {!registered ? (
                /* Registration Form with EVERY DETAIL MANDATORY */
                <div>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0162b1]/25 border border-[#0162b1]/40 text-[#1a7fd4] text-[11px] font-bold uppercase tracking-wider mb-2.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Complimentary Admission
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Register to Join Live</h2>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Please enter your details below. <span className="text-white font-semibold underline decoration-[#ee1b24] underline-offset-2">All 4 details are strictly mandatory</span> to receive your Google Meet access link.
                    </p>
                  </div>

                  {submitError && (
                    <div className="mb-4 p-3.5 rounded-xl bg-[#ee1b24]/15 border border-[#ee1b24]/30 text-xs text-red-200 flex items-center gap-2.5 shadow-lg">
                      <AlertCircle className="h-4 w-4 shrink-0 text-[#ee1b24]" />
                      <span className="font-medium">{submitError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Bot Honeypot */}
                    <input
                      type="text"
                      name="website"
                      value={formData.honeypot}
                      onChange={e => setFormData({ ...formData, honeypot: e.target.value })}
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    {/* Field 1: Full Name (Mandatory) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-200">
                          Full Name <span className="text-[#ee1b24]">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                          placeholder="e.g. Rahul Sharma"
                          className={`w-full h-11 bg-white/[0.06] border rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0162b1]/60 focus:border-[#0162b1] focus:bg-white/[0.09] transition-all shadow-inner ${
                            touched.name && !formData.name.trim()
                              ? "border-[#ee1b24] ring-1 ring-[#ee1b24]/30"
                              : "border-white/15"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Field 2: Email Address (Mandatory) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-200">
                          Email Address <span className="text-[#ee1b24]">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Mail className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                          placeholder="e.g. rahul@example.com"
                          className={`w-full h-11 bg-white/[0.06] border rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0162b1]/60 focus:border-[#0162b1] focus:bg-white/[0.09] transition-all shadow-inner ${
                            touched.email && (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
                              ? "border-[#ee1b24] ring-1 ring-[#ee1b24]/30"
                              : "border-white/15"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Field 3: WhatsApp / Mobile Number (Mandatory) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-200">
                          WhatsApp / Mobile Number <span className="text-[#ee1b24]">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Phone className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                          placeholder="e.g. +91 98765 43210"
                          className={`w-full h-11 bg-white/[0.06] border rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0162b1]/60 focus:border-[#0162b1] focus:bg-white/[0.09] transition-all shadow-inner ${
                            touched.phone && (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 7)
                              ? "border-[#ee1b24] ring-1 ring-[#ee1b24]/30"
                              : "border-white/15"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Field 4: School / College / Organization (Mandatory) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-200">
                          School / College / Organization <span className="text-[#ee1b24]">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Building className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.organization}
                          onChange={e => setFormData({ ...formData, organization: e.target.value })}
                          onBlur={() => setTouched(prev => ({ ...prev, organization: true }))}
                          placeholder="e.g. Delhi Public School / St. Joseph's"
                          className={`w-full h-11 bg-white/[0.06] border rounded-xl pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0162b1]/60 focus:border-[#0162b1] focus:bg-white/[0.09] transition-all shadow-inner ${
                            touched.organization && !formData.organization.trim()
                              ? "border-[#ee1b24] ring-1 ring-[#ee1b24]/30"
                              : "border-white/15"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Submit CTA Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-3 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#0162b1] via-[#1a7fd4] to-[#0162b1] hover:from-[#014d8a] hover:to-[#0162b1] text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-[#0162b1]/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Confirming Registration...</span>
                        </>
                      ) : (
                        <>
                          <span>Register & Unlock Google Meet</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-center text-slate-400 pt-1 flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3 text-emerald-400" />
                      <span>Zero spam guarantee. Secured by Educare Privacy Shield.</span>
                    </p>
                  </form>
                </div>
              ) : (
                /* Unlocked State / Google Meet Room Access Station */
                <div className="space-y-6 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-in zoom-in-90 duration-300">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                      Pass Confirmed
                    </span>
                    <h2 className="text-2xl font-black text-white">Registration Complete!</h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                      Welcome, <span className="text-white font-bold">{formData.name || "Attendee"}</span>. Your attendee pass has been verified.
                    </p>
                  </div>

                  {/* Primary Join Button */}
                  {meetUrl ? (
                    <div className="space-y-3 pt-2">
                      <a
                        href={meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm tracking-wide shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Video className="h-5 w-5" />
                        <span>Launch Google Meet</span>
                        <ExternalLink className="h-4 w-4 ml-1 opacity-80" />
                      </a>

                      <button
                        onClick={handleCopyLink}
                        className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-300" />}
                        <span>{copied ? "Meeting URL Copied to Clipboard!" : "Copy Google Meet Link"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200">
                      The faculty will launch the Google Meet session shortly before scheduled start time. Please refresh this page.
                    </div>
                  )}

                  {/* Calendar Invite Option */}
                  {googleCalendarUrl && (
                    <a
                      href={googleCalendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-[#1a7fd4] hover:text-blue-300 font-semibold underline underline-offset-4 transition-colors"
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Add to Google Calendar
                    </a>
                  )}

                  {/* Attendee Etiquette & Guidelines */}
                  <div className="text-left bg-black/40 border border-white/10 rounded-2xl p-4 text-[11px] text-slate-300 space-y-2">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-[#1a7fd4]" />
                      Webinar Guidelines:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>Please keep your microphone muted upon entry.</li>
                      <li>Use the Google Meet in-call chat box to ask questions.</li>
                      <li>Your registration is saved locally so you can easily rejoin anytime.</li>
                    </ul>
                  </div>

                  {/* Switch Attendee */}
                  <button
                    onClick={handleResetRegistration}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors pt-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Register a different attendee</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Institutional Brand Footer */}
      <footer className="relative z-20 px-6 py-4 border-t border-white/10 text-center text-xs text-slate-400 backdrop-blur-md">
        <p>© {new Date().getFullYear()} Educare Group of Institutions. All rights reserved. Powered by Educare LMS.</p>
      </footer>
    </div>
  );
}
