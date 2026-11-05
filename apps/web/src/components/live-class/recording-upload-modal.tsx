"use client";

import React, { useState } from "react";
import {
  X,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  HardDrive,
  Copy,
  Check,
  Play,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { compressVideo } from "@/lib/video-compressor";
import { VideoPlayerModal } from "@/components/media/video-player-modal";

export { VideoPlayerModal };

interface RecordingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoBlob: Blob | null;
  classId?: string;
  classTitle?: string;
  durationSeconds?: number;
  onUploaded?: (url: string) => void;
}

function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(totalSec: number = 0): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function RecordingUploadModal({
  isOpen,
  onClose,
  videoBlob,
  classId,
  classTitle,
  durationSeconds = 0,
  onUploaded,
}: RecordingUploadModalProps) {
  const [phase, setPhase] = useState<"ready" | "compressing" | "uploading" | "saving" | "done" | "error">("ready");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  if (!isOpen || !videoBlob) return null;

  const rawSize = videoBlob.size;

  // Local immediate download
  const handleDownloadLocal = () => {
    try {
      const blobToDownload = compressedBlob || videoBlob;
      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (classTitle || "live-class-recording").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `${safeTitle}_${dateStr}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      alert(`Local download failed: ${e?.message}`);
    }
  };

  // Compress & Upload upon request
  const handleCompressAndUpload = async () => {
    try {
      setErrorMessage("");
      setPhase("compressing");
      setProgressPercent(5);
      setStatusMessage("Starting video compression engine...");

      // Step 1: Compress video in-browser
      let finalBlobToUpload = videoBlob;
      let finalSizeBytes = videoBlob.size;

      try {
        const result = await compressVideo(videoBlob, {
          maxWidth: 1280,
          maxHeight: 720,
          targetFps: 24,
          videoBitrate: 1_200_000, // 1.2 Mbps
          playbackRate: 2.0,
          onProgress: ({ percent, stage }) => {
            setProgressPercent(percent);
            setStatusMessage(stage);
          },
        });

        if (result?.compressedBlob && result.compressedBlob.size > 0) {
          finalBlobToUpload = result.compressedBlob;
          finalSizeBytes = result.compressedSize;
          setCompressedBlob(result.compressedBlob);
          setCompressedSize(result.compressedSize);
        }
      } catch (compressionErr: any) {
        console.warn("Video compression encountered issue, falling back to original blob:", compressionErr);
        setStatusMessage("Compression fallback active, preparing upload...");
      }

      // Step 2: Request presigned upload URL from cloud storage with 'recordings' prefix
      setPhase("uploading");
      setProgressPercent(10);
      setStatusMessage("Requesting cloud storage upload credentials...");

      const safeFilename = `${(classTitle || "recording").replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.webm`;
      const presignedRes = await fetchApi<any>(
        `/storage/presigned-url?filename=${encodeURIComponent(safeFilename)}&contentType=video/webm&prefix=recordings`
      );

      if (!presignedRes?.uploadUrl || !presignedRes?.finalUrl) {
        throw new Error("Could not acquire cloud storage presigned URL. Please verify R2/S3 storage configuration.");
      }

      // Step 3: Direct PUT upload to S3 / Cloudflare R2 with XMLHttpRequest progress tracking
      setStatusMessage("Uploading compressed video to cloud storage...");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedRes.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", "video/webm");

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const uploadPercent = Math.round((evt.loaded / evt.total) * 100);
            setProgressPercent(uploadPercent);
            setStatusMessage(`Uploading to cloud... ${uploadPercent}% (${formatBytes(evt.loaded)} / ${formatBytes(evt.total)})`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Cloud storage upload failed with status HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during cloud storage upload."));
        xhr.onabort = () => reject(new Error("Upload was aborted."));

        xhr.send(finalBlobToUpload);
      });

      // Step 4: Associate with Class Record on backend
      setPhase("saving");
      setProgressPercent(100);
      setStatusMessage("Registering recording in class database...");

      if (classId) {
        await fetchApi(`/live-class/${classId}/recording/save`, {
          method: "POST",
          body: JSON.stringify({
            recordingUrl: presignedRes.finalUrl,
            fileSize: finalSizeBytes,
            duration: durationSeconds,
          }),
        });
      }

      setUploadedUrl(presignedRes.finalUrl);
      setPhase("done");
      onUploaded?.(presignedRes.finalUrl);
    } catch (err: any) {
      console.error("Recording compression and upload failed:", err);
      setPhase("error");
      setErrorMessage(err?.message || "Something went wrong during video compression or upload.");
    }
  };

  const savedPercent =
    compressedSize > 0 && rawSize > 0
      ? Math.max(0, Math.round(((rawSize - compressedSize) / rawSize) * 100))
      : 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg rounded-2xl bg-[#12151e] border border-white/10 shadow-2xl p-6 text-white flex flex-col gap-5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Film size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">Session Recording Completed</h3>
                <p className="text-xs text-white/50 truncate max-w-[280px]">
                  {classTitle || "Live Class / Webinar Session"}
                </p>
              </div>
            </div>
            {phase !== "compressing" && phase !== "uploading" && phase !== "saving" && (
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Phase 1: Ready / Choices */}
          {phase === "ready" && (
            <div className="flex flex-col gap-4">
              {/* Stats card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div>
                  <span className="text-white/40 block text-[11px]">Total Duration</span>
                  <span className="font-bold text-white text-sm">{formatDuration(durationSeconds)}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[11px]">Raw Captured Size</span>
                  <span className="font-bold text-white text-sm">{formatBytes(rawSize)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Upon request, your recording can be compressed directly to reduce size by up to <strong>75%</strong>, then uploaded to your cloud storage bucket for student access.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  onClick={handleDownloadLocal}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  title="Download a local backup to your device"
                >
                  <Download size={15} />
                  <span>Download Local Backup</span>
                </button>

                <button
                  onClick={handleCompressAndUpload}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all active:scale-95 cursor-pointer"
                  title="Compress video and upload to Cloudflare R2 / S3"
                >
                  <UploadCloud size={16} />
                  <span>Compress & Upload to Cloud</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase 2: Processing (Compressing or Uploading) */}
          {(phase === "compressing" || phase === "uploading" || phase === "saving") && (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin flex items-center justify-center" />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-300">
                  {progressPercent}%
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white">
                  {phase === "compressing"
                    ? "Compressing Video Stream..."
                    : phase === "uploading"
                    ? "Uploading to Cloud Storage..."
                    : "Finalizing Class Recording..."}
                </h4>
                <p className="text-xs text-white/60 mt-1 max-w-sm leading-relaxed">
                  {statusMessage || "Please keep this tab open while processing completes."}
                </p>
              </div>

              {/* Progress track */}
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Phase 3: Done */}
          {phase === "done" && (
            <div className="flex flex-col gap-4 text-center items-center py-2">
              <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h4 className="font-bold text-base text-white">Uploaded to Cloud Successfully!</h4>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  The recording has been compressed and stored in your cloud storage bucket.
                </p>
              </div>

              {/* Compression stats comparison */}
              <div className="w-full grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-left">
                <div>
                  <span className="text-white/40 block text-[10px]">Original</span>
                  <span className="font-semibold text-white/80">{formatBytes(rawSize)}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">Compressed</span>
                  <span className="font-bold text-emerald-400">
                    {compressedSize > 0 ? formatBytes(compressedSize) : "Optimized"}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">Saved</span>
                  <span className="font-bold text-purple-300">
                    {savedPercent > 0 ? `${savedPercent}%` : "Compressed"}
                  </span>
                </div>
              </div>

              {/* Link and Actions */}
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={uploadedUrl}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 truncate outline-none select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(uploadedUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="w-full flex items-center gap-2 pt-2">
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Play size={14} /> Watch Preview
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Phase 4: Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="h-12 w-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <h4 className="font-bold text-sm text-white">Upload / Compression Failed</h4>
              <p className="text-xs text-rose-300 max-w-sm leading-relaxed">{errorMessage}</p>

              <div className="flex items-center gap-2 w-full pt-2">
                <button
                  onClick={handleDownloadLocal}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download size={14} /> Download Local File
                </button>
                <button
                  onClick={() => setPhase("ready")}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal if teacher wants to watch the uploaded recording */}
      {isPreviewOpen && uploadedUrl && (
        <VideoPlayerModal
          video={{
            url: uploadedUrl,
            title: classTitle || "Uploaded Live Class Recording",
          }}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  );
}
