"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import logoImage from "@/logos/logo1-clean.png";

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
  achievers?: RankHolder[];
}

function getPublicApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.educarelearning.in/api";
  const cleanBase = rawUrl.replace(/\/+$/, "");
  return cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
}

/**
 * ── RANK HOLDERS & ACHIEVERS TICKER DATA ──
 * Add, edit, or remove students here.
 * - name: Student's full name
 * - rankOrScore: e.g. "AIR 42", "99.85 %ile", "State Rank 1"
 * - examOrCourse: e.g. "JEE Advanced", "NEET-UG", "KEAM"
 * - imageUrl: (Optional) URL or path to student's photo (e.g. "/students/rahul.jpg" or "https://...")
 *             If left empty or omitted, a clean initial avatar is automatically generated.
 * - badgeColor: (Optional) "#0162b1" (blue) | "#ee1b24" (red)
 */
export interface RankHolder {
  id: string;
  name: string;
  rankOrScore: string;
  examOrCourse: string;
  imageUrl?: string;
  badgeColor?: "#0162b1" | "#ee1b24" | string;
}

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

  const [timeLeft, setTimeLeft] = useState<{
    days: number; hours: number; minutes: number; seconds: number; isStarted: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: false });

  // Restore from localStorage
  useEffect(() => {
    if (!id) return;
    try {
      const stored = localStorage.getItem(`live_access_${id}`);
      if (stored) {
        const p = JSON.parse(stored);
        if (p.meetUrl) {
          setMeetUrl(p.meetUrl);
          setRegistered(true);
          if (p.name) setFormData(prev => ({ ...prev, name: p.name, email: p.email || "", phone: p.phone || "", organization: p.organization || "" }));
        }
      }
    } catch { /* ignore */ }
  }, [id]);

  // Fetch webinar info
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${getPublicApiUrl()}/live-class/public/${id}`);
        if (!res.ok) throw new Error(res.status === 404 ? "This session is not available to the public." : "Failed to load session. Please refresh.");
        setWebinar(await res.json());
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Countdown
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
    if (!n) { setSubmitError("Full name is required."); return; }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setSubmitError("A valid email address is required."); return; }
    if (!ph || ph.replace(/\D/g, "").length < 7) { setSubmitError("A valid mobile number is required."); return; }
    if (!org) { setSubmitError("Institution / organization name is required."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const res = await fetch(`${getPublicApiUrl()}/live-class/public/${id}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, email: em, phone: ph, organization: org, honeypot: formData.honeypot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed. Please try again.");
      setMeetUrl(data.meetUrl); setRegistered(true);
      localStorage.setItem(`live_access_${id}`, JSON.stringify({ meetUrl: data.meetUrl, name: n, email: em, phone: ph, organization: org }));
    } catch (e: any) { setSubmitError(e.message || "Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleCopy = () => { if (!meetUrl) return; navigator.clipboard.writeText(meetUrl); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  const handleReset = () => { if (confirm("Register with a different profile?")) { localStorage.removeItem(`live_access_${id}`); setRegistered(false); setMeetUrl(null); setFormData({ name: "", email: "", phone: "", organization: "", honeypot: "" }); setTouched({ name: false, email: false, phone: false, organization: false }); } };

  const calUrl = useMemo(() => {
    if (!webinar) return "";
    try {
      const s = new Date(webinar.scheduledAt), e2 = new Date(s.getTime() + (webinar.duration || 60) * 60000);
      const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(webinar.title)}&dates=${fmt(s)}/${fmt(e2)}&details=${encodeURIComponent((webinar.description || "") + "\n\nJoin: " + (meetUrl || ""))}&location=${encodeURIComponent(meetUrl || "Google Meet")}`;
    } catch { return ""; }
  }, [webinar, meetUrl]);

  // ─── Shared bg style ───
  const bgStyle: React.CSSProperties = webinar?.backgroundImageUrl
    ? { backgroundImage: `url("${webinar.backgroundImageUrl}")`, backgroundSize: "cover", backgroundPosition: "center right", backgroundRepeat: "no-repeat" }
    : {};

  // ─── Loading ───
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#040f1e" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(1,98,177,0.2)", borderTopColor: "#0162b1", animation: "spin 0.9s linear infinite" }} />
        <p style={{ fontSize: "12px", color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Loading…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── Error ───
  if (error || !webinar) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#040f1e" }}>
      <div style={{ maxWidth: "420px", width: "100%", background: "#0a1628", border: "1px solid rgba(238,27,36,0.25)", borderRadius: "16px", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "rgba(238,27,36,0.1)", border: "1px solid rgba(238,27,36,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="24" height="24" fill="none" stroke="#ee1b24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 style={{ color: "white", fontWeight: 700, fontSize: "18px", marginBottom: "10px" }}>Session Unavailable</h2>
        <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, marginBottom: "28px" }}>{error || "This live session is private or no longer available."}</p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px", borderRadius: "8px", background: "#0162b1", color: "white", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Return to Educare LMS</a>
      </div>
    </div>
  );

  const scheduledDate = new Date(webinar.scheduledAt);
  const fmtDate = scheduledDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  const fmtTime = scheduledDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const isLive = webinar.status === "LIVE" || timeLeft.isStarted;
  const isEnded = webinar.status === "ENDED";
  const rankHolders = webinar.achievers || [];

  const fieldError = {
    name: touched.name && !formData.name.trim(),
    email: touched.email && (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())),
    phone: touched.phone && (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 7),
    org: touched.organization && !formData.organization.trim(),
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", ...bgStyle }}>

      {/* ── Directional overlay: dark on left → transparent on right ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: webinar.backgroundImageUrl
          ? "linear-gradient(to right, rgba(4,15,30,0.97) 0%, rgba(4,15,30,0.95) 38%, rgba(4,15,30,0.75) 58%, rgba(4,15,30,0.25) 78%, transparent 100%)"
          : "linear-gradient(135deg, #040f1e 0%, #071a34 100%)",
      }} />

      {/* ── HEADER ── */}
      <header style={{ position: "relative", zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              background: "white",
              borderRadius: "12px",
              padding: "8px 18px",
              boxShadow: "0 2px 16px rgba(1,98,177,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Image
                src={logoImage}
                alt="Educare Group of Institutions"
                width={240}
                height={58}
                style={{ height: "50px", width: "auto", objectFit: "contain", display: "block" }}
                priority
              />
            </div>
          </div>

          {/* Status badge */}
          {isLive ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "100px", background: "rgba(238,27,36,0.15)", border: "1px solid rgba(238,27,36,0.35)", color: "#fca5a5", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ee1b24", display: "inline-block", animation: "pulse 1.4s ease-in-out infinite", boxShadow: "0 0 8px #ee1b24" }} />
              LIVE NOW
            </div>
          ) : isEnded ? (
            <div style={{ padding: "6px 16px", borderRadius: "100px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.4)", color: "#64748b", fontSize: "11px", fontWeight: 600 }}>
              Session Ended
            </div>
          ) : (
            <div style={{ padding: "6px 16px", borderRadius: "100px", background: "rgba(1,98,177,0.15)", border: "1px solid rgba(1,98,177,0.35)", color: "#93c5fd", fontSize: "11px", fontWeight: 600 }}>
              Upcoming Webinar
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="relative z-20 flex-1 max-w-[1240px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Main Content Column */}
          <div className="lg:col-span-7 max-w-[640px] w-full">

            {/* ── Dedicated Mobile Landscape Poster Showcase ── */}
            {webinar.backgroundImageUrl && (
              <div className="block lg:hidden mb-6 rounded-2xl overflow-hidden border border-white/15 bg-slate-950/85 shadow-2xl">
                <img
                  src={webinar.backgroundImageUrl}
                  alt={webinar.title}
                  className="w-full h-auto max-h-[380px] object-contain mx-auto block"
                />
              </div>
            )}

            {/* Subject tag */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "6px", background: "rgba(1,98,177,0.15)", border: "1px solid rgba(1,98,177,0.3)", color: "#60a5fa", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0162b1", display: "inline-block" }} />
              {webinar.subject}
            </div>

          {/* Title */}
          <h1 style={{ color: "white", fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            {webinar.title}
          </h1>

          {/* Thin red accent line */}
          <div style={{ width: "48px", height: "3px", background: "#ee1b24", borderRadius: "2px", marginBottom: "24px" }} />

          {/* Description */}
          {webinar.description && (
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, marginBottom: "28px", maxWidth: "520px" }}>
              {webinar.description}
            </p>
          )}

          {/* Meta info — compact horizontal list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
            {[
              { label: "Speaker", value: webinar.teacherName },
              { label: "Date & Time", value: `${fmtDate} · ${fmtTime} IST` },
              { label: "Duration", value: `${webinar.duration} minutes · Google Meet` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0162b1", minWidth: "84px" }}>{label}</span>
                <span style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Countdown */}
          {!timeLeft.isStarted && !isEnded && (
            <div style={{ marginBottom: "36px" }}>
              <p style={{ fontSize: "10px", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "12px" }}>Starts in</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { label: "Days", v: timeLeft.days },
                  { label: "Hrs", v: timeLeft.hours },
                  { label: "Min", v: timeLeft.minutes },
                  { label: "Sec", v: timeLeft.seconds },
                ].map(({ label, v }) => (
                  <div key={label} style={{ textAlign: "center", minWidth: "54px" }} className="flex-1 sm:flex-initial sm:min-w-[64px]">
                    <div style={{ background: "rgba(1,98,177,0.12)", border: "1px solid rgba(1,98,177,0.2)", borderRadius: "10px", padding: "12px 6px", marginBottom: "6px" }}>
                      <span style={{ color: "white", fontSize: "24px", fontWeight: 800, fontFamily: "ui-monospace,monospace", lineHeight: 1 }}>{String(v).padStart(2, "0")}</span>
                    </div>
                    <span style={{ fontSize: "9px", color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REGISTRATION FORM / CONFIRMED CARD ── */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            overflow: "hidden",
          }}>

            {/* Blue top accent line */}
            <div style={{ height: "3px", background: "linear-gradient(90deg, #0162b1, #1a7fd4)" }} />

            <div style={{ padding: "28px 28px 32px" }}>

              {!registered ? (
                <>
                  <h2 style={{ color: "white", fontSize: "17px", fontWeight: 700, marginBottom: "4px" }}>Register to Join</h2>
                  <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "24px", lineHeight: 1.5 }}>
                    Enter your details to receive the Google Meet access link.
                  </p>

                  {submitError && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", background: "rgba(238,27,36,0.08)", border: "1px solid rgba(238,27,36,0.25)", marginBottom: "18px" }}>
                      <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#ee1b24", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 500 }}>{submitError}</span>
                    </div>
                  )}

                  {/* Honeypot */}
                  <input type="text" name="website" value={formData.honeypot} onChange={e => setFormData({ ...formData, honeypot: e.target.value })} style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

                  <form onSubmit={handleSubmit}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>

                      {/* Full Name */}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label htmlFor="f-name" style={labelStyle}>Full Name <span style={{ color: "#ee1b24" }}>*</span></label>
                        <input
                          id="f-name" type="text" required autoComplete="name"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          onBlur={() => setTouched(t => ({ ...t, name: true }))}
                          placeholder="Your full name"
                          style={inputStyle(fieldError.name)}
                        />
                        {fieldError.name && <p style={errorHint}>Full name is required.</p>}
                      </div>

                      {/* Email */}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label htmlFor="f-email" style={labelStyle}>Email Address <span style={{ color: "#ee1b24" }}>*</span></label>
                        <input
                          id="f-email" type="email" required autoComplete="email"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          onBlur={() => setTouched(t => ({ ...t, email: true }))}
                          placeholder="you@example.com"
                          style={inputStyle(fieldError.email)}
                        />
                        {fieldError.email && <p style={errorHint}>A valid email is required.</p>}
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="f-phone" style={labelStyle}>WhatsApp / Mobile <span style={{ color: "#ee1b24" }}>*</span></label>
                        <input
                          id="f-phone" type="tel" required autoComplete="tel"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          onBlur={() => setTouched(t => ({ ...t, phone: true }))}
                          placeholder="+91 98765 43210"
                          style={inputStyle(fieldError.phone)}
                        />
                        {fieldError.phone && <p style={errorHint}>Valid mobile required.</p>}
                      </div>

                      {/* Organization */}
                      <div>
                        <label htmlFor="f-org" style={labelStyle}>School / College <span style={{ color: "#ee1b24" }}>*</span></label>
                        <input
                          id="f-org" type="text" required
                          value={formData.organization}
                          onChange={e => setFormData({ ...formData, organization: e.target.value })}
                          onBlur={() => setTouched(t => ({ ...t, organization: true }))}
                          placeholder="Your institution"
                          style={inputStyle(fieldError.org)}
                        />
                        {fieldError.org && <p style={errorHint}>Institution name required.</p>}
                      </div>

                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        width: "100%", height: "46px", borderRadius: "10px", border: "none", cursor: submitting ? "not-allowed" : "pointer",
                        background: submitting ? "rgba(1,98,177,0.5)" : "#0162b1",
                        color: "white", fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        transition: "background 0.2s, opacity 0.2s",
                        boxShadow: "0 4px 16px rgba(1,98,177,0.35)",
                      }}
                    >
                      {submitting ? (
                        <>
                          <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                          Confirming…
                        </>
                      ) : "Register & Get Meeting Link"}
                    </button>
                  </form>
                </>
              ) : (
                /* ── Confirmed State ── */
                <>
                  {/* Success header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="22" height="22" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: "10px", color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "2px" }}>Registered</p>
                      <h2 style={{ color: "white", fontSize: "17px", fontWeight: 700 }}>You're confirmed, {formData.name.split(" ")[0]}!</h2>
                    </div>
                  </div>

                  {/* Meet link or waiting */}
                  {meetUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <a
                        href={meetUrl} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "46px", borderRadius: "10px", background: "#0162b1", color: "white", fontSize: "13px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(1,98,177,0.35)", transition: "opacity 0.2s" }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        Join Google Meet
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>

                      <button
                        onClick={handleCopy}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "40px", borderRadius: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: copied ? "#34d399" : "#94a3b8", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                      >
                        {copied ? (
                          <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Link Copied!</>
                        ) : (
                          <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Meeting Link</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: "14px 16px", borderRadius: "8px", background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", color: "#fcd34d", fontSize: "12px", lineHeight: 1.6 }}>
                      The meeting link will be available shortly before the session begins. Please refresh this page.
                    </div>
                  )}

                  {/* Calendar + switch */}
                  <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {calUrl ? (
                      <a href={calUrl} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#0162b1", fontWeight: 600, textDecoration: "none" }}>
                        + Add to Calendar
                      </a>
                    ) : <span />}
                    <button onClick={handleReset} style={{ fontSize: "11px", color: "#475569", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                      Different attendee?
                    </button>
                  </div>

                  {/* Guidelines */}
                  <div style={{ marginTop: "20px", padding: "14px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Session Guidelines</p>
                    <ul style={{ fontSize: "11px", color: "#475569", lineHeight: 1.8, listStyle: "none", padding: 0, margin: 0 }}>
                      {["Join with your microphone muted.", "Use in-call chat for questions.", "Your access is saved — just refresh to rejoin."].map(t => (
                        <li key={t} style={{ display: "flex", gap: "8px" }}><span style={{ color: "#0162b1" }}>—</span>{t}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

          {/* ── Desktop Right Column: Crisp Official Poster Showcase ── */}
          {webinar.backgroundImageUrl && (
            <div className="hidden lg:block lg:col-span-5 sticky top-24">
              <div className="rounded-2xl overflow-hidden border border-white/15 bg-slate-950/75 backdrop-blur-xl shadow-2xl p-3">
                <img
                  src={webinar.backgroundImageUrl}
                  alt={webinar.title}
                  className="w-full h-auto max-h-[580px] object-contain rounded-xl mx-auto block"
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── BROAD ROLLING ACHIEVER POSTERS SHOWCASE ── */}
      {rankHolders.length > 0 && (
        <section
          aria-label="Star Achievers & Posters"
          style={{
            position: "relative",
            zIndex: 20,
            background: "rgba(4, 15, 30, 0.84)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            padding: "16px 0",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Left pinned title badge - responsive for small screens */}
          <div
            className="hidden sm:flex flex-col justify-center shrink-0 border-r border-white/10 z-10 bg-[#040f1e]/95 h-[160px] px-4 sm:px-6"
            style={{
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#ee1b24",
                  boxShadow: "0 0 10px #ee1b24",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#93c5fd",
                  whiteSpace: "nowrap",
                }}
              >
                Top Achievers
              </span>
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "white", whiteSpace: "nowrap" }}>
              Hall of Fame
            </span>
            <span style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap" }}>
              Educare Rank Holders
            </span>
          </div>

          {/* Marquee viewport with gradient fade edges */}
          <div
            className="marquee-container"
            style={{
              position: "relative",
              flex: 1,
              overflow: "hidden",
              maskImage: "linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)",
            }}
          >
            <div
              className="marquee-track"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                width: "max-content",
              }}
            >
              {/* Duplicated list creates a seamless continuous infinite loop */}
              {[...rankHolders, ...rankHolders].map((poster, idx) => {
                const accentColor = poster.badgeColor || (idx % 2 === 0 ? "#0162b1" : "#ee1b24");

                return (
                  <div
                    key={`${poster.id}-${idx}`}
                    className="poster-card"
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      height: "160px",
                      position: "relative",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)",
                      transition: "transform 0.2s ease, border-color 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    {poster.imageUrl ? (
                      <img
                        src={poster.imageUrl}
                        alt={poster.name || "Achiever Poster"}
                        loading="lazy"
                        style={{
                          height: "160px",
                          width: "auto",
                          maxWidth: "280px",
                          objectFit: "contain",
                          display: "block",
                          borderRadius: "12px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "180px",
                          height: "160px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "16px",
                          textAlign: "center",
                          background: `linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(4,15,30,0.8) 100%)`,
                        }}
                      >
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: accentColor === "#ee1b24" ? "rgba(238,27,36,0.15)" : "rgba(1,98,177,0.15)",
                            border: `1.5px solid ${accentColor}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 800,
                            fontSize: "14px",
                            marginBottom: "8px",
                          }}
                        >
                          ★
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                          {poster.name}
                        </span>
                        {poster.examOrCourse && (
                          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                            {poster.examOrCourse}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Floating rank badge if available */}
                    {poster.rankOrScore && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "100px",
                          background: accentColor === "#ee1b24" ? "rgba(238,27,36,0.9)" : "rgba(1,98,177,0.9)",
                          color: "white",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {poster.rankOrScore}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ position: "relative", zIndex: 20, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 32px", textAlign: "center", fontSize: "11px", color: "#334155" }}>
        © {new Date().getFullYear()} Educare Group of Institutions · Powered by Educare LMS
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee 35s linear infinite;
        }
        .marquee-container:hover .marquee-track {
          animation-play-state: paused;
        }
        .poster-card:hover {
          transform: translateY(-2px);
          border-color: rgba(1, 98, 177, 0.6) !important;
        }
        input::placeholder { color: #334155; }
        input:focus { outline: none; }
        a:hover { opacity: 0.85; }
        button:hover:not(:disabled) { opacity: 0.88; }
      `}</style>
    </div>
  );
}

/* ── Style helpers ── */
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px",
};

function inputStyle(isError?: boolean): React.CSSProperties {
  return {
    width: "100%", height: "40px", borderRadius: "8px", padding: "0 12px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${isError ? "rgba(238,27,36,0.45)" : "rgba(255,255,255,0.1)"}`,
    color: "white", fontSize: "13px", fontWeight: 400, boxSizing: "border-box",
    outline: "none", transition: "border 0.15s",
  };
}

const errorHint: React.CSSProperties = {
  fontSize: "11px", color: "#f87171", marginTop: "4px", fontWeight: 500,
};
