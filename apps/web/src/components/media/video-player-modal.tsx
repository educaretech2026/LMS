"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  X,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  PictureInPicture,
  Film,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export interface VideoItem {
  id?: string;
  url: string;
  title?: string;
  subject?: string;
  durationSeconds?: number;
}

export function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})/
  );
  return match ? match[1] : null;
}

export function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v") ||
    cleanUrl.endsWith(".m3u8") ||
    Boolean(getYouTubeId(url)) ||
    url.includes("vimeo.com")
  );
}

function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const padSec = secs < 10 ? `0${secs}` : `${secs}`;
  if (hrs > 0) {
    const padMin = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${padMin}:${padSec}`;
  }
  return `${mins}:${padSec}`;
}

export function VideoPlayerModal({
  video,
  onClose,
}: {
  video: VideoItem;
  onClose: () => void;
}) {
  const { role } = useAuth();
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(video.durationSeconds || 0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [showRipple, setShowRipple] = useState<"play" | "pause" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<any>(null);
  const timeWatchedRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        skipTime(-10);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        skipTime(10);
      } else if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "m") {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isPlaying]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch presigned URL if material ID exists, or fall back to video.url
  useEffect(() => {
    let isCancelled = false;

    const resolveUrl = async () => {
      setLoading(true);
      setError(null);

      const ytId = getYouTubeId(video.url);
      if (ytId) {
        setPlayUrl(`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`);
        setLoading(false);
        return;
      }

      if (video.id) {
        try {
          const res = await fetchApi<any>(`/study-materials/${video.id}/play-url`);
          if (!isCancelled && res?.playUrl) {
            const resYtId = getYouTubeId(res.playUrl);
            if (resYtId) {
              setPlayUrl(`https://www.youtube.com/embed/${resYtId}?autoplay=1&rel=0&modestbranding=1`);
            } else {
              setPlayUrl(res.playUrl);
            }
            setLoading(false);
            return;
          }
        } catch (err: any) {
          console.warn("Presigned URL fetch failed, using direct URL", err);
        }
      }

      if (!isCancelled) {
        if (video.url) {
          const directYtId = getYouTubeId(video.url);
          if (directYtId) {
            setPlayUrl(`https://www.youtube.com/embed/${directYtId}?autoplay=1&rel=0&modestbranding=1`);
          } else {
            setPlayUrl(video.url);
          }
        } else {
          setError("No video stream URL provided.");
        }
        setLoading(false);
      }
    };

    resolveUrl();

    return () => {
      isCancelled = true;
    };
  }, [video.id, video.url]);

  // Student progress sync
  const syncProgress = async (seconds: number) => {
    if (!video.id || role !== "STUDENT") return;
    try {
      await fetchApi(`/study-materials/${video.id}/progress`, {
        method: "POST",
        body: JSON.stringify({
          timeWatchedSecs: Math.floor(seconds),
          isOpened: true,
        }),
      });
    } catch (err) {
      console.warn("Could not sync video progress", err);
    }
  };

  useEffect(() => {
    if (!video.id || role !== "STUDENT") return;

    const interval = setInterval(() => {
      if (timeWatchedRef.current > lastSyncTimeRef.current) {
        syncProgress(timeWatchedRef.current);
        lastSyncTimeRef.current = timeWatchedRef.current;
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (timeWatchedRef.current > lastSyncTimeRef.current) {
        syncProgress(timeWatchedRef.current);
      }
    };
  }, [video.id, role]);

  // Autohide controls on inactivity
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setShowRipple("play");
        setTimeout(() => setShowRipple(null), 500);
      }).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowRipple("pause");
      setTimeout(() => setShowRipple(null), 500);
    }
    handleUserActivity();
  };

  const skipTime = (delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.currentTime + delta, duration || 999999));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    handleUserActivity();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    handleUserActivity();
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
    handleUserActivity();
  };

  const cyclePlaybackRate = () => {
    if (!videoRef.current) return;
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    videoRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
    handleUserActivity();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    handleUserActivity();
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("PiP not supported or disallowed", e);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);
    timeWatchedRef.current = cur;

    // Resolve duration for streaming WebM if Infinity or NaN
    const rawDur = videoRef.current.duration;
    if (Number.isFinite(rawDur) && rawDur > 0) {
      setDuration(rawDur);
    } else if (videoRef.current.seekable && videoRef.current.seekable.length > 0) {
      const seekEnd = videoRef.current.seekable.end(videoRef.current.seekable.length - 1);
      if (Number.isFinite(seekEnd) && seekEnd > duration) {
        setDuration(seekEnd);
      }
    }

    // Buffer range calculation
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const total = duration || rawDur;
      if (total > 0) {
        setBufferedPercent(Math.min(100, (bufferedEnd / total) * 100));
      }
    }
  };

  const handleScrubberSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current || !videoRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * (duration || 1);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    handleUserActivity();
  };

  const handleScrubberHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * (duration || 0));
    setIsHoveringScrubber(true);
  };

  const isIframe = playUrl?.includes("youtube.com/embed") || playUrl?.includes("player.vimeo.com");
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-[#07090e] text-white select-none overflow-hidden animate-in fade-in duration-200"
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
    >
      {/* ── DEDICATED THEATER TOP HEADER ── */}
      <header
        className={`w-full h-14 sm:h-16 px-4 sm:px-6 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
            title="Exit Theater Mode (Esc)"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline text-xs font-bold text-white/90">Exit Theater</span>
          </button>

          <div className="h-4 w-[1px] bg-white/20 hidden sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate drop-shadow">
                {video.title || "Dedicated Video Player"}
              </h2>
              {video.subject && (
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-bold">
                  {video.subject}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 truncate hidden sm:block">
              {isIframe ? "Interactive Online Stream" : "Educare Cloud Media Player · HD 1080p"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70 font-mono">
            <Film size={12} className="text-purple-400" />
            <span>Theater Mode</span>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── CINEMA VIDEO STAGE ── */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-xs text-white/70 font-medium">Buffering video stream...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-white px-6 text-center max-w-md">
            <div className="h-12 w-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Playback Error</h3>
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close Player
            </button>
          </div>
        ) : isIframe ? (
          <iframe
            src={playUrl!}
            className="w-full h-full border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={playUrl!}
              className="w-full h-full object-contain cursor-pointer"
              playsInline
              autoPlay
              controlsList="nodownload"
              onClick={togglePlay}
              onDoubleClick={toggleFullscreen}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  const raw = videoRef.current.duration;
                  if (Number.isFinite(raw) && raw > 0) setDuration(raw);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (timeWatchedRef.current) syncProgress(timeWatchedRef.current);
              }}
              onError={() => setError("The video stream format is unreadable or corrupted.")}
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Ripple Center Indicator on Play/Pause Click */}
            {showRipple && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="h-20 w-20 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-2xl animate-ping duration-300">
                  {showRipple === "play" ? (
                    <Play size={36} className="fill-white translate-x-0.5" />
                  ) : (
                    <Pause size={36} className="fill-white" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CUSTOM IMMERSIVE CONTROLS DOCK (FOR DIRECT VIDEO STREAMS) ── */}
      {!isIframe && !loading && !error && (
        <div
          className={`w-full px-4 sm:px-6 pb-4 sm:pb-6 pt-10 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex flex-col gap-2 z-30 transition-opacity duration-300 ${
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* 1. Custom Interactive Status Bar / Scrubber */}
          <div
            ref={scrubberRef}
            onClick={handleScrubberSeek}
            onMouseMove={handleScrubberHover}
            onMouseLeave={() => setIsHoveringScrubber(false)}
            className="w-full h-3 group/bar flex items-center cursor-pointer relative"
          >
            {/* Background Track */}
            <div className="w-full h-1.5 group-hover/bar:h-2 rounded-full bg-white/20 transition-all overflow-hidden relative">
              {/* Buffered Range Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Current Playback Progress Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Draggable Scrubber Thumb */}
            <div
              className="absolute h-3.5 w-3.5 rounded-full bg-white shadow-lg scale-0 group-hover/bar:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            />

            {/* Hover Timestamp Tooltip */}
            {isHoveringScrubber && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-white/20 text-[10px] font-mono text-white shadow-lg pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
              >
                {formatPlayerTime(hoverTime)}
              </div>
            )}
          </div>

          {/* 2. Controls Toolbar */}
          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Left Controls: Play/Pause, Skips, Volume, Time Display */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={togglePlay}
                className="h-9 w-9 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <Pause size={18} className="fill-black" />
                ) : (
                  <Play size={18} className="fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => skipTime(-10)}
                className="h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Rewind 10s (Left Arrow)"
              >
                <RotateCcw size={16} />
              </button>

              <button
                onClick={() => skipTime(10)}
                className="h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Forward 10s (Right Arrow)"
              >
                <RotateCw size={16} />
              </button>

              {/* Volume Slider Group */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                  title={isMuted ? "Unmute (m)" : "Mute (m)"}
                >
                  {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 h-1 bg-white/20 accent-blue-500 rounded-lg cursor-pointer hidden sm:block opacity-75 group-hover/vol:opacity-100 transition-opacity"
                  title="Volume"
                />
              </div>

              {/* Status Runtime Time Display */}
              <div className="text-xs font-mono text-white/80 pl-1 select-none flex items-center gap-1">
                <span className="font-bold text-white">{formatPlayerTime(currentTime)}</span>
                <span className="text-white/40">/</span>
                <span className="text-white/60">
                  {duration > 0 ? formatPlayerTime(duration) : "--:--"}
                </span>
              </div>
            </div>

            {/* Right Controls: Speed, PiP, Fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={cyclePlaybackRate}
                className="h-8 px-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-xs font-semibold font-mono text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Change Playback Speed"
              >
                {playbackRate}x
              </button>

              {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
                <button
                  onClick={togglePiP}
                  className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer hidden sm:flex"
                  title="Picture in Picture"
                >
                  <PictureInPicture size={16} />
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
              >
                {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
