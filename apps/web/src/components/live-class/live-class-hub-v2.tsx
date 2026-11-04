"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchApi } from "@/lib/api";
import {
  Video, Plus, Calendar, Clock, Users, Play, X, Wifi, BookOpen,
  RefreshCw, Trash2, Radio, CheckCircle2, AlertCircle, Globe,
  Copy, Check, ExternalLink, Image as ImageIcon, UploadCloud,
  Download, Search, Sparkles, FileText, ArrowRight, Monitor,
  SlidersHorizontal, CheckSquare, Layers, Lock, ShieldCheck
} from "lucide-react";

export interface ApiLiveClass {
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
  filesCount?: number;
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

interface LiveClassHubV2Props {
  onJoinRoom: (cls: ApiLiveClass) => void;
}

export function LiveClassHubV2({ onJoinRoom }: LiveClassHubV2Props) {
  const [classes, setClasses] = useState<ApiLiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleClass, setShowScheduleClass] = useState(false);
  const [showHostWebinar, setShowHostWebinar] = useState(false);
  const [selectedRegistrationsClass, setSelectedRegistrationsClass] = useState<ApiLiveClass | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "LIVE" | "UPCOMING" | "WEBINARS" | "ENDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, live: 0 });
  const { role, email } = useAuth();

  const normalizedRole = role ? role.toUpperCase().replace(/\s+/g, '_') : '';
  const isStaff = Boolean(normalizedRole && !["STUDENT", "PUBLIC_LEARNER"].includes(normalizedRole));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isStaffUser = Boolean(role && !["STUDENT", "PUBLIC_LEARNER"].includes(role.toUpperCase().replace(/\s+/g, '_')));
      const [data, s] = await Promise.all([
        fetchApi<ApiLiveClass[]>("/live-class"),
        isStaffUser
          ? fetchApi<{ total: number; live: number }>("/live-class/stats", { silent: true }).catch(() => ({ total: 0, live: 0 }))
          : Promise.resolve({ total: 0, live: 0 }),
      ]);
      setClasses(Array.isArray(data) ? data : []);
      setStats(s || { total: 0, live: 0 });
    } catch (e: any) {
      setError(e.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, [role]);

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
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await fetchApi(`/live-class/${id}`, { method: "DELETE" });
      setClasses(prev => prev.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const handleScheduled = (cls: ApiLiveClass) => {
    setClasses(prev => [cls, ...prev]);
    setStats(prev => ({ ...prev, total: prev.total + 1 }));
    setShowScheduleClass(false);
    setShowHostWebinar(false);
  };

  // Filter sessions
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      // Tab filter
      if (activeTab === "LIVE" && cls.status !== "LIVE") return false;
      if (activeTab === "UPCOMING" && cls.status !== "SCHEDULED") return false;
      if (activeTab === "WEBINARS" && !cls.isPublic) return false;
      if (activeTab === "ENDED" && cls.status !== "ENDED") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = cls.title?.toLowerCase().includes(q);
        const matchesSubject = cls.subject?.toLowerCase().includes(q);
        const matchesTeacher = cls.teacherName?.toLowerCase().includes(q);
        return matchesTitle || matchesSubject || matchesTeacher;
      }
      return true;
    });
  }, [classes, activeTab, searchQuery]);

  const liveClasses = useMemo(() => classes.filter(c => c.status === "LIVE"), [classes]);
  const primaryLive = liveClasses[0] || null;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 sm:py-4 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Edu-Meet Classroom</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                    v2.0
                  </span>
                </div>
                <p className="text-xs text-slate-500">Live Virtual Interactive Classroom & Presentations</p>
              </div>
            </div>

            {/* Mobile Refresh Button */}
            <button
              onClick={load}
              aria-label="Refresh class list"
              className="sm:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={load}
              aria-label="Refresh classes"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>

            {isStaff && (
              <>
                <button
                  onClick={() => setShowHostWebinar(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 text-xs font-semibold shadow-xs transition-colors shrink-0"
                >
                  <Globe className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Host Webinar</span>
                </button>

                <button
                  onClick={() => setShowScheduleClass(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Schedule Class</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-6 flex-1">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={load} className="text-xs font-bold underline hover:text-rose-900">Retry</button>
          </div>
        )}

        {/* Hero Live Pulse Banner (If a class is currently active) */}
        {primaryLive && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-5 sm:p-7 shadow-xl shadow-indigo-950/10 text-white">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <span className="text-[11px] font-bold tracking-wider text-rose-400 uppercase">
                    Class In Session Right Now
                  </span>
                  {primaryLive.isPublic && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      Public Webinar
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white line-clamp-1">
                  {primaryLive.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">
                  {primaryLive.description || `Live interactive session covering ${primaryLive.subject} led by ${primaryLive.teacherName}.`}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{primaryLive.subject}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{primaryLive.teacherName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{primaryLive.duration} mins</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onJoinRoom(primaryLive)}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white px-6 py-3.5 text-sm font-bold shadow-lg shadow-rose-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Join Classroom Now</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {(
              [
                { id: "ALL", label: "All Sessions", count: classes.length, pulse: false },
                { id: "LIVE", label: "Live Now", count: classes.filter(c => c.status === "LIVE").length, pulse: true },
                { id: "UPCOMING", label: "Upcoming", count: classes.filter(c => c.status === "SCHEDULED").length, pulse: false },
                { id: "WEBINARS", label: "Webinars", count: classes.filter(c => c.isPublic).length, pulse: false },
                { id: "ENDED", label: "Past", count: classes.filter(c => c.status === "ENDED").length, pulse: false },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.pulse && tab.count > 0 && (
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, title, host..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Sessions Grid */}
        {loading && classes.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Loading virtual classrooms...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <Video className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No classes found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No sessions match "${searchQuery}". Try clearing search filters.`
                : activeTab === "WEBINARS"
                ? "No public webinars scheduled right now."
                : "No virtual classes found in this category. Teachers can schedule one above!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map((cls) => (
              <ClassSessionCard
                key={cls.id}
                cls={cls}
                isStaff={isStaff}
                onJoin={() => onJoinRoom(cls)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onViewRegistrations={() => setSelectedRegistrationsClass(cls)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Schedule Cohort Class Modal with Deck Pre-attachment */}
      {showScheduleClass && (
        <ScheduleClassModalV2
          onClose={() => setShowScheduleClass(false)}
          onScheduled={handleScheduled}
          email={email}
        />
      )}

      {/* Host Public Webinar Modal with Banner & Deck Pre-attachment */}
      {showHostWebinar && (
        <HostWebinarModalV2
          onClose={() => setShowHostWebinar(false)}
          onScheduled={handleScheduled}
          email={email}
        />
      )}

      {/* Attendee Registrations Modal */}
      {selectedRegistrationsClass && (
        <RegistrationsModalV2
          cls={selectedRegistrationsClass}
          onClose={() => setSelectedRegistrationsClass(null)}
        />
      )}
    </div>
  );
}

/* ── Class Session Card (Mobile Friendly & Adaptive) ── */
function ClassSessionCard({
  cls,
  isStaff,
  onJoin,
  onStatusChange,
  onDelete,
  onViewRegistrations,
}: {
  cls: ApiLiveClass;
  isStaff: boolean;
  onJoin: () => void;
  onStatusChange: (id: string, status: "SCHEDULED" | "LIVE" | "ENDED") => void;
  onDelete: (id: string) => void;
  onViewRegistrations: () => void;
}) {
  const isLive = cls.status === "LIVE";
  const isEnded = cls.status === "ENDED";
  const isZoom = cls.roomId?.includes("zoom.us");
  const isMeet = cls.roomId?.includes("meet.google.com");

  const formattedDate = useMemo(() => {
    try {
      return new Date(cls.scheduledAt).toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return cls.scheduledAt;
    }
  }, [cls.scheduledAt]);

  return (
    <div
      className={`group relative rounded-2xl border transition-all flex flex-col justify-between overflow-hidden bg-white shadow-xs hover:shadow-md ${
        isLive
          ? "border-rose-300 ring-2 ring-rose-500/10"
          : isEnded
          ? "border-slate-200 opacity-80"
          : "border-slate-200 hover:border-indigo-300"
      }`}
    >
      {/* Top Banner Accent */}
      {cls.backgroundImageUrl && (
        <div className="h-28 w-full relative overflow-hidden bg-slate-900">
          <img
            src={cls.backgroundImageUrl}
            alt={cls.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE NOW
              </span>
            ) : isEnded ? (
              <span className="bg-slate-800/80 backdrop-blur-xs text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                ENDED
              </span>
            ) : (
              <span className="bg-indigo-600/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                SCHEDULED
              </span>
            )}
            {cls.isPublic && (
              <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Webinar
              </span>
            )}
          </div>
        </div>
      )}

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Header Badges when no banner */}
          {!cls.backgroundImageUrl && (
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
                    LIVE NOW
                  </span>
                ) : isEnded ? (
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    ENDED
                  </span>
                ) : (
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    UPCOMING
                  </span>
                )}
                {cls.isPublic && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Webinar
                  </span>
                )}
              </div>

              {/* Platform icon */}
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                {isZoom ? "Zoom" : isMeet ? "Google Meet" : "Edu-Meet V2"}
              </span>
            </div>
          )}

          {/* Title & Subject */}
          <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
            {cls.title}
          </h3>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {cls.subject}
            </span>
            {cls.standard && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {cls.standard.name}
              </span>
            )}
            {cls.board && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {cls.board.name}
              </span>
            )}
          </div>

          {/* Date & Host Info */}
          <div className="grid grid-cols-2 gap-2 pt-3 text-xs text-slate-500 border-t border-slate-100 mt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{cls.teacherName}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Main Join Button */}
          <button
            onClick={onJoin}
            disabled={isEnded}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
              isLive
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 active:scale-[0.98]"
                : isEnded
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-[0.98]"
            }`}
          >
            <Play className={`h-3.5 w-3.5 ${isLive ? "fill-white animate-pulse" : ""}`} />
            <span>{isLive ? "Join Live Class" : isEnded ? "Class Completed" : "Enter Room"}</span>
          </button>

          {/* Staff controls */}
          {isStaff && (
            <div className="flex items-center gap-1">
              {cls.isPublic && (
                <button
                  onClick={onViewRegistrations}
                  className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  title="View Registered Attendees"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Status Toggle for Teacher */}
              {!isEnded && (
                <button
                  onClick={() => onStatusChange(cls.id, isLive ? "ENDED" : "LIVE")}
                  className={`h-9 px-2 rounded-xl text-[11px] font-semibold border transition-colors ${
                    isLive
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                  title={isLive ? "End Class" : "Start Live Session"}
                >
                  {isLive ? "End" : "Go Live"}
                </button>
              )}

              <button
                onClick={() => onDelete(cls.id)}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete Session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Schedule Class with Slide Deck Pre-attachment ── */
function ScheduleClassModalV2({
  onClose,
  onScheduled,
  email,
}: {
  onClose: () => void;
  onScheduled: (cls: ApiLiveClass) => void;
  email: string | null;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [platform, setPlatform] = useState<"EDUMEET" | "GOOGLE_MEET" | "ZOOM">("EDUMEET");
  const [zoomLink, setZoomLink] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Setup options
  const [boards, setBoards] = useState<SetupOption[]>([]);
  const [standards, setStandards] = useState<SetupOption[]>([]);
  const [centres, setCentres] = useState<SetupOption[]>([]);
  const [boardId, setBoardId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [centreId, setCentreId] = useState("");

  // Slide Deck Pre-attachment state
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [uploadingDeck, setUploadingDeck] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi<SetupOption[]>("/setup/boards"),
      fetchApi<SetupOption[]>("/setup/standards"),
      fetchApi<SetupOption[]>("/setup/centres"),
    ])
      .then(([b, s, c]) => {
        setBoards(b || []);
        setStandards(s || []);
        setCentres(c || []);
      })
      .catch(() => {});
  }, []);

  const handleDeckSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeckFile(file);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !subject.trim() || !dateTime) {
      setError("Please fill in Title, Subject and Scheduled Date & Time.");
      return;
    }
    if (platform === "ZOOM" && !zoomLink.trim()) {
      setError("Please enter a Zoom Meeting link.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const teacherName = email ? email.split("@")[0] : "Teacher";
      let finalZoomLink: string | undefined = undefined;
      if (platform === "EDUMEET") {
        finalZoomLink = `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      } else if (platform === "GOOGLE_MEET" || platform === "ZOOM") {
        finalZoomLink = zoomLink.trim();
      }

      // 1. Create Class
      const created = await fetchApi<ApiLiveClass>("/live-class", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacherName,
          scheduledAt: new Date(dateTime).toISOString(),
          duration: Number(duration) || 60,
          platform,
          zoomLink: finalZoomLink,
          isPublic: false,
          boardId: boardId || undefined,
          standardId: standardId || undefined,
          centreId: centreId || undefined,
        }),
      });

      // 2. If Deck file selected, upload to storage and attach
      if (deckFile && created?.id) {
        setUploadingDeck(true);
        try {
          const presigned = (await fetchApi(
            `/storage/presigned-url?filename=${encodeURIComponent(deckFile.name)}&contentType=${encodeURIComponent(deckFile.type || "application/pdf")}`
          )) as any;

          if (presigned?.uploadUrl && presigned?.finalUrl) {
            await fetch(presigned.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": deckFile.type || "application/pdf" },
              body: deckFile,
            });

            // Register in live class files endpoint
            await fetchApi(`/live-class/${created.id}/files`, {
              method: "POST",
              body: JSON.stringify({
                fileName: deckFile.name,
                fileUrl: presigned.finalUrl,
                fileSize: deckFile.size,
                mimeType: deckFile.type || "application/pdf",
              }),
            });
          }
        } catch (uploadErr) {
          console.warn("Could not pre-attach deck file automatically:", uploadErr);
        }
      }

      onScheduled(created);
    } catch (e: any) {
      setError(e.message || "Failed to schedule class");
    } finally {
      setSubmitting(false);
      setUploadingDeck(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Schedule Cohort Class</h2>
              <p className="text-[11px] text-slate-500">Plan a virtual class with interactive slide presentations</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electromagnetic Waves - Lecture 3"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Topic *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date & Time *</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes (1 hour)</option>
                <option value="90">90 minutes (1.5 hours)</option>
                <option value="120">120 minutes (2 hours)</option>
              </select>
            </div>
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Classroom Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "EDUMEET", label: "Edu-Meet V2", desc: "Built-in & Slides" },
                { id: "GOOGLE_MEET", label: "Google Meet", desc: "External link" },
                { id: "ZOOM", label: "Zoom", desc: "External link" },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlatform(p.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    platform === p.id
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{p.label}</p>
                  <p className="text-[10px] text-slate-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {platform !== "EDUMEET" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {platform === "ZOOM" ? "Zoom Meeting Link *" : "Google Meet Link"}
              </label>
              <input
                type="url"
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Academic filters (Cohort Target) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Board</label>
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none"
              >
                <option value="">All Boards</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Standard</label>
              <select
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none"
              >
                <option value="">All Standards</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Centre / Branch</label>
              <select
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none"
              >
                <option value="">All Centres</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pre-attachment Dropzone for Presentation Slides */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                <span>Pre-attach Presentation Deck (PDF / Image Slides)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Optional</span>
            </div>

            {deckFile ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 bg-indigo-50/60">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 truncate">{deckFile.name}</p>
                    <p className="text-[10px] text-slate-500">{(deckFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeckFile(null)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleDeckSelect}
                  className="hidden"
                />
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Attach lecture slides for this session</p>
                <p className="text-[10px] text-slate-400 mt-0.5">PDF slides or image sheets up to 50MB</p>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploadingDeck}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-semibold shadow-xs disabled:opacity-60 transition-all"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>{uploadingDeck ? "Uploading Deck..." : "Scheduling..."}</span>
              </>
            ) : (
              <span>Schedule Session</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Host Public Webinar with Slides Deck ── */
function HostWebinarModalV2({
  onClose,
  onScheduled,
  email,
}: {
  onClose: () => void;
  onScheduled: (cls: ApiLiveClass) => void;
  email: string | null;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [uploadingDeck, setUploadingDeck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image banner file (PNG, JPG, WebP).");
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
      setError("Please fill in Webinar Title, Subject / Topic and Scheduled Date & Time.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const teacherName = email ? email.split("@")[0] : "Host";
      const finalZoomLink = `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const created = await fetchApi<ApiLiveClass>("/live-class", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacherName,
          scheduledAt: new Date(dateTime).toISOString(),
          duration: Number(duration) || 60,
          platform: "EDUMEET",
          zoomLink: finalZoomLink,
          isPublic: true,
          description: description.trim() || undefined,
          backgroundImageUrl: backgroundImageUrl || undefined,
        }),
      });

      if (deckFile && created?.id) {
        setUploadingDeck(true);
        try {
          const presigned = (await fetchApi(
            `/storage/presigned-url?filename=${encodeURIComponent(deckFile.name)}&contentType=${encodeURIComponent(deckFile.type || "application/pdf")}`
          )) as any;

          if (presigned?.uploadUrl && presigned?.finalUrl) {
            await fetch(presigned.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": deckFile.type || "application/pdf" },
              body: deckFile,
            });

            await fetchApi(`/live-class/${created.id}/files`, {
              method: "POST",
              body: JSON.stringify({
                fileName: deckFile.name,
                fileUrl: presigned.finalUrl,
                fileSize: deckFile.size,
                mimeType: deckFile.type || "application/pdf",
              }),
            });
          }
        } catch (uploadErr) {
          console.warn("Could not pre-attach deck file automatically:", uploadErr);
        }
      }

      onScheduled(created);
    } catch (e: any) {
      setError(e.message || "Failed to host webinar");
    } finally {
      setSubmitting(false);
      setUploadingDeck(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Host Public Webinar</h2>
              <p className="text-[11px] text-slate-500">Open to public registration with presentation deck sharing</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Webinar Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Masterclass: Cracking JEE Physics in 90 Days"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Domain *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics / Career Guidance"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date & Time *</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of what attendees will learn in this session..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Banner Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Webinar Cover Banner</label>
            {backgroundImageUrl ? (
              <div className="relative rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-900 group">
                <img src={backgroundImageUrl} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBackgroundImageUrl("")}
                    className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Remove Banner
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                  {uploadingImage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {uploadingImage ? "Uploading cover image..." : "Upload cover banner (PNG/JPG)"}
                </p>
              </label>
            )}
          </div>

          {/* Pre-attached Slides Deck */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pre-attach Presentation Deck</label>
            {deckFile ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 bg-indigo-50/60">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 truncate">{deckFile.name}</span>
                </div>
                <button type="button" onClick={() => setDeckFile(null)} className="text-slate-400 hover:text-rose-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <input type="file" accept="application/pdf,image/*" onChange={(e) => setDeckFile(e.target.files?.[0] || null)} className="hidden" />
                <p className="text-xs font-semibold text-slate-700">Attach lecture presentation (PDF)</p>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploadingImage || uploadingDeck}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-semibold shadow-xs disabled:opacity-60 transition-all"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            <span>{submitting ? "Publishing..." : "Publish Webinar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal: Attendee Registrations ── */
function RegistrationsModalV2({
  cls,
  onClose,
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
      .then((res) => setRegistrations(res.registrations || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cls.id]);

  const filtered = registrations.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.organization && r.organization.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Registered Attendees</h2>
            <p className="text-[11px] text-slate-500">{cls.title} ({registrations.length} registered)</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or school..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
          />
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-indigo-600" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-8">No attendees registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {filtered.map((r) => (
                <div key={r.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div>
                    <p className="font-bold text-slate-800">{r.name}</p>
                    <p className="text-slate-400 text-[11px]">{r.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-600">{r.organization || "Independent"}</p>
                    <p className="text-slate-400 text-[10px]">{new Date(r.registeredAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
