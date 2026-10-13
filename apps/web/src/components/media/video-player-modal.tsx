"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, AlertCircle, Loader2, Play, Volume2, Maximize2 } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export interface VideoItem {
  id?: string;
  url: string;
  title?: string;
  subject?: string;
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const timeWatchedRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
          if (!isCancelled) {
            if (res?.playUrl) {
              const resYtId = getYouTubeId(res.playUrl);
              if (resYtId) {
                setPlayUrl(`https://www.youtube.com/embed/${resYtId}?autoplay=1&rel=0&modestbranding=1`);
              } else {
                setPlayUrl(res.playUrl);
              }
              setLoading(false);
              return;
            }
          }
        } catch (err: any) {
          console.warn("Failed to fetch presigned play URL, falling back to direct URL", err);
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
          setError("No video URL provided.");
        }
        setLoading(false);
      }
    };

    resolveUrl();

    return () => {
      isCancelled = true;
    };
  }, [video.id, video.url]);

  // Sync progress if material ID exists and user is student
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      timeWatchedRef.current = videoRef.current.currentTime;
    }
  };

  const handleEnded = () => {
    if (timeWatchedRef.current) {
      syncProgress(timeWatchedRef.current);
    }
  };

  const isIframe = playUrl?.includes("youtube.com/embed") || playUrl?.includes("player.vimeo.com");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-gray-950 rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900/80 border-b border-white/10">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">
              {video.title || "Video Player"}
            </h3>
            {video.subject && (
              <p className="text-xs text-brand-blue font-medium mt-0.5 truncate">
                {video.subject}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
            title="Close video (Esc)"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Video Canvas */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
              <p className="text-xs text-gray-400">Loading video stream...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-white px-6 text-center">
              <AlertCircle className="h-10 w-10 text-brand-red" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg transition-colors"
              >
                Close
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
            <video
              ref={videoRef}
              src={playUrl!}
              className="w-full h-full object-contain"
              controls
              autoPlay
              controlsList="nodownload"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={() => setError("Unable to play this video format.")}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
