"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Video, VideoOff, Mic, MicOff, Settings, Sparkles,
  ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, X, Users, Globe, Radio, Presentation
} from "lucide-react";

interface PreJoinLobbyProps {
  classTitle: string;
  subject: string;
  teacherName: string;
  initialName: string;
  isTeacher: boolean;
  isWebinar?: boolean;
  onJoin: (settings: { name: string; cameraEnabled: boolean; micEnabled: boolean }) => void;
  onCancel: () => void;
}

export function PreJoinLobby({
  classTitle,
  subject,
  teacherName,
  initialName,
  isTeacher,
  isWebinar = false,
  onJoin,
  onCancel,
}: PreJoinLobbyProps) {
  const [displayName, setDisplayName] = useState(
    initialName || (isTeacher ? (isWebinar ? "Presenter" : "Teacher") : (isWebinar ? "Attendee" : "Student"))
  );
  // In webinars, attendees start with camera & mic disabled (listen-only audience)
  const [cameraEnabled, setCameraEnabled] = useState(!isWebinar || isTeacher);
  const [micEnabled, setMicEnabled] = useState(!isWebinar || isTeacher);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Camera & Microphone Preview
  const startPreview = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;
      setHasPermission(true);
      setPermissionError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Audio Level Analyser
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(checkAudio);
        };
        checkAudio();
      } catch (audioErr) {
        console.warn("Audio meter initialization skipped:", audioErr);
      }
    } catch (err: any) {
      console.warn("Media devices permission error:", err);
      setHasPermission(false);
      setPermissionError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera / Microphone permission was denied in your browser. You can still join in view-only mode."
          : "Could not access video or microphone device."
      );
    }
  }, []);

  useEffect(() => {
    startPreview();
    return () => {
      // Clean up preview stream when navigating away
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
  }, [startPreview]);

  // Handle Camera Toggle
  const toggleCamera = () => {
    const next = !cameraEnabled;
    setCameraEnabled(next);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    }
  };

  // Handle Mic Toggle
  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    }
  };

  const handleJoinClick = () => {
    // Stop local preview tracks so LiveKit can acquire the devices cleanly
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
      name: displayName.trim() || initialName || "Participant",
      cameraEnabled,
      micEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090e] p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl w-full flex flex-col lg:flex-row items-center gap-8 justify-between">
        {/* Left: Video Preview Feed (Google Meet Style) */}
        <div className="w-full lg:w-[58%] flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center">
            {isWebinar && !isTeacher ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-white/80 max-w-sm">
                <div className="h-16 w-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-600/10">
                  <Radio size={28} className="animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Webinar Broadcast Stage</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  You are joining as an audience member in listen-only mode. The stage will focus on the keynote presenter and slides.
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-purple-300">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Audience Mode (Webcam & Mic Off)</span>
                </div>
              </div>
            ) : cameraEnabled && hasPermission !== false ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-white/50">
                <div className="h-20 w-20 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-2xl shadow-inner">
                  {(displayName || "U")[0].toUpperCase()}
                </div>
                <p className="text-xs font-semibold">Camera is off</p>
              </div>
            )}

            {/* Bottom Floating Control Bar */}
            {isWebinar && !isTeacher ? (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-purple-950/80 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30 text-purple-200 text-xs shadow-xl">
                <Globe size={14} className="text-purple-400" />
                <span>Audience Mode: Listen Only</span>
              </div>
            ) : (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/15 shadow-xl">
                <button
                  onClick={toggleMic}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                    micEnabled
                      ? "bg-white/15 hover:bg-white/25 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30"
                  }`}
                  title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button
                  onClick={toggleCamera}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
                    cameraEnabled
                      ? "bg-white/15 hover:bg-white/25 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30"
                  }`}
                  title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
                >
                  {cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

                {/* Mic Level Indicator Dots */}
                {micEnabled && (
                  <div className="flex items-center gap-1 pl-2 border-l border-white/20">
                    <span
                      className={`h-2.5 w-1 rounded-full transition-all duration-75 ${
                        audioLevel > 10 ? "bg-emerald-400 h-4" : "bg-white/30"
                      }`}
                    />
                    <span
                      className={`h-2.5 w-1 rounded-full transition-all duration-75 ${
                        audioLevel > 30 ? "bg-emerald-400 h-5" : "bg-white/30"
                      }`}
                    />
                    <span
                      className={`h-2.5 w-1 rounded-full transition-all duration-75 ${
                        audioLevel > 60 ? "bg-emerald-400 h-6" : "bg-white/30"
                      }`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {permissionError && (
            <p className="text-[11px] text-amber-400 mt-3 text-center flex items-center gap-1.5">
              <AlertCircle size={13} className="shrink-0" />
              <span>{permissionError}</span>
            </p>
          )}
        </div>

        {/* Right: Session Info & Join Card */}
        <div className="w-full lg:w-[42%] flex flex-col gap-5 text-white">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isWebinar ? "bg-purple-400" : "bg-emerald-400"
                } opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isWebinar ? "bg-purple-500" : "bg-emerald-500"
                }`} />
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                isWebinar ? "text-purple-400" : "text-emerald-400"
              }`}>
                {isWebinar ? (isTeacher ? "Keynote Broadcast" : "Webinar Session") : "Ready to Join"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                {subject}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
              {classTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isWebinar ? `Keynote Presenter: ${teacherName}` : `Instructor: ${teacherName}`}
            </p>
          </div>

          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              {isWebinar
                ? isTeacher
                  ? "Presenter Full Name"
                  : "Your Name (Webinar Attendee)"
                : "Your Display Name in Class"}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
          </div>

          {/* Device Readiness Badges */}
          {isWebinar && !isTeacher ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl border border-purple-500/20 bg-purple-950/20 flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                <span className="text-purple-200">Mode: Listen Only</span>
              </div>
              <div className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-200">Q&amp;A: Active</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-2.5">
                <div className={`h-2.5 w-2.5 rounded-full ${cameraEnabled ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-slate-300">Camera: {cameraEnabled ? "Ready" : "Muted"}</span>
              </div>
              <div className="p-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-2.5">
                <div className={`h-2.5 w-2.5 rounded-full ${micEnabled ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-slate-300">Mic: {micEnabled ? "Active" : "Muted"}</span>
              </div>
            </div>
          )}

          {/* Join Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-5 py-3 rounded-2xl border border-white/15 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleJoinClick}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white text-sm font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] ${
                isWebinar
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
              }`}
            >
              <span>
                {isWebinar
                  ? isTeacher
                    ? "Start Webinar Broadcast"
                    : "Join Webinar Broadcast"
                  : "Join Classroom Now"}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

