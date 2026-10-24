"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";
import {
  Video, Calendar, Clock, User, Mail, Phone, Building,
  CheckCircle2, Copy, Check, ExternalLink, AlertCircle,
  ArrowRight, ShieldCheck, Sparkles, Radio, HelpCircle,
  CalendarPlus, MessageSquare
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

export default function PublicLiveClassPage() {
  const params = useParams();
  const id = params?.id as string;

  const [webinar, setWebinar] = useState<PublicWebinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form & Access states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    honeypot: "",
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

  // 1. Check local storage for existing registration
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
            setFormData(prev => ({ ...prev, name: parsed.name, email: parsed.email || "" }));
          }
        }
      }
    } catch {
      // ignore JSON errors
    }
  }, [id]);

  // 2. Fetch public webinar data
  useEffect(() => {
    if (!id) return;
    const fetchPublicInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${apiUrl}/live-class/public/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This live class or webinar was not found or is not open to the public.");
          }
          throw new Error("Failed to load live session details. Please try again.");
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

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setSubmitError("Please fill in your full name and valid email address.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/live-class/public/${id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register. Please check your details.");
      }

      setMeetUrl(data.meetUrl);
      setRegistered(true);

      // Save to localStorage for browser session persistence
      localStorage.setItem(
        `live_access_${id}`,
        JSON.stringify({
          meetUrl: data.meetUrl,
          name: formData.name,
          email: formData.email,
          registeredAt: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!meetUrl) return;
    navigator.clipboard.writeText(meetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="h-6 w-6 text-indigo-400" />
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-slate-300 tracking-wide">Loading webinar room...</p>
      </div>
    );
  }

  if (error || !webinar) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Webinar Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          {error || "This live session is private or no longer available."}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur border border-white/10 transition-colors"
        >
          Return to Educare
        </a>
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
      className="min-h-screen relative flex flex-col justify-between bg-cover bg-center bg-no-repeat selection:bg-indigo-500 selection:text-white"
      style={{
        backgroundImage: webinar.backgroundImageUrl
          ? `url("${webinar.backgroundImageUrl}")`
          : "radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
      }}
    >
      {/* Dynamic Ambient Blur & Dark Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/85 backdrop-blur-[2px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-40 sm:w-48 h-10 rounded-xl bg-white/95 px-3 py-1 shadow-lg backdrop-blur flex items-center justify-center overflow-hidden">
            <Image
              src={logoImage}
              alt="Educare LMS"
              width={180}
              height={38}
              className="object-contain w-full h-full scale-[1.1]"
              priority
            />
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {isLiveNow ? (
            <span className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-red-950/40 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              LIVE NOW
            </span>
          ) : isEnded ? (
            <span className="bg-slate-800/80 border border-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
              Session Concluded
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Upcoming Webinar
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-20 max-w-7xl mx-auto w-full px-6 py-8 md:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Column: Webinar Information */}
          <div className="lg:col-span-7 space-y-6 text-white">
            {/* Subject badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <Radio className="h-3.5 w-3.5" />
              {webinar.subject}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.15] drop-shadow-md">
              {webinar.title}
            </h1>

            {/* Description / Agenda */}
            {webinar.description && (
              <p className="text-slate-200 text-sm md:text-base leading-relaxed max-w-2xl bg-black/30 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                {webinar.description}
              </p>
            )}

            {/* Host & Timing Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-3.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Session Speaker</p>
                  <p className="text-sm font-bold text-white">{webinar.teacherName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Duration & Platform</p>
                  <p className="text-sm font-bold text-white">{webinar.duration} Minutes • Google Meet</p>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Scheduled Time</p>
                  <p className="text-sm font-bold text-white">
                    {formattedDate} at {formattedTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Countdown Clock */}
            {!timeLeft.isStarted && !isEnded && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-3">
                  Session Begins In:
                </p>
                <div className="flex items-center gap-2 sm:gap-3">
                  {[
                    { label: "Days", value: timeLeft.days },
                    { label: "Hours", value: timeLeft.hours },
                    { label: "Mins", value: timeLeft.minutes },
                    { label: "Secs", value: timeLeft.seconds },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex-1 max-w-[80px] bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-2.5 text-center shadow-lg"
                    >
                      <p className="text-xl sm:text-2xl font-black text-white font-mono">
                        {String(value).padStart(2, "0")}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Registration Card OR Unlocked Live Room */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

              {!registered ? (
                /* Registration Form */
                <div>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold mb-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      Free & Open Access
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Register to Join Live</h2>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Please enter your details below to unlock instant access to the Google Meet session.
                    </p>
                  </div>

                  {submitError && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
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

                    {/* Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Full Name <span className="text-indigo-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. John Doe"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Email Address <span className="text-indigo-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="john@example.com"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        WhatsApp / Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Organization / School */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        School / College / Organization
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.organization}
                          onChange={e => setFormData({ ...formData, organization: e.target.value })}
                          placeholder="e.g. St. Xavier's High School"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Securing Your Access...</span>
                        </>
                      ) : (
                        <>
                          <span>Unlock Google Meet Link</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* Unlocked State / Google Meet Room Access */
                <div className="space-y-6 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-white">Registration Confirmed!</h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                      Welcome, <span className="text-white font-semibold">{formData.name || "Attendee"}</span>. Your seat is reserved.
                    </p>
                  </div>

                  {/* Primary Join Button */}
                  {meetUrl ? (
                    <div className="space-y-3">
                      <a
                        href={meetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Video className="h-5 w-5" />
                        <span>Join Google Meet Now</span>
                        <ExternalLink className="h-4 w-4 ml-1 opacity-80" />
                      </a>

                      <button
                        onClick={handleCopyLink}
                        className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-300" />}
                        <span>{copied ? "Meeting Link Copied!" : "Copy Google Meet Link"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                      The host will launch the Google Meet link shortly before start time. Please refresh this page.
                    </div>
                  )}

                  {/* Calendar Invite Option */}
                  {googleCalendarUrl && (
                    <a
                      href={googleCalendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-medium underline underline-offset-4 transition-colors"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Add to Google Calendar
                    </a>
                  )}

                  {/* Attendee Etiquette / Guidelines */}
                  <div className="text-left bg-black/40 border border-white/10 rounded-2xl p-4 text-[11px] text-slate-300 space-y-2">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
                      Session Guidelines:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li>Please keep your microphone muted when joining.</li>
                      <li>Use the chat room for questions during the live Q&A.</li>
                      <li>Access will remain saved in this browser if you refresh.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 px-6 py-4 border-t border-white/10 text-center text-xs text-slate-400 backdrop-blur-md">
        <p>© {new Date().getFullYear()} Educare Group of Institutions. Powered by Educare LMS.</p>
      </footer>
    </div>
  );
}
