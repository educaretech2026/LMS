"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import {
  Video, Plus, Calendar, Clock, Users, Play, X, Wifi, BookOpen,
  RefreshCw, Trash2, Radio, CheckCircle2, AlertCircle,
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
  board?: { id: string; name: string } | null;
  standard?: { id: string; name: string } | null;
  centre?: { id: string; name: string } | null;
}

interface SetupOption { id: string; name: string }

/* ── Page ── */
export default function LiveClassPage() {
  const [classes, setClasses] = useState<ApiLiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<ApiLiveClass | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
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
    if (!confirm("Delete this class?")) return;
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
    setShowSchedule(false);
  };

  const displayName = email ? `${email.split("@")[0]}` : (role?.toUpperCase() === "STUDENT" ? "Student" : "Teacher");

  /* ── Join Class ── */
  const handleJoin = (cls: ApiLiveClass) => {
    let url = cls.roomId;
    if (!url.startsWith('http')) {
      alert("Invalid Google Meet link provided for this class.");
      return;
    }
    window.open(url, "_blank");
  };

  const liveClasses = classes.filter(c => c.status === "LIVE");
  const scheduledClasses = classes.filter(c => c.status === "SCHEDULED");
  const endedClasses = classes.filter(c => c.status === "ENDED");

  return (
    <DashboardLayout title="Live Class">
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-border-soft bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-blue/8 flex items-center justify-center">
              <Video className="h-4.5 w-4.5 text-brand-blue" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Live Classes</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-text-muted">Powered by Google Meet</p>
                <span className="text-[9px] bg-brand-blue/10 text-brand-blue border border-brand-blue/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  🚀 Edu-Meet Rolling Out Soon
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 text-text-secondary hover:bg-surface-3 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {role?.toUpperCase() !== "STUDENT" && (
              <button
                onClick={() => setShowSchedule(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Schedule Class
              </button>
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
                { label: "Total Classes",   value: String(stats.total), icon: BookOpen, color: "text-brand-blue bg-brand-blue/8" },
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
                    />
                  ))}
                </Section>
              )}

              {/* Scheduled */}
              <Section title="Upcoming Classes">
                {scheduledClasses.length === 0 ? (
                  <EmptyState
                    text={role?.toUpperCase() === "STUDENT" ? "No upcoming classes scheduled." : "No upcoming classes. Schedule one above!"}
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
                    />
                  ))
                )}
              </Section>

              {/* Ended */}
              {endedClasses.length > 0 && (
                <Section title="Past Classes">
                  {endedClasses.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      role={role}
                      onJoin={() => handleJoin(cls)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  ))}
                </Section>
              )}
            </>
          )}

          {/* Large Edu-Meet Banner */}
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
              Edu-Meet is Rolling Out Soon! 🚀
            </h3>
            <p className="text-white/80 max-w-xl text-sm md:text-base font-medium relative z-10 leading-relaxed">
              We are upgrading your live classes. Get ready for a seamless, lightning-fast, and integrated meeting experience built directly into your LMS. Stay tuned!
            </p>
          </div>

        </div>
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={handleScheduled}
          email={email}
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
  cls, role, onJoin, onStatusChange, onDelete,
}: {
  cls: ApiLiveClass;
  role: string | null;
  onJoin: () => void;
  onStatusChange: (id: string, status: "SCHEDULED" | "LIVE" | "ENDED") => void;
  onDelete: (id: string) => void;
}) {
  const isLive = cls.status === "LIVE";
  const isEnded = cls.status === "ENDED";
  const isStudent = role?.toUpperCase() === "STUDENT";

  const scheduledDate = new Date(cls.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const timeStr = scheduledDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex items-center gap-5 transition-all ${
      isLive ? "border-brand-red/30" : isEnded ? "border-border-soft opacity-60" : "border-border-soft"
    }`}>
      {/* Icon */}
      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${
        isLive ? "bg-brand-red/10" : isEnded ? "bg-surface-3" : "bg-brand-blue/8"
      }`}>
        {isLive ? <Wifi className="h-5 w-5 text-brand-red" /> :
         isEnded ? <CheckCircle2 className="h-5 w-5 text-text-muted" /> :
         <Video className="h-5 w-5 text-brand-blue" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text-primary truncate">{cls.title}</p>
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-brand-red/10 border border-brand-red/25 px-2 py-0.5 text-[10px] font-bold text-brand-red shrink-0">
              <span className="h-1 w-1 rounded-full bg-brand-red animate-pulse" /> LIVE
            </span>
          )}
          {isEnded && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-text-muted">ENDED</span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">{cls.subject}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-text-muted">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateStr}, {timeStr}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{cls.duration} min</span>
          {cls.board && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{cls.board.name}</span>}
          {cls.standard && <span className="rounded bg-brand-blue/8 text-brand-blue px-1.5 py-0.5 font-semibold">{cls.standard.name}</span>}
          {cls.centre && <span className="rounded bg-success/8 text-success px-1.5 py-0.5 font-semibold">{cls.centre.name}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Admin controls */}
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
            {isStudent ? (isLive ? "Join" : "Waiting...") : (isLive ? "Join Live" : "Start Class")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Schedule Modal ── */
function ScheduleModal({
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-border-soft overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
          <h3 className="text-sm font-semibold text-text-primary">Schedule New Class</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Title */}
          <Field label="Class Title *">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Algebra"
              className="input-base" />
          </Field>

          {/* Subject */}
          <Field label="Subject *">
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              className="input-base" />
          </Field>

          {/* Google Meet Link */}
          <Field label="Google Meet Link (Optional)">
            <input type="url" value={zoomLink} onChange={e => setZoomLink(e.target.value)}
              placeholder="Leave empty to auto-generate"
              className="input-base" />
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
                {standards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)}
                className="input-base" />
            </Field>
            <Field label="Duration (min)">
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                min="10" placeholder="60"
                className="input-base" />
            </Field>
          </div>
        </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}
