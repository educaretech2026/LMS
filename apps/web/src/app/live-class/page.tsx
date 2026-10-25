"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import {
  Video, Plus, Calendar, Clock, Users, Play, X, Wifi, BookOpen,
  RefreshCw, Trash2, Radio, CheckCircle2, AlertCircle, Globe,
  Copy, Check, ExternalLink, Image as ImageIcon, UploadCloud,
  Download, Search, Sparkles
} from "lucide-react";

/* ── Types ── */
interface ApiLiveClass {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt: string;
  duration: number;
  roomId: string;
  isPublic?: boolean;
  description?: string | null;
  backgroundImageUrl?: string | null;
  board?: { id: string; name: string } | null;
  standard?: { id: string; name: string } | null;
  centre?: { id: string; name: string } | null;
}

interface SetupOption { id: string; name: string }

interface Registration {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  registeredAt: string;
}

/* ── Page ── */
export default function LiveClassPage() {
  const [classes, setClasses] = useState<ApiLiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleClass, setShowScheduleClass] = useState(false);
  const [showHostWebinar, setShowHostWebinar] = useState(false);
  const [selectedRegistrationsClass, setSelectedRegistrationsClass] = useState<ApiLiveClass | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "CLASSES" | "WEBINARS">("ALL");
  const [stats, setStats] = useState({ total: 0, live: 0 });
  const { role, email } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        fetchApi<ApiLiveClass[]>("/live-class"),
        fetchApi<{ total: number; live: number }>("/live-class/stats"),
      ]);
      setClasses(data);
      setStats(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: "SCHEDULED" | "LIVE" | "ENDED") => {
    try {
      await fetchApi(`/live-class/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: any) {
      alert(`Failed to update status: ${e.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await fetchApi(`/live-class/${id}`, { method: "DELETE" });
      setClasses(prev => prev.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const handleScheduled = (cls: ApiLiveClass) => {
    setClasses(prev => [...prev, cls]);
    setStats(prev => ({ ...prev, total: prev.total + 1 }));
    setShowScheduleClass(false);
    setShowHostWebinar(false);
  };

  /* ── Join Class ── */
  const handleJoin = (cls: ApiLiveClass) => {
    let url = cls.roomId;
    if (!url.startsWith('http')) {
      alert("Invalid Google Meet link provided for this class.");
      return;
    }
    window.open(url, "_blank");
  };

  // Filter based on active tab
  const filteredClasses = classes.filter(cls => {
    if (activeTab === "CLASSES") return !cls.isPublic;
    if (activeTab === "WEBINARS") return Boolean(cls.isPublic);
    return true;
  });

  const liveClasses = filteredClasses.filter(c => c.status === "LIVE");
  const scheduledClasses = filteredClasses.filter(c => c.status === "SCHEDULED");
  const endedClasses = filteredClasses.filter(c => c.status === "ENDED");

  const totalClassesCount = classes.filter(c => !c.isPublic).length;
  const totalWebinarsCount = classes.filter(c => c.isPublic).length;

  return (
    <DashboardLayout title="Live Class">
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 lg:px-8 py-5 border-b border-border-soft bg-white gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-blue/8 flex items-center justify-center">
              <Video className="h-4.5 w-4.5 text-brand-blue" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Live Classes & Webinars</h2>
              <p className="text-xs text-text-muted mt-0.5">Powered by Google Meet</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={load}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 text-text-secondary hover:bg-surface-3 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {role?.toUpperCase() !== "STUDENT" && (
              <>
                {/* Host Public Webinar Button */}
                <button
                  onClick={() => setShowHostWebinar(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-indigo-600" /> Host Public Webinar
                </button>

                {/* Schedule Regular Class Button */}
                <button
                  onClick={() => setShowScheduleClass(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Schedule Class
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl bg-brand-red/8 border border-brand-red/20 px-4 py-3 text-sm text-brand-red">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button onClick={load} className="ml-auto text-xs font-semibold underline">Retry</button>
            </div>
          )}

          {/* Stats row — Admin only */}
          {role?.toUpperCase() !== "STUDENT" && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Sessions",   value: String(stats.total), icon: BookOpen, color: "text-brand-blue bg-brand-blue/8" },
                { label: "Live Now",         value: String(stats.live),  icon: Wifi,     color: "text-brand-red  bg-brand-red/8"  },
                { label: "Scheduled Today",  value: String(scheduledClasses.length), icon: Calendar, color: "text-success bg-success/8" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-xl border border-border-soft p-5 shadow-sm">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold text-text-primary mt-3 tracking-tight">{value}</p>
                  <p className="text-[11px] font-medium text-text-muted mt-0.5 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-border-soft pb-3">
            {[
              { id: "ALL", label: `All Sessions (${classes.length})` },
              { id: "CLASSES", label: `Cohort Classes (${totalClassesCount})` },
              { id: "WEBINARS", label: `Public Webinars (${totalWebinarsCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-brand-blue text-white shadow-sm font-semibold"
                    : "bg-surface-2 text-text-secondary hover:bg-surface-3"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-border-soft p-5 h-20 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && (
            <>
              {/* Live Now */}
              {liveClasses.length > 0 && (
                <Section title="🔴 Live Now">
                  {liveClasses.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      role={role}
                      onJoin={() => handleJoin(cls)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onViewRegistrations={() => setSelectedRegistrationsClass(cls)}
                    />
                  ))}
                </Section>
              )}

              {/* Scheduled */}
              <Section title="Upcoming Sessions">
                {scheduledClasses.length === 0 ? (
                  <EmptyState
                    text={
                      role?.toUpperCase() === "STUDENT"
                        ? "No upcoming classes scheduled."
                        : activeTab === "WEBINARS"
                        ? "No upcoming public webinars. Click 'Host Public Webinar' to create one!"
                        : "No upcoming classes. Schedule a class or host a webinar above!"
                    }
                  />
                ) : (
                  scheduledClasses.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      role={role}
                      onJoin={() => handleJoin(cls)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onViewRegistrations={() => setSelectedRegistrationsClass(cls)}
                    />
                  ))
                )}
              </Section>

              {/* Ended */}
              {endedClasses.length > 0 && (
                <Section title="Past Sessions">
                  {endedClasses.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      role={role}
                      onJoin={() => handleJoin(cls)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onViewRegistrations={() => setSelectedRegistrationsClass(cls)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}

          {/* Restored Original Edu-Meet Banner */}
          <div className="mt-8 rounded-3xl bg-gradient-to-br from-brand-blue-dark via-brand-blue to-brand-blue-light p-8 md:p-12 shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center">
            {/* Background Decorations */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full border-[32px] border-white" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full border-[16px] border-white" />
              <div className="absolute top-1/2 left-1/4 w-96 h-96 rounded-full border-[4px] border-white -translate-y-1/2" />
            </div>

            <div className="h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner relative z-10 border border-white/30">
              <Video className="h-8 w-8 text-white" />
            </div>

            <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight relative z-10 mb-3">
              Edu-Meet is Rolling Out Soon!
            </h3>
            <p className="text-white/80 max-w-xl text-sm md:text-base font-medium relative z-10 leading-relaxed">
              We are upgrading your live classes. Get ready for a seamless, lightning-fast, and integrated meeting experience built directly into your LMS. Stay tuned!
            </p>
          </div>

        </div>
      </div>

      {/* Schedule Cohort Class Modal */}
      {showScheduleClass && (
        <ScheduleClassModal
          onClose={() => setShowScheduleClass(false)}
          onScheduled={handleScheduled}
          email={email}
        />
      )}

      {/* Host Public Webinar Modal (No Board / Standard / Centre) */}
      {showHostWebinar && (
        <HostWebinarModal
          onClose={() => setShowHostWebinar(false)}
          onScheduled={handleScheduled}
          email={email}
        />
      )}

      {/* Attendee Registrations Modal */}
      {selectedRegistrationsClass && (
        <RegistrationsModal
          cls={selectedRegistrationsClass}
          onClose={() => setSelectedRegistrationsClass(null)}
        />
      )}
    </DashboardLayout>
  );
}

/* ── Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-border-soft p-10 text-center">
      <Video className="h-8 w-8 text-text-muted mx-auto mb-2" />
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}

/* ── Class Card ── */
function ClassCard({
  cls, role, onJoin, onStatusChange, onDelete, onViewRegistrations,
}: {
  cls: ApiLiveClass;
  role: string | null;
  onJoin: () => void;
  onStatusChange: (id: string, status: "SCHEDULED" | "LIVE" | "ENDED") => void;
  onDelete: (id: string) => void;
  onViewRegistrations: () => void;
}) {
  const isLive = cls.status === "LIVE";
  const isEnded = cls.status === "ENDED";
  const isStudent = role?.toUpperCase() === "STUDENT";
  const [copied, setCopied] = useState(false);

  const scheduledDate = new Date(cls.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const handleCopyPublicLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const publicUrl = `${window.location.origin}/live/${cls.id}`;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-5 transition-all ${
      isLive ? "border-brand-red/30 shadow-red-50/50" : isEnded ? "border-border-soft opacity-70" : "border-border-soft"
    }`}>
      {/* Icon / Thumbnail */}
      <div className="relative">
        {cls.backgroundImageUrl ? (
          <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-border-soft bg-surface-2">
            <img src={cls.backgroundImageUrl} alt={cls.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${
            isLive ? "bg-brand-red/10" : isEnded ? "bg-surface-3" : "bg-brand-blue/8"
          }`}>
            {isLive ? <Wifi className="h-5 w-5 text-brand-red" /> :
             isEnded ? <CheckCircle2 className="h-5 w-5 text-text-muted" /> :
             <Video className="h-5 w-5 text-brand-blue" />}
          </div>
        )}
        {cls.isPublic && (
          <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow" title="Public Webinar">
            <Globe className="h-3 w-3" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text-primary truncate">{cls.title}</p>
          {cls.isPublic ? (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              <Globe className="h-2.5 w-2.5" /> Public Webinar
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 border border-border-soft px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              Cohort Class
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-brand-red/10 border border-brand-red/25 px-2 py-0.5 text-[10px] font-bold text-brand-red shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-red animate-pulse" /> LIVE
            </span>
          )}
          {isEnded && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-text-muted">ENDED</span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          {cls.subject} • Host: <span className="font-medium text-text-secondary">{cls.teacherName}</span>
        </p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-text-muted">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateStr}, {timeStr}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{cls.duration} min</span>
          {cls.board && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{cls.board.name}</span>}
          {cls.standard && <span className="rounded bg-brand-blue/8 text-brand-blue px-1.5 py-0.5 font-semibold">{cls.standard.name}</span>}
          {cls.centre && <span className="rounded bg-success/8 text-success px-1.5 py-0.5 font-semibold">{cls.centre.name}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
        {/* Public Webinar Actions for Admin/Teacher */}
        {!isStudent && cls.isPublic && (
          <>
            <button
              onClick={handleCopyPublicLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-2 hover:bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors"
              title="Copy Public Link"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied!" : "Public Link"}</span>
            </button>

            <button
              onClick={onViewRegistrations}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-2 hover:bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors"
              title="View Registered Attendees"
            >
              <Users className="h-3.5 w-3.5 text-brand-blue" />
              <span>Attendees</span>
            </button>

            <a
              href={`/live/${cls.id}`}
              target="_blank"
              rel="noreferrer"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
              title="Open Public Landing Page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        )}

        {/* Status controls */}
        {!isStudent && (
          <>
            {cls.status === "SCHEDULED" && (
              <button
                onClick={() => onStatusChange(cls.id, "LIVE")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red/8 hover:bg-brand-red/15 border border-brand-red/20 px-3 py-1.5 text-xs font-semibold text-brand-red transition-colors"
              >
                <Radio className="h-3.5 w-3.5" /> Go Live
              </button>
            )}
            {cls.status === "LIVE" && (
              <button
                onClick={() => onStatusChange(cls.id, "ENDED")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-soft px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors"
              >
                <X className="h-3.5 w-3.5" /> End
              </button>
            )}
            <button
              onClick={() => onDelete(cls.id)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 hover:border-brand-red/30 hover:text-brand-red text-text-muted transition-colors"
              title="Delete Session"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Join button */}
        {!isEnded && (
          <button
            onClick={onJoin}
            disabled={isStudent && !isLive}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors shadow-sm ${
              isStudent && !isLive
                ? "bg-surface-3 text-text-muted cursor-not-allowed"
                : isLive
                ? "bg-brand-red hover:bg-brand-red-dark text-white"
                : "bg-brand-blue hover:bg-brand-blue-dark text-white"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            {isStudent ? (isLive ? "Join" : "Waiting...") : (isLive ? "Join Live" : "Start Session")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Modal 1: Host Public Webinar (Zero Board / Standard / Centre) ── */
function HostWebinarModal({
  onClose, onScheduled, email,
}: {
  onClose: () => void;
  onScheduled: (cls: ApiLiveClass) => void;
  email: string | null;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherName, setTeacherName] = useState(email ? email.split("@")[0] : "Educare Faculty");
  const [zoomLink, setZoomLink] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const { uploadUrl, finalUrl } = (await fetchApi(
        `/storage/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      )) as any;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setBackgroundImageUrl(finalUrl);
    } catch (err: any) {
      setError("Failed to upload background banner: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !subject.trim() || !dateTime) {
      setError("Please fill in Webinar Title, Subject / Topic and Date & Time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await fetchApi<ApiLiveClass>("/live-class", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacherName: teacherName.trim() || "Host",
          scheduledAt: new Date(dateTime).toISOString(),
          duration: Number(duration) || 60,
          zoomLink: zoomLink.trim() || undefined,
          isPublic: true, // Marked as public webinar
          description: description.trim() || undefined,
          backgroundImageUrl: backgroundImageUrl.trim() || undefined,
          // No boardId, standardId, or centreId needed!
        }),
      });
      onScheduled(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-border-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Globe className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Host Public Webinar / Live Stream</h3>
              <p className="text-[11px] text-text-muted">Open to anyone via public link with lead-capturing form</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Title */}
          <Field label="Webinar Title *">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Masterclass: Cracking NEET 2026 with 99 Percentile"
              className="input-base"
            />
          </Field>

          {/* Subject & Host Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject / Topic *">
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Physics & Chemistry"
                className="input-base"
              />
            </Field>
            <Field label="Speaker / Host Name">
              <input
                type="text"
                value={teacherName}
                onChange={e => setTeacherName(e.target.value)}
                placeholder="e.g. Dr. K. Sharma"
                className="input-base"
              />
            </Field>
          </div>

          {/* Google Meet Link */}
          <Field label="Google Meet Link">
            <input
              type="url"
              value={zoomLink}
              onChange={e => setZoomLink(e.target.value)}
              placeholder="https://meet.google.com/xxx-yyyy-zzz (leave empty to auto-generate)"
              className="input-base"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Attendees unlock this Google Meet link immediately after completing your public form.
            </p>
          </Field>

          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & Time *">
              <input
                type="datetime-local"
                value={dateTime}
                onChange={e => setDateTime(e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                min="10"
                placeholder="60"
                className="input-base"
              />
            </Field>
          </div>

          {/* Description */}
          <Field label="Webinar Overview / Agenda (Optional)">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Share key takeaways, prerequisites, or topics covered in this webinar..."
              rows={3}
              className="input-base resize-none"
            />
          </Field>

          {/* Custom Background Image Uploader */}
          <Field label="Public Page Background Banner">
            {backgroundImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border-soft aspect-video bg-surface-2 group">
                <img src={backgroundImageUrl} alt="Background banner preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="cursor-pointer bg-white text-text-primary px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-surface-2 transition-colors">
                    Change Banner
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setBackgroundImageUrl("")}
                    className="bg-brand-red text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-brand-red-dark transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border-soft hover:border-indigo-400 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-surface-1 hover:bg-surface-2 transition-colors group">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2 group-hover:scale-105 transition-transform">
                  {uploadingImage ? <RefreshCw className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                </div>
                <p className="text-xs font-semibold text-text-primary">
                  {uploadingImage ? "Uploading banner to cloud..." : "Upload custom background banner"}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">PNG, JPG, or WebP (Recommended 1920x1080)</p>
              </label>
            )}
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-2">
          <button onClick={onClose} className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploadingImage}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            {submitting ? "Publishing..." : "Publish Public Webinar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal 2: Schedule Regular Cohort Class (With Board, Class, Centre) ── */
function ScheduleClassModal({
  onClose, onScheduled, email,
}: {
  onClose: () => void;
  onScheduled: (cls: ApiLiveClass) => void;
  email: string | null;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Setup options loaded from API
  const [boards, setBoards] = useState<SetupOption[]>([]);
  const [standards, setStandards] = useState<SetupOption[]>([]);
  const [centres, setCentres] = useState<SetupOption[]>([]);
  const [boardId, setBoardId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [centreId, setCentreId] = useState("");

  useEffect(() => {
    Promise.all([
      fetchApi<SetupOption[]>("/setup/boards"),
      fetchApi<SetupOption[]>("/setup/standards"),
      fetchApi<SetupOption[]>("/setup/centres"),
    ]).then(([b, s, c]) => {
      setBoards(b);
      setStandards(s);
      setCentres(c);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !subject.trim() || !dateTime) {
      setError("Please fill in Title, Subject and Date & Time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const teacherName = email ? email.split("@")[0] : "Admin";
      const created = await fetchApi<ApiLiveClass>("/live-class", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacherName,
          scheduledAt: new Date(dateTime).toISOString(),
          duration: Number(duration) || 60,
          zoomLink: zoomLink.trim() || undefined,
          isPublic: false,
          boardId: boardId || undefined,
          standardId: standardId || undefined,
          centreId: centreId || undefined,
        }),
      });
      onScheduled(created);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-border-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-brand-blue" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">Schedule Cohort Class</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Title */}
          <Field label="Class Title *">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Calculus"
              className="input-base"
            />
          </Field>

          {/* Subject */}
          <Field label="Subject *">
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              className="input-base"
            />
          </Field>

          {/* Google Meet Link */}
          <Field label="Google Meet Link (Optional)">
            <input
              type="url"
              value={zoomLink}
              onChange={e => setZoomLink(e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="input-base"
            />
          </Field>

          {/* Board / Class / Centre */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Board">
              <select value={boardId} onChange={e => setBoardId(e.target.value)} className="input-base">
                <option value="">All Boards</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Class">
              <select value={standardId} onChange={e => setStandardId(e.target.value)} className="input-base">
                <option value="">All Classes</option>
                {standards
                  .filter((s: any) => !boardId || s.boardId === boardId || (s.boards && s.boards.some((b: any) => b.boardId === boardId || b.board?.id === boardId)))
                  .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Centre">
              <select value={centreId} onChange={e => setCentreId(e.target.value)} className="input-base">
                <option value="">All Centres</option>
                {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & Time *">
              <input
                type="datetime-local"
                value={dateTime}
                onChange={e => setDateTime(e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="Duration (min)">
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                min="10"
                placeholder="60"
                className="input-base"
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-soft bg-surface-2">
          <button onClick={onClose} className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
            {submitting ? "Scheduling..." : "Schedule Class"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Attendee Registrations Modal ── */
function RegistrationsModal({
  cls, onClose,
}: {
  cls: ApiLiveClass;
  onClose: () => void;
}) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApi<{ total: number; registrations: Registration[] }>(`/live-class/${cls.id}/registrations`)
      .then(res => setRegistrations(res.registrations || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [cls.id]);

  const filtered = registrations.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    (r.phone && r.phone.includes(search)) ||
    (r.organization && r.organization.toLowerCase().includes(search.toLowerCase()))
  );

  const exportCsv = () => {
    if (!registrations.length) return;
    const headers = ["Name", "Email", "Phone", "Organization", "Registered At"];
    const rows = registrations.map(r => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${(r.phone || "").replace(/"/g, '""')}"`,
      `"${(r.organization || "").replace(/"/g, '""')}"`,
      `"${new Date(r.registeredAt).toLocaleString("en-IN")}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendees-${cls.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-border-soft overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft bg-surface-1 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Registered Attendees</h3>
              <p className="text-xs text-text-muted">{cls.title} ({registrations.length} registered)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={registrations.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-white hover:bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-50 transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" /> Export CSV
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-border-soft bg-surface-2/40 flex items-center gap-2 shrink-0">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or organization..."
            className="w-full bg-transparent border-none text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>

        {/* Table content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 p-3 rounded-lg border border-brand-red/20 mb-4">
              {error}
            </p>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw className="h-6 w-6 text-brand-blue animate-spin mb-2" />
              <p className="text-xs text-text-muted">Loading attendee roster...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              {search ? "No attendees matching your search." : "No attendees have registered for this webinar yet."}
            </div>
          ) : (
            <div className="border border-border-soft rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 border-b border-border-soft text-text-secondary uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Attendee</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Organization / School</th>
                    <th className="px-4 py-3">Registered At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft bg-white">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-surface-1 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">{r.name}</p>
                        <p className="text-[11px] text-text-muted">{r.email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-[11px]">
                        {r.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.organization || "—"}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {new Date(r.registeredAt).toLocaleString("en-IN", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}
