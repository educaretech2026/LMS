"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Globe, Radio, Play, ArrowRight, ShieldCheck, CheckCircle2,
  Mic, MicOff, Video, VideoOff, X, Sparkles, Share2, Check
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface WebinarWelcomeLobbyProps {
  webinarTitle: string;
  subject: string;
  presenterName: string;
  initialName: string;
  isTeacher: boolean;
  classId?: string;
  backgroundImageUrl?: string | null;
  onJoin: (settings: { name: string; cameraEnabled: boolean; micEnabled: boolean }) => void;
  onCancel: () => void;
}

export function WebinarWelcomeLobby({
  webinarTitle,
  subject,
  presenterName,
  initialName,
  isTeacher,
  classId,
  backgroundImageUrl,
  onJoin,
  onCancel,
}: WebinarWelcomeLobbyProps) {
  const [displayName, setDisplayName] = useState(
    initialName || (isTeacher ? "Keynote Presenter" : "Webinar Attendee")
  );
  const [posterUrl, setPosterUrl] = useState<string | null>(backgroundImageUrl || null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Presenter preview state (only initialized for host/teacher)
  const [cameraEnabled, setCameraEnabled] = useState(isTeacher);
  const [micEnabled, setMicEnabled] = useState(isTeacher);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch poster if not passed directly via props
  useEffect(() => {
    if (backgroundImageUrl) {
      setPosterUrl(backgroundImageUrl);
      return;
    }
    if (classId) {
      fetchApi<any>(`/live-class/public/${classId}`, { silent: true })
        .then((cls) => {
          if (cls?.backgroundImageUrl) setPosterUrl(cls.backgroundImageUrl);
        })
        .catch(() => {
          fetchApi<any>(`/live-class/${classId}`, { silent: true })
            .then((cls) => {
              if (cls?.backgroundImageUrl) setPosterUrl(cls.backgroundImageUrl);
            })
            .catch(() => {});
        });
    }
  }, [classId, backgroundImageUrl]);

  // Presenter media preview initialization
  const startPresenterPreview = useCallback(async () => {
    if (!isTeacher) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Graceful fallback if device access not available
    }
  }, [isTeacher]);

  useEffect(() => {
    if (isTeacher) {
      startPresenterPreview();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isTeacher, startPresenterPreview]);

  const handleEnter = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    onJoin({
      name: displayName.trim() || initialName || (isTeacher ? "Presenter" : "Attendee"),
      cameraEnabled: isTeacher ? cameraEnabled : false,
      micEnabled: isTeacher ? micEnabled : false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#06080f] text-white overflow-hidden select-none">
      {/* ── BACKGROUND POSTER LAYER ── */}
      {posterUrl ? (
        <div
          className="absolute inset-0 z-0 bg-cover bg-left sm:bg-left-center bg-no-repeat transition-all duration-700"
          style={{ backgroundImage: `url("${posterUrl}")` }}
        />
      ) : (
        /* Minimalist Deep Ambient Fallback when no poster is uploaded */
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#060812] via-[#090d1c] to-[#060812]">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* ── DIRECTIONAL OVERLAY: Left 45% is 100% transparent for poster, Right side has dark contrast ── */}
      <div
        className="absolute inset-0 z-1 pointer-events-none"
        style={{
          background: posterUrl
            ? "linear-gradient(to right, transparent 0%, transparent 35%, rgba(6,8,15,0.45) 55%, rgba(6,8,15,0.85) 75%, rgba(6,8,15,0.98) 100%)"
            : "linear-gradient(to right, transparent 0%, rgba(6,8,15,0.6) 50%, rgba(6,8,15,0.95) 100%)",
        }}
      />

      {/* Mobile-specific bottom scrim to ensure readability on small screens */}
      <div
        className="absolute inset-0 z-1 pointer-events-none sm:hidden"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, rgba(6,8,15,0.4) 30%, rgba(6,8,15,0.9) 65%, #06080f 100%)",
        }}
      />

      {/* ── TOP HEADER (Minimal & Clean) ── */}
      <header className="relative z-10 shrink-0 h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white shadow-sm">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            LIVE WEBINAR
          </span>
          {subject && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 font-medium">
              {subject}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {classId && (
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/live/${classId}`;
                navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 text-xs font-semibold backdrop-blur-md transition-colors"
              title="Copy public webinar registration and join link"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
            </button>
          )}

          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA: LEFT SIDE KEPT COMPLETELY OPEN FOR POSTER ── */}
      <main className="relative z-10 flex-1 flex flex-col justify-end lg:justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        <div className="w-full flex justify-end">
          {/* ── RIGHT-ALIGNED MINIMAL ENTRY PANEL ── */}
          <div className="w-full sm:max-w-md lg:w-[420px] xl:w-[440px] rounded-3xl bg-[#0c0e18]/85 border border-white/15 shadow-2xl backdrop-blur-2xl p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Title & Presenter Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  <Globe className="h-3 w-3" />
                  Keynote Session
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug line-clamp-2">
                {webinarTitle || "Special Webinar"}
              </h1>

              <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                <div className="h-6 w-6 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 text-[11px] font-bold shrink-0">
                  {(presenterName || "P")[0].toUpperCase()}
                </div>
                <span className="truncate font-medium">{presenterName || "Educare Presenter"}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              </div>
            </div>

            <div className="h-px bg-white/10 w-full" />

            {/* Entry Form */}
            {isTeacher ? (
              /* ── HOST / PRESENTER ENTRY DETAILS ── */
              <div className="space-y-4">
                {/* Presenter Video Check */}
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
                  {cameraEnabled ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  ) : (
                    <div className="text-white/40 text-xs flex flex-col items-center gap-1">
                      <VideoOff className="h-4 w-4" />
                      <span>Camera is off</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !cameraEnabled;
                        setCameraEnabled(next);
                        if (streamRef.current) streamRef.current.getVideoTracks().forEach(t => (t.enabled = next));
                      }}
                      className="text-white hover:text-purple-300 p-0.5"
                    >
                      {cameraEnabled ? <Video size={13} /> : <VideoOff size={13} className="text-rose-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !micEnabled;
                        setMicEnabled(next);
                        if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => (t.enabled = next));
                      }}
                      className="text-white hover:text-purple-300 p-0.5"
                    >
                      {micEnabled ? <Mic size={13} /> : <MicOff size={13} className="text-rose-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Presenter Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Presenter Name"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>

                <button
                  onClick={handleEnter}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Radio className="h-4 w-4" />
                  <span>Start Webinar Broadcast</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* ── AUDIENCE / ATTENDEE ENTRY DETAILS ── */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Name (for Live Q&amp;A Chat)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>

                {/* Minimal Audience Notice */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Audience mode: Listen-only with live Q&amp;A chat and hand-raising.</span>
                </div>

                {/* Enter Button */}
                <button
                  onClick={handleEnter}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Enter Webinar</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <p className="text-[11px] text-center text-slate-400">
                  Camera and mic are off to keep stage focused on the presenter.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MINIMAL FOOTER ── */}
      <footer className="relative z-10 shrink-0 h-10 px-4 sm:px-8 flex items-center justify-between text-[11px] text-slate-500">
        <span>Educare Live Webinar Platform</span>
        <span>HD Broadcast &amp; Keynote Presentation</span>
      </footer>
    </div>
  );
}
