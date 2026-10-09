"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import api from "@/lib/api"; // Assuming a centralized api client exists

export default function VideoPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [material, setMaterial] = useState<any>(null);
  const [timeWatched, setTimeWatched] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncTime = useRef<number>(0);

  useEffect(() => {
    // Fetch the material details
    const fetchMaterial = async () => {
      try {
        const res = await api.get(`/study-materials/${id}`);
        setMaterial(res.data);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load video. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchMaterial();
  }, [id]);

  useEffect(() => {
    // Sync progress periodically every 10 seconds
    const interval = setInterval(() => {
      if (timeWatched > lastSyncTime.current) {
        syncProgress(timeWatched);
        lastSyncTime.current = timeWatched;
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      // Sync on unmount
      if (timeWatched > lastSyncTime.current) {
        syncProgress(timeWatched);
      }
    };
  }, [timeWatched, id]);

  const syncProgress = async (seconds: number) => {
    try {
      await api.post(`/study-materials/${id}/progress`, {
        timeWatchedSecs: Math.floor(seconds),
        isOpened: true,
      });
    } catch (err) {
      console.error("Failed to sync video progress", err);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setTimeWatched(videoRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    syncProgress(timeWatched);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-950 text-white gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-lg">{error || "Video not found"}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-white text-black rounded-md flex items-center gap-2 hover:bg-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const isYouTube = material.url?.includes("youtube.com") || material.url?.includes("youtu.be");

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-800">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold truncate">{material.title}</h1>
      </div>

      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
        {isYouTube ? (
          <div className="w-full max-w-5xl aspect-video">
            {/* NOTE: For proper time tracking on YouTube, you should implement the YouTube IFrame Player API.
                This is a placeholder iframe. */}
            <iframe
              src={material.url.replace("watch?v=", "embed/") + "?enablejsapi=1"}
              className="w-full h-full border-0"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={material.url}
            className="w-full max-w-5xl max-h-full aspect-video outline-none shadow-2xl"
            controls
            autoPlay
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        )}
      </div>
    </div>
  );
}
