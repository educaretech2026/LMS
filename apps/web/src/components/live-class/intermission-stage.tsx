"use client";

import { useEffect, useState } from "react";
import { BreakState } from "./studio-types";
import { Clock, Coffee, Play, Plus, XCircle, Sparkles } from "lucide-react";

interface IntermissionStageProps {
  breakState: BreakState;
  isTeacher: boolean;
  onEndBreak: () => void;
  onExtendBreak: (minutes: number) => void;
}

export function IntermissionStage({
  breakState,
  isTeacher,
  onEndBreak,
  onExtendBreak,
}: IntermissionStageProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Math.max(0, Math.floor((breakState.endsAt - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((breakState.endsAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    }, 500);

    return () => clearInterval(interval);
  }, [breakState.endsAt]);

  const totalSeconds = (breakState.durationMinutes || 5) * 60;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100))
  );

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 bg-gradient-to-br from-[#07090e] via-[#0d111c] to-[#07090e] text-white overflow-y-auto">
      {/* Top Bar with Status & Timer */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Coffee className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Class Intermission</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            </div>
            <h2 className="text-base font-bold text-white">{breakState.title || "Short Class Break"}</h2>
          </div>
        </div>

        {/* Large Countdown Badge */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2 rounded-2xl shadow-inner">
          <Clock className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider leading-none">Resuming In</p>
            <p className="text-2xl font-mono font-black text-amber-300 leading-tight">
              {formatTime(secondsLeft)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-4xl mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Center Media / Ad Showcase */}
      <div className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center my-6 gap-4">
        {breakState.mediaType === "VIDEO" && breakState.mediaUrl ? (
          <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
            <video
              src={breakState.mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80">
              <Sparkles size={12} className="text-amber-400" /> Sponsored Break
            </div>
          </div>
        ) : breakState.mediaType === "BANNER" && breakState.mediaUrl ? (
          <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={breakState.mediaUrl}
              alt="Intermission Ad"
              className="w-full max-h-[380px] object-contain rounded-2xl"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/80">
              <Sparkles size={12} className="text-amber-400" /> Feature Highlight
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-lg bg-white/5 rounded-3xl border border-white/10">
            <Coffee className="h-16 w-16 text-amber-400/80 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">{breakState.title}</h3>
            <p className="text-sm text-white/70">
              {breakState.message || "Take a moment to grab water and stretch. The teacher will resume the lecture shortly."}
            </p>
          </div>
        )}

        {/* Message Banner underneath */}
        {breakState.message && breakState.mediaType !== "ANNOUNCEMENT" && (
          <div className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-center max-w-xl">
            <p className="text-xs text-white/80 font-medium">📢 {breakState.message}</p>
          </div>
        )}
      </div>

      {/* Bottom Controls (Teacher only actions / Student info) */}
      <div className="w-full max-w-4xl border-t border-white/10 pt-4 flex items-center justify-between">
        <p className="text-xs text-white/40">
          Chat and file sharing remain open during the break.
        </p>

        {isTeacher ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExtendBreak(2)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} /> +2 Min
            </button>
            <button
              onClick={() => onExtendBreak(5)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={13} /> +5 Min
            </button>
            <button
              onClick={onEndBreak}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-transform hover:scale-105"
            >
              <Play size={13} /> Resume Class Now
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Ready to resume automatically when timer ends</span>
          </div>
        )}
      </div>
    </div>
  );
}

