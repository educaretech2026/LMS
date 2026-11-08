"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchApi } from "@/lib/api";
import {
  Video, Plus, Calendar, Clock, Users, Play, X, Wifi, BookOpen,
  RefreshCw, Trash2, Radio, CheckCircle2, AlertCircle, Globe,
  Copy, Check, ExternalLink, Image as ImageIcon, UploadCloud,
  Download, Search, Sparkles, FileText, ArrowRight, Monitor,
  SlidersHorizontal, CheckSquare, Layers, Lock, ShieldCheck, Film,
  Eye, EyeOff, ArrowUpDown
} from "lucide-react";
import { RecordingUploadModal, VideoPlayerModal } from "./recording-upload-modal";

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
  recordingUrl?: string | null;
  recordingStatus?: string | null;
  isRecordingReleased?: boolean;
}

interface SetupOption { id: string; name: string }

interface Registration {
  id: string;
  name: string;
  parentName?: string | null;
  email: string;
  phone?: string | null;
  courseOrClass?: string | null;
  organization?: string | null;
  status?: string | null;
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
  const [selectedAttachmentsClass, setSelectedAttachmentsClass] = useState<ApiLiveClass | null>(null);
  const [playingRecording, setPlayingRecording] = useState<{ url: string; title: string } | null>(null);
  const [uploadModalClass, setUploadModalClass] = useState<ApiLiveClass | null>(null);
  const [uploadModalFile, setUploadModalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadTargetClassRef = useRef<ApiLiveClass | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "LIVE" | "UPCOMING" | "WEBINARS" | "ENDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    | "STATUS_LIVE_FIRST"
    | "DATE_SOONEST"
    | "DATE_LATEST"
    | "TITLE_ASC"
    | "TITLE_DESC"
    | "DURATION_ASC"
    | "DURATION_DESC"
  >("STATUS_LIVE_FIRST");
  const [stats, setStats] = useState({ total: 0, live: 0 });
  const { role, email } = useAuth();

  const normalizedRole = role ? role.toUpperCase().replace(/\s+/g, '_') : '';
  const isStaff = Boolean(normalizedRole && !["STUDENT", "PUBLIC_LEARNER"].includes(normalizedRole));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isStaffUser = Boolean(role && !["STUDENT", "PUBLIC_LEARNER"].includes(role.toUpperCase().replace(/\s+/g, '_')));

      let data: ApiLiveClass[] = [];
      try {
        data = await fetchApi<ApiLiveClass[]>("/live-class");
      } catch (primaryErr: any) {
        console.warn("Primary /live-class fetch error, attempting public fallback:", primaryErr?.message);
        try {
          const pub = await fetchApi<ApiLiveClass[]>("/live-class/public", { silent: true });
          data = Array.isArray(pub) ? pub : [];
        } catch {
          throw primaryErr;
        }
      }

      const s = isStaffUser
        ? await fetchApi<{ total: number; live: number }>("/live-class/stats", { silent: true }).catch(() => ({ total: 0, live: 0 }))
        : { total: 0, live: 0 };

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

  const handleTriggerUpload = (cls: ApiLiveClass) => {
    pendingUploadTargetClassRef.current = cls;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadTargetClassRef.current) return;
    setUploadModalFile(file);
    setUploadModalClass(pendingUploadTargetClassRef.current);
  };

