"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Globe, Radio, Presentation, Sparkles, Play, ArrowRight,
  ShieldCheck, MessageSquare, Hand, Mic, MicOff, Video,
  VideoOff, Users, CheckCircle2, ChevronRight, X
} from "lucide-react";

interface WebinarWelcomeLobbyProps {
  webinarTitle: string;
  subject: string;
  presenterName: string;
  initialName: string;
  isTeacher: boolean;
  onJoin: (settings: { name: string; cameraEnabled: boolean; micEnabled: boolean }) => void;
  onCancel: () => void;
}

export function WebinarWelcomeLobby({
  webinarTitle,
  subject,
  presenterName,
  initialName,
  isTeacher,
  onJoin,
  onCancel,
}: WebinarWelcomeLobbyProps) {
  const [displayName, setDisplayName] = useState(
    initialName || (isTeacher ? "Keynote Presenter" : "Webinar Attendee")
  );

  // Presenter Studio Preview State (only needed when isTeacher is true)
  const [cameraEnabled, setCameraEnabled] = useState(isTeacher);
  const [micEnabled, setMicEnabled] = useState(isTeacher);
  const [audioLevel, setAudioLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Presenter: Initialize camera & mic preview
  const startPresenterPreview = useCallback(async () => {
    if (!isTeacher) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAudioLevel(Math.min(100, Math.round((sum / dataArray.length) * 1.5)));
        animFrameRef.current = requestAnimationFrame(checkAudio);
      };
      checkAudio();
    } catch {
      // Ignore if devices not available
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
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isTeacher, startPresenterPreview]);

  const handleEnterStage = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    onJoin({
      name: displayName.trim() || initialName || (isTeacher ? "Presenter" : "Attendee"),
      cameraEnabled: isTeacher ? cameraEnabled : false,
      micEnabled: isTeacher ? micEnabled : false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070811] text-white overflow-y-auto selection:bg-purple-600 selection:text-white">
      {/* Ambient Cosmic Stage Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-600/15 via-indigo-600/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-20 shrink-0 h-16 border-b border-white/10 px-4 sm:px-8 flex items-center justify-between backdrop-blur-md bg-black/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Educare Keynote Broadcast
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                STAGE WAITING ROOM
              </span>
            </div>
            <p className="text-[11px] text-white/50 hidden sm:block">Public Webinar & Masterclass Platform</p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          <span>Exit</span>
        </button>
      </header>

      {/* Main Welcome Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
        {/* Main Stage Welcome Card */}
        <div className="w-full rounded-3xl bg-[#0f111c]/90 border border-purple-500/25 shadow-2xl backdrop-blur-xl overflow-hidden p-6 sm:p-10 flex flex-col gap-8">
          {/* Header Tag & Title */}
          <div className="space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                {subject || "Public Masterclass"}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                Live Broadcast Session
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {webinarTitle || "Special Webinar Masterclass"}
            </h1>

            {/* Presenter Profile Pill */}
            <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {(presenterName || "P")[0].toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{presenterName || "Educare Keynote Presenter"}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                </p>
                <p className="text-[11px] text-purple-300/80">Keynote Speaker & Host</p>
              </div>
            </div>
          </div>

          {/* 3 Pillars of Webinar Format */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-3">
                <Presentation className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Keynote Stage Presentation</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                The main stage focuses on high-definition speaker video, slide decks, and live demonstrations.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-3">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Audience Listen-Only Mode</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Attendee webcams and microphones are silenced to maintain optimal stream bandwidth and zero distractions.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-3">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Interactive Q&amp;A &amp; Hand Raise</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Post questions in real-time chat and raise your hand to notify the keynote speaker during discussion periods.
              </p>
            </div>
          </div>

          {/* Bottom Admission & Entrance Section */}
          <div className="pt-6 border-t border-white/10">
            {isTeacher ? (
              /* ── TEACHER / PRESENTER STUDIO PORTAL ── */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Radio className="h-4 w-4 text-purple-400" />
                      Presenter Studio Equipment Check
                    </h3>
                    <p className="text-xs text-slate-400">Preview your broadcast feed before opening the stage.</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Host Mode
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-center">
                  <div className="w-full sm:w-64 aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 relative shrink-0">
                    {cameraEnabled ? (
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-white/40 gap-1 text-xs font-medium">
                        <VideoOff className="h-5 w-5" />
                        <span>Camera Off</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                      <button
                        onClick={() => {
                          const next = !cameraEnabled;
                          setCameraEnabled(next);
                          if (streamRef.current) streamRef.current.getVideoTracks().forEach(t => t.enabled = next);
                        }}
                        className="text-white hover:text-purple-300"
                      >
                        {cameraEnabled ? <Video size={13} /> : <VideoOff size={13} className="text-rose-400" />}
                      </button>
                      <button
                        onClick={() => {
                          const next = !micEnabled;
                          setMicEnabled(next);
                          if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => t.enabled = next);
                        }}
                        className="text-white hover:text-purple-300"
                      >
                        {micEnabled ? <Mic size={13} /> : <MicOff size={13} className="text-rose-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Presenter Full Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Presenter Name"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                      />
                    </div>

                    <button
                      onClick={handleEnterStage}
                      className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-xl shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <Radio className="h-4 w-4" />
                      <span>Start Webinar Broadcast</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── AUDIENCE / ATTENDEE ADMISSION PORTAL ── */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="space-y-1 w-full sm:max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white">Attendee Admission Verified</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Your Display Name (shown in Live Q&amp;A Chat)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0 flex flex-col items-center sm:items-end gap-2">
                  <button
                    onClick={handleEnterStage}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-xl shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Enter Webinar Stage</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-[11px] text-purple-300/70 text-center sm:text-right">
                    Entering in audience listen-only mode
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

