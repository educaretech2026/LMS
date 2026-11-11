"use client";

import React, { useState, useEffect } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { compressVideo, prepareRecordingBlobForUpload } from "@/lib/video-compressor";
import { VideoPlayerModal } from "@/components/media/video-player-modal";

export { VideoPlayerModal };

interface RecordingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoBlob: Blob | null;
  classId?: string;
  classTitle?: string;
  durationSeconds?: number;
  onUploaded?: (url: string, isReleased?: boolean) => void;
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
  const [releaseImmediately, setReleaseImmediately] = useState<boolean>(false);

  // Close on Escape key when idle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "compressing" && phase !== "uploading" && phase !== "saving") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, onClose]);

  if (!isOpen || !videoBlob) return null;

  const rawSize = videoBlob.size;

  // Local immediate download
  const handleDownloadLocal = () => {
    try {
      const blobToDownload = compressedBlob || videoBlob;
      const isMp4 = (blobToDownload.type || "").toLowerCase().includes("mp4");
      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (classTitle || "live-class-recording").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `${safeTitle}_${dateStr}${isMp4 ? ".mp4" : ".webm"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      alert(`Local download failed: ${e?.message}`);
    }
  };

  // Direct fast upload to cloud storage
  const uploadBlobToCloud = async (blobToUpload: Blob, isCompressed: boolean = false) => {
    try {
      setErrorMessage("");
      setPhase("uploading");
      setProgressPercent(10);
      setStatusMessage("Preparing video format and duration metadata...");

      // Patch WebM EBML duration header in <200ms or preserve MP4 container
      const prep = await prepareRecordingBlobForUpload(blobToUpload, durationSeconds);
      const uploadBlob = prep.uploadBlob;
      const mimeType = prep.mimeType;
      const extension = prep.extension;

      setStatusMessage("Acquiring cloud storage upload credentials...");
      const safeTitle = (classTitle || "recording").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeFilename = `${safeTitle}_${Date.now()}${extension}`;

      const presignedRes = await fetchApi<any>(
        `/storage/presigned-url?filename=${encodeURIComponent(safeFilename)}&contentType=${encodeURIComponent(mimeType)}&prefix=recordings`
      );

      if (!presignedRes?.uploadUrl || !presignedRes?.finalUrl) {
        throw new Error("Could not acquire cloud storage presigned URL. Please verify R2/S3 storage configuration.");
      }

      setStatusMessage("Uploading recording to cloud storage...");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedRes.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", mimeType);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const uploadPercent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
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

        xhr.onerror = () => reject(new Error("Network error during cloud storage upload. Check internet connection."));
        xhr.onabort = () => reject(new Error("Upload was cancelled."));

        xhr.send(uploadBlob);
      });

      // Step 3: Associate with Class Record on backend
      setPhase("saving");
      setProgressPercent(100);
      setStatusMessage("Registering recording in class database...");

      if (classId) {
        await fetchApi(`/live-class/${classId}/recording/save`, {
          method: "POST",
          body: JSON.stringify({
            recordingUrl: presignedRes.finalUrl,
            fileSize: uploadBlob.size,
            duration: durationSeconds,
            isReleased: releaseImmediately,
          }),
        });
      }

      setUploadedUrl(presignedRes.finalUrl);
      if (isCompressed) {
        setCompressedBlob(uploadBlob);
        setCompressedSize(uploadBlob.size);
      }
      setPhase("done");
      onUploaded?.(presignedRes.finalUrl, releaseImmediately);
    } catch (err: any) {
      console.error("Recording upload failed:", err);
      setPhase("error");
      setErrorMessage(err?.message || "Something went wrong during video upload.");
    }
  };

  // Direct fast cloud upload handler
  const handleDirectUpload = () => {
    uploadBlobToCloud(videoBlob, false);
  };

  // Compress & Upload upon request
  const handleCompressAndUpload = async () => {
    try {
      setErrorMessage("");
      setPhase("compressing");
      setProgressPercent(5);
      setStatusMessage("Starting video compression engine...");

      let finalBlobToUpload = videoBlob;
      let isCompressed = false;

      try {
        const result = await compressVideo(videoBlob, {
          maxWidth: 1280,
          maxHeight: 720,
          targetFps: 24,
          videoBitrate: 1_200_000,
          knownDurationSeconds: durationSeconds,
          playbackRate: 1.0,
          onProgress: ({ percent, stage }) => {
            setProgressPercent(percent);
            setStatusMessage(stage);
          },
        });

        if (result?.compressedBlob && result.compressedBlob.size > 0) {
          finalBlobToUpload = result.compressedBlob;
          isCompressed = true;
          setCompressedBlob(result.compressedBlob);
          setCompressedSize(result.compressedSize);
        }
      } catch (compressionErr: any) {
        console.warn("Video compression encountered issue, falling back to direct upload:", compressionErr);
        setStatusMessage("Compression skipped, continuing with direct upload...");
      }

      await uploadBlobToCloud(finalBlobToUpload, isCompressed);
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && phase !== "compressing" && phase !== "uploading" && phase !== "saving") {
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-modal-title"
      >
        <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#161a29] to-[#0d101a] border border-white/12 shadow-2xl p-4 sm:p-7 text-white flex flex-col gap-4 sm:gap-5 max-h-[calc(100dvh-1.5rem)] overflow-y-auto scrollbar-thin">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/30">
                <Film size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="recording-modal-title" className="font-bold text-sm sm:text-base text-white tracking-tight">
                    Session Recording
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase tracking-wider">
                    Studio
                  </span>
                </div>
                <p className="text-xs text-white/60 truncate max-w-[280px] sm:max-w-xs mt-0.5">
                  {classTitle || "Live Class / Webinar Session"}
                </p>
              </div>
            </div>
            {phase !== "compressing" && phase !== "uploading" && phase !== "saving" && (
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Phase 1: Ready / Choices */}
          {phase === "ready" && (
            <div className="flex flex-col gap-4">
              {/* Stats card: 3 columns */}
              <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Duration</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{formatDuration(durationSeconds)}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Captured Size</span>
                  <span className="font-bold text-white text-sm mt-0.5 block">{formatBytes(rawSize)}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Target Format</span>
                  <span className="font-bold text-purple-300 text-sm mt-0.5 block">720p · 24fps</span>
                </div>
              </div>

              {/* Informative description banner */}
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Video compression normalizes playback to true <strong>1:1 speed</strong> and reduces bandwidth by up to <strong>75%</strong> before uploading to cloud storage.
                </p>
              </div>

              {/* Release to students toggle card */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs gap-3">
                <div className="flex flex-col pr-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Release to students upon upload</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        releaseImmediately ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
                      }`}
                    >
                      {releaseImmediately ? "Public Replay" : "Private Draft"}
                    </span>
                  </div>
                  <span className="text-[11px] text-white/50 mt-1 leading-normal">
                    {releaseImmediately
                      ? "Enrolled students & attendees can immediately stream this recording."
                      : "Saved in private draft. You can review it first and release it to students whenever ready."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReleaseImmediately(!releaseImmediately)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    releaseImmediately ? "bg-purple-600 shadow-md shadow-purple-600/30" : "bg-white/20"
                  }`}
                  aria-pressed={releaseImmediately}
                  title="Toggle student release status"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      releaseImmediately ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  onClick={handleDirectUpload}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all active:scale-95 cursor-pointer"
                  title="Direct high-speed upload with instant duration patching"
                >
                  <UploadCloud size={16} />
                  <span>Upload to Cloud (Fast & Recommended)</span>
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={handleDownloadLocal}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    title="Download a local backup to your device"
                  >
                    <Download size={14} />
                    <span>Download Local Backup</span>
                  </button>

                  <button
                    onClick={handleCompressAndUpload}
                    className="w-full sm:flex-1 py-2.5 px-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    title="Re-encode and compress video before uploading"
                  >
                    <Sparkles size={14} className="text-purple-400" />
                    <span>Re-encode & Compress</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: Processing (Compressing or Uploading) */}
          {(phase === "compressing" || phase === "uploading" || phase === "saving") && (
            <div className="flex flex-col items-center justify-center py-6 gap-5 text-center">
              <div className="relative">
                <div className="h-18 w-18 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin flex items-center justify-center" />
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

              {phase === "compressing" && (
                <button
                  type="button"
                  onClick={() => uploadBlobToCloud(videoBlob, false)}
                  className="text-xs text-purple-300 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
                >
                  Takes too long? Skip compression and upload directly
                </button>
              )}
            </div>
          )}

          {/* Phase 3: Done */}
          {phase === "done" && (
            <div className="flex flex-col gap-4 text-center items-center py-1">
              <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h4 className="font-bold text-base text-white">Uploaded to Cloud Successfully!</h4>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  The recording has been compressed and stored in your cloud storage bucket.
                </p>
              </div>

              {/* Release status notification */}
              <div
                className={`w-full p-3 rounded-2xl border text-xs flex items-center gap-2.5 text-left ${
                  releaseImmediately
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                }`}
              >
                <ShieldCheck size={16} className="shrink-0" />
                <span className="leading-snug">
                  {releaseImmediately
                    ? "Released to students! Enrolled learners and attendees can now stream this recording."
                    : "Saved as Private Draft. You can review it now and release it to students whenever ready from the Live Class Hub."}
                </span>
              </div>

              {/* Compression stats comparison */}
              <div className="w-full grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-left">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Original</span>
                  <span className="font-semibold text-white/80 mt-0.5 block">{formatBytes(rawSize)}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Compressed</span>
                  <span className="font-bold text-emerald-400 mt-0.5 block">
                    {compressedSize > 0 ? formatBytes(compressedSize) : "Optimized"}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Saved</span>
                  <span className="font-bold text-purple-300 mt-0.5 block">
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
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 truncate outline-none select-all font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(uploadedUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="w-full flex items-center gap-2 pt-1">
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Play size={14} className="fill-white" /> Watch Preview
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Phase 4: Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-3.5 py-4 text-center">
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