  const handleToggleReleaseRecording = async (cls: ApiLiveClass) => {
    const nextReleased = !cls.isRecordingReleased;
    try {
      await fetchApi(`/live-class/${cls.id}/recording/release`, {
        method: "PATCH",
        body: JSON.stringify({ isReleased: nextReleased }),
      });
      setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, isRecordingReleased: nextReleased } : c));
    } catch (e: any) {
      alert(`Failed to update recording release status: ${e?.message || e}`);
    }
  };

  // Filter & sort sessions
  const filteredClasses = useMemo(() => {
    const getTime = (val?: string | null) => {
      if (!val) return 0;
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };

    const list = classes.filter(cls => {
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
        const matchesType = cls.isPublic && "webinar".includes(q);
        return Boolean(matchesTitle || matchesSubject || matchesTeacher || matchesType);
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = getTime(a.scheduledAt);
      const timeB = getTime(b.scheduledAt);

      switch (sortBy) {
        case "STATUS_LIVE_FIRST": {
          const priority = (s: string) => (s === "LIVE" ? 0 : s === "SCHEDULED" ? 1 : 2);
          const diff = priority(a.status) - priority(b.status);
          if (diff !== 0) return diff;
          // If both scheduled, soonest upcoming first
          if (a.status === "SCHEDULED") return timeA - timeB;
          // If both ended, most recently ended first
          if (a.status === "ENDED") return timeB - timeA;
          return timeA - timeB;
        }
        case "DATE_SOONEST":
          return timeA - timeB;
        case "DATE_LATEST":
          return timeB - timeA;
        case "TITLE_ASC":
          return (a.title || "").localeCompare(b.title || "");
        case "TITLE_DESC":
          return (b.title || "").localeCompare(a.title || "");
        case "DURATION_ASC":
          return (a.duration || 0) - (b.duration || 0);
        case "DURATION_DESC":
          return (b.duration || 0) - (a.duration || 0);
        default:
          return 0;
      }
    });
  }, [classes, activeTab, searchQuery, sortBy]);

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
                    {primaryLive.isPublic ? "Webinar Broadcast Live Now" : "Class In Session Right Now"}
                  </span>
                  {primaryLive.isPublic && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
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
                  <span>{primaryLive.isPublic ? "Join Webinar Broadcast" : "Join Classroom Now"}</span>
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

          {/* Controls: Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, title, host..."
                className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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

            {/* Sort Dropdown */}
            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                aria-label="Sort sessions"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto appearance-none pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="STATUS_LIVE_FIRST">Sort: Live First</option>
                <option value="DATE_SOONEST">Sort: Soonest / Upcoming</option>
                <option value="DATE_LATEST">Sort: Latest Scheduled</option>
                <option value="TITLE_ASC">Sort: Title (A - Z)</option>
                <option value="TITLE_DESC">Sort: Title (Z - A)</option>
                <option value="DURATION_ASC">Sort: Shortest Duration</option>
                <option value="DURATION_DESC">Sort: Longest Duration</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Webinar Section Showcase Banner */}
        {activeTab === "WEBINARS" && (
          <div className="rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border border-purple-500/30 p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Globe className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-bold tracking-wider text-purple-300 uppercase">
                    Public Webinars & Masterclasses
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Broadcast Masterclasses & Keynote Lectures
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Webinar sessions feature stage keynote presentations, slide decks, and audience-mode broadcasting. Attendees join in listen-only mode with live Q&amp;A chat and hand-raising.
                </p>
                <div className="pt-1.5 flex items-center gap-2 text-[11px] text-purple-200">
                  <span className="font-bold text-white bg-purple-500/30 px-2 py-0.5 rounded-md border border-purple-400/30">Public Share Links</span>
                  <span>Available anytime before or during the event. Copy the public link from any card below to share on WhatsApp, email, or posters.</span>
                </div>
              </div>
              {isStaff && (
                <button
                  onClick={() => setShowHostWebinar(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-purple-600/20 transition-all hover:scale-[1.02] shrink-0"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Host New Webinar</span>
                </button>
              )}
            </div>
          </div>
        )}

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
                onManageAttachments={() => setSelectedAttachmentsClass(cls)}
                onWatchRecording={cls.recordingUrl ? () => setPlayingRecording({ url: cls.recordingUrl!, title: cls.title }) : undefined}
                onUploadRecording={isStaff ? () => handleTriggerUpload(cls) : undefined}
                onToggleReleaseRecording={isStaff ? () => handleToggleReleaseRecording(cls) : undefined}
              />
            ))}
          </div>
        )}
      </main>

      {/* Hidden file input for on-demand cloud recording uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileSelected}
      />

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

      {/* Class Attachments Modal */}
      {selectedAttachmentsClass && (
        <AttachmentsModalV2
          cls={selectedAttachmentsClass}
          onClose={() => setSelectedAttachmentsClass(null)}
        />
      )}

      {/* Upon-request Compressed Cloud Recording Upload Modal */}
      {uploadModalClass && uploadModalFile && (
        <RecordingUploadModal
          isOpen={true}
          onClose={() => {
            setUploadModalClass(null);
            setUploadModalFile(null);
          }}
          videoBlob={uploadModalFile}
          classId={uploadModalClass.id}
          classTitle={uploadModalClass.title}
          onUploaded={(url: string, isReleased?: boolean) => {
            setClasses(prev => prev.map(c => c.id === uploadModalClass.id ? {
              ...c,
              recordingUrl: url,
              recordingStatus: 'COMPLETED',
              isRecordingReleased: Boolean(isReleased),
            } : c));
            setUploadModalClass(null);
            setUploadModalFile(null);
          }}
        />
      )}

      {/* Cloud Recording Replay Player Modal */}
      {playingRecording && (
        <VideoPlayerModal
          video={{
            url: playingRecording.url,
            title: playingRecording.title,
          }}
          onClose={() => setPlayingRecording(null)}
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
  onManageAttachments,
  onWatchRecording,
  onUploadRecording,
  onToggleReleaseRecording,
}: {
  cls: ApiLiveClass;
  isStaff: boolean;
  onJoin: () => void;
  onStatusChange: (id: string, status: "SCHEDULED" | "LIVE" | "ENDED") => void;
  onDelete: (id: string) => void;
  onViewRegistrations: () => void;
  onManageAttachments: () => void;
  onWatchRecording?: () => void;
  onUploadRecording?: () => void;
  onToggleReleaseRecording?: () => void;
}) {
  const isLive = cls.status === "LIVE";
  const isEnded = cls.status === "ENDED";
  const isZoom = cls.roomId?.includes("zoom.us");
  const isMeet = cls.roomId?.includes("meet.google.com");
  const [copiedLink, setCopiedLink] = useState(false);
  const canWatchReplay = Boolean(isEnded && cls.recordingUrl && (cls.isRecordingReleased || isStaff));

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
              <span className="bg-purple-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Globe className="h-3 w-3" />
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
                  <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="h-3 w-3" />
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
            {cls.isPublic ? (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-100 flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Public Broadcast
              </span>
            ) : (
              <>
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
              </>
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
              <span className="truncate">{cls.isPublic ? `Presenter: ${cls.teacherName}` : cls.teacherName}</span>
            </div>
          </div>

          {/* Dedicated Public Webinar Link Card Banner (Accessible Before & During Webinar) */}
          {cls.isPublic && (
            <div className="mt-3 p-3 rounded-2xl bg-purple-50/90 border border-purple-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-purple-900 tracking-wider block">
                    Shareable Public Link
                  </span>
                  <span className="text-xs font-mono text-purple-700 truncate block select-all">
                    /live/{cls.id}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/live/${cls.id}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Copy shareable link for WhatsApp, email, or posters"
                >
                  {copiedLink ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
                <a
                  href={`/live/${cls.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 transition-colors shadow-2xs"
                  title="Preview public registration page"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* Cloud Recording Section: Modern, viewer-friendly card */}
          {cls.recordingUrl && (
            <div
              className={`mt-3 rounded-2xl border p-3.5 transition-all ${
                cls.isRecordingReleased
                  ? "bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border-indigo-200 shadow-2xs hover:border-indigo-300"
                  : isStaff
                  ? "bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white border-amber-200 shadow-2xs"
                  : "bg-slate-50/90 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      cls.isRecordingReleased
                        ? "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-500/20"
                        : isStaff
                        ? "bg-gradient-to-tr from-amber-600 to-orange-600 text-white shadow-amber-500/20"
                        : "bg-slate-400 text-white"
                    }`}
                  >
                    <Film className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full inline-block ${
                        cls.isRecordingReleased
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : isStaff
                          ? "bg-amber-100 text-amber-900 border border-amber-200"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {cls.isRecordingReleased
                        ? "Replay Available"
                        : isStaff
                        ? "Private Draft"
                        : "Processing Replay"}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                  {cls.isRecordingReleased ? "HD 720p" : isStaff ? "Unreleased" : "Pending"}
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-3 line-clamp-1">
                {cls.isRecordingReleased
                  ? "Full session recording ready for streaming."
                  : isStaff
                  ? "Recording uploaded to cloud. Review and release when ready."
                  : "Instructor will release the class replay soon."}
              </p>

              {/* Action buttons row */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                {/* Watch / Preview Button */}
                {onWatchRecording && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWatchRecording();
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer ${
                      cls.isRecordingReleased
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                    title={isStaff && !cls.isRecordingReleased ? "Preview recording in private" : "Watch recording stream"}
                  >
                    <Play size={12} className="fill-white" />
                    <span>{isStaff && !cls.isRecordingReleased ? "Preview Replay" : "Watch Replay"}</span>
                  </button>
                )}

                {/* Staff Release / Retract Button */}
                {isStaff && onToggleReleaseRecording && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReleaseRecording();
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shrink-0 ${
                      cls.isRecordingReleased
                        ? "border-slate-200 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 hover:border-rose-200"
                        : "border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20"
                    }`}
                    title={
                      cls.isRecordingReleased
                        ? "Retract recording back to private draft"
                        : "Release recording to students"
                    }
                  >
                    {cls.isRecordingReleased ? (
                      <>
                        <EyeOff size={12} />
                        <span>Retract</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={12} />
                        <span>Release to Students</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Student Banner when recording exists on server but is not yet released */}
          {!isStaff && !cls.recordingUrl && cls.recordingStatus === 'UNRELEASED' && (
            <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 flex items-center gap-2.5 shadow-2xs">
              <div className="h-8 w-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider block">
                  Recording Under Review
                </span>
                <span className="text-xs text-slate-500 truncate block">
                  The instructor will release the recording replay shortly.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Main Join or Watch Replay Button */}
          <button
            onClick={canWatchReplay ? onWatchRecording : onJoin}
            disabled={isEnded && !canWatchReplay}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
              isLive
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20 active:scale-[0.98]"
                : canWatchReplay
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm shadow-indigo-600/20 active:scale-[0.98] cursor-pointer"
                : isEnded
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : cls.isPublic
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs active:scale-[0.98]"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-[0.98]"
            }`}
          >
            <Play className={`h-3.5 w-3.5 ${isLive ? "fill-white animate-pulse" : canWatchReplay ? "fill-white" : ""}`} />
            <span>
              {isLive
                ? (cls.isPublic ? "Join Webinar Broadcast" : "Join Live Class")
                : canWatchReplay
                ? (cls.isPublic ? "Watch Webinar Replay" : "Watch Class Replay")
                : isEnded
                ? (cls.isPublic ? "Webinar Concluded" : "Class Completed")
                : (cls.isPublic ? "Enter Webinar" : "Enter Room")}
            </span>
          </button>

          {/* Staff controls */}
          {isStaff && (
            <div className="flex items-center gap-1">
              {cls.isPublic && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/live/${cls.id}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className={`h-9 px-2 flex items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors ${
                    copiedLink
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700"
                  }`}
                  title="Copy Public Webinar Link"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="text-[10px] hidden sm:inline">{copiedLink ? "Copied" : "Link"}</span>
                </button>
              )}

              {onUploadRecording && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUploadRecording();
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  title={cls.recordingUrl ? "Re-upload / Replace Compressed Cloud Recording" : "Compress & Upload Recording to Cloud"}
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                onClick={onManageAttachments}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                title={cls.isPublic ? "Webinar Handouts & Slides" : "Class Attachments & Handouts"}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={onViewRegistrations}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                title={cls.isPublic ? "View Registered Attendees & Webinar Roster" : "View Class Attendance & Enrolled Roster"}
              >
                <Users className="h-3.5 w-3.5" />
              </button>

              {/* Status Toggle for Teacher */}
              {!isEnded && (
                <button
                  onClick={() => onStatusChange(cls.id, isLive ? "ENDED" : "LIVE")}
                  className={`h-9 px-2 rounded-xl text-[11px] font-semibold border transition-colors ${
                    isLive
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : cls.isPublic
                      ? "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                  title={isLive ? (cls.isPublic ? "End Webinar" : "End Class") : (cls.isPublic ? "Start Webinar Broadcast" : "Go Live")}
                >
                  {isLive ? "End" : (cls.isPublic ? "Broadcast" : "Go Live")}
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

  // Load Boards & Centres on modal mount
  useEffect(() => {
    Promise.all([
      fetchApi<SetupOption[]>("/setup/boards"),
      fetchApi<SetupOption[]>("/setup/centres"),
    ])
      .then(([b, c]) => {
        setBoards(b || []);
        setCentres(c || []);
      })
      .catch(() => {});
  }, []);

  // Dynamically query standards strictly filtered by target board
  useEffect(() => {
    if (!boardId) {
      setStandards([]);
      setStandardId("");
      return;
    }
    fetchApi<SetupOption[]>(`/setup/standards?boardId=${encodeURIComponent(boardId)}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStandards(list);
        setStandardId((prev) => (list.some((s) => s.id === prev) ? prev : ""));
      })
      .catch(() => {});
  }, [boardId]);

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
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Standard / Class</label>
              <select
                value={standardId}
                disabled={!boardId}
                onChange={(e) => setStandardId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{boardId ? "All Standards for Board" : "Select Board First"}</option>
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
  const [platform, setPlatform] = useState<"EDUMEET" | "GOOGLE_MEET" | "ZOOM">("EDUMEET");
  const [customLink, setCustomLink] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [uploadingDeck, setUploadingDeck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdWebinar, setCreatedWebinar] = useState<ApiLiveClass | null>(null);
  const [copiedCreatedLink, setCopiedCreatedLink] = useState(false);

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

    if (platform === "ZOOM" && !customLink.trim()) {
      setError("Please enter a valid Zoom meeting link.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const teacherName = email ? email.split("@")[0] : "Host";
      let finalZoomLink = "";
      if (platform === "EDUMEET") {
        finalZoomLink = `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      } else {
        finalZoomLink = customLink.trim();
      }

      const created = await fetchApi<ApiLiveClass>("/live-class", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacherName,
          scheduledAt: new Date(dateTime).toISOString(),
          duration: Number(duration) || 60,
          platform,
          zoomLink: finalZoomLink || undefined,
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
      setCreatedWebinar(created);
    } catch (e: any) {
      setError(e.message || "Failed to host webinar");
    } finally {
      setSubmitting(false);
      setUploadingDeck(false);
    }
  };

  if (createdWebinar) {
    const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/live/${createdWebinar.id}` : `/live/${createdWebinar.id}`;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
            <Globe className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Webinar Scheduled!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            Your public webinar <strong className="text-slate-800">"{createdWebinar.title}"</strong> has been created. Anyone with this public link can register and join.
          </p>

          {/* Link Box */}
          <div className="p-3.5 bg-purple-50/90 rounded-2xl border border-purple-200/90 text-left mb-6">
            <div className="text-[10px] font-bold text-purple-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-purple-600" />
              <span>Public Shareable Link</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-800 truncate select-all flex-1 bg-white px-2.5 py-1.5 rounded-xl border border-purple-200/60">
                {publicUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopiedCreatedLink(true);
                  setTimeout(() => setCopiedCreatedLink(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs"
              >
                {copiedCreatedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCreatedLink ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <a
              href={`/live/${createdWebinar.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Public Page</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Delivery Platform Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Webinar Delivery Platform
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "EDUMEET", label: "Edu-Meet LiveKit", desc: "Native Keynote Broadcast Stage" },
                { id: "GOOGLE_MEET", label: "Google Meet", desc: "Automated / Custom G-Meet" },
                { id: "ZOOM", label: "Zoom", desc: "External Meeting Link" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    platform === p.id
                      ? "border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{p.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>

            {platform === "EDUMEET" && (
              <div className="mt-2 p-2.5 rounded-xl bg-purple-50/90 border border-purple-200/80 text-[11px] text-purple-950 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
                <span>
                  <strong>Native LiveKit Broadcast</strong>: In-app stage with slide presentations, audience listen-only mode, live Q&amp;A chat, and hand-raising.
                </span>
              </div>
            )}

            {platform !== "EDUMEET" && (
              <div className="mt-2.5">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {platform === "ZOOM" ? "Zoom Meeting Link *" : "Google Meet Link (Optional, automated if left blank)"}
                </label>
                <input
                  type="url"
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder={platform === "ZOOM" ? "https://zoom.us/j/..." : "https://meet.google.com/..."}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            )}
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

/* ── Modal: Attendee Registrations with 6 Mandatory Fields ── */
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
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchApi<{ total: number; registrations: Registration[] }>(`/live-class/${cls.id}/registrations`)
      .then((res) => setRegistrations(res.registrations || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cls.id]);

  const filtered = registrations.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.parentName && r.parentName.toLowerCase().includes(search.toLowerCase())) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone && r.phone.includes(search)) ||
      (r.courseOrClass && r.courseOrClass.toLowerCase().includes(search.toLowerCase())) ||
      (r.organization && r.organization.toLowerCase().includes(search.toLowerCase()))
  );

  const exportCsv = () => {
    if (!registrations.length) return;
    const headers = [
      "Student Name",
      "Attendance Status",
      "Parent Name",
      "Phone / WhatsApp",
      "Email Address",
      "Class / Course",
      "School / Institute",
      "Registered At",
    ];
    const rows = registrations.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.status || "REGISTERED"}"`,
      `"${(r.parentName || "—").replace(/"/g, '""')}"`,
      `"${(r.phone || "—").replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${(r.courseOrClass || "—").replace(/"/g, '""')}"`,
      `"${(r.organization || "—").replace(/"/g, '""')}"`,
      `"${new Date(r.registeredAt).toLocaleString("en-IN")}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `webinar-attendees-${cls.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {cls.isPublic ? "Registered Attendees (Webinar Roster)" : "Class Attendees & Enrolled Cohort Roster"}
            </h2>
            <p className="text-[11px] text-slate-500">
              {cls.title} • {registrations.length} total participants
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={registrations.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Public Webinar Share Link Bar */}
        {cls.isPublic && (
          <div className="px-6 py-3 bg-purple-50/80 border-b border-purple-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-purple-950 block">Public Webinar Link</span>
                <span className="text-[11px] font-mono text-purple-700 truncate block">
                  {typeof window !== "undefined" ? `${window.location.origin}/live/${cls.id}` : `/live/${cls.id}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/live/${cls.id}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
              <a
                href={`/live/${cls.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Page</span>
              </a>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, parent name, email, phone, class, or institute..."
            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl mb-4">
              {error}
            </p>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
              <p className="text-xs text-slate-500">Loading attendee roster...</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-12">
              {search ? "No attendees matching your search criteria." : "No attendees or participants recorded yet for this session."}
            </p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-3.5 py-3">Student Name</th>
                    <th className="px-3.5 py-3">Status</th>
                    <th className="px-3.5 py-3">Parent Name</th>
                    <th className="px-3.5 py-3">Contact</th>
                    <th className="px-3.5 py-3">Class / Course</th>
                    <th className="px-3.5 py-3">Institute</th>
                    <th className="px-3.5 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map((r) => {
                    const isAttended = r.status === "ATTENDED";
                    const isEnrolled = r.status === "ENROLLED";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3.5 py-3">
                          <p className="font-bold text-slate-900">{r.name}</p>
                        </td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isAttended
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : isEnrolled
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {r.status || "REGISTERED"}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-700">
                          {r.parentName || "—"}
                        </td>
                        <td className="px-3.5 py-3">
                          <p className="text-slate-800 font-medium font-mono text-[11px]">{r.phone || "—"}</p>
                          <p className="text-slate-400 text-[10px]">{r.email}</p>
                        </td>
                        <td className="px-3.5 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                            {r.courseOrClass || "—"}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 max-w-[160px] truncate" title={r.organization || "—"}>
                          {r.organization || "—"}
                        </td>
                        <td className="px-3.5 py-3 text-slate-400 text-[10px]">
                          {new Date(r.registeredAt).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Attachments & Handouts Modal for Staff ── */
function AttachmentsModalV2({
  cls,
  onClose,
}: {
  cls: ApiLiveClass;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchApi<any[]>(`/live-class/${cls.id}/files`);
      setFiles(Array.isArray(res) ? res : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [cls.id]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const presigned = await fetchApi<any>(
        `/storage/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`
      );

      if (!presigned?.uploadUrl || !presigned?.finalUrl) {
        throw new Error("Could not acquire storage upload credentials.");
      }

      const res = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!res.ok) {
        throw new Error(`Upload to storage server failed (${res.status})`);
      }

      await fetchApi(`/live-class/${cls.id}/files`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: presigned.finalUrl,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      fetchFiles();
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || "Please check storage configuration"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Remove "${fileName}" from this class?`)) return;
    try {
      await fetchApi(`/live-class/${cls.id}/files/${fileId}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || "Could not delete file"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 truncate max-w-sm">
                Attachments: {cls.title}
              </h3>
              <p className="text-xs text-slate-500">Shared handouts, worksheets, and slide decks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Upload Button */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700 font-bold text-xs transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Uploading file to storage...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 text-indigo-600" />
                <span>Upload New Handout or Slide Deck (PDF, Word, ZIP, Images)</span>
              </>
            )}
          </button>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex justify-center items-center text-xs text-slate-400 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
              Loading attachments...
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No attachments found for this class yet. Upload one above!
            </div>
          ) : (
            files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 hover:border-indigo-200 bg-white hover:bg-slate-50/50 transition-all group shadow-2xs"
              >
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {f.size ? `${(f.size / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                    {new Date(f.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={f.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => handleDelete(f.id, f.name)}
                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                    title="Delete file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
