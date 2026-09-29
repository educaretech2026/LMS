"use client";

import { useState, useRef } from "react";
import { UploadCloud, File, Film, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface FileUploaderProps {
  type: "VIDEO" | "FILE";
  onUploadSuccess: (url: string, videoId?: string) => void;
  onUploadError: (error: string) => void;
  onCancel: () => void;
}

export function FileUploader({ type, onUploadSuccess, onUploadError, onCancel }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);

    try {
      // 1. Get pre-signed URL from our API
      const { uploadUrl, finalUrl, videoId } = await fetchApi<any>(
        `/study-materials/upload-url?type=${type}&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );

      setProgress(40);

      // 2. Upload file directly to Cloudflare R2 / S3 via PUT (both for VIDEO and FILE)
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(40 + (e.loaded / e.total) * 60);
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error("Failed to upload file"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      onUploadSuccess(finalUrl, videoId);
    } catch (error: any) {
      console.error(error);
      onUploadError(error.message || "An error occurred during upload");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragActive ? "border-brand-blue bg-brand-blue/5" : "border-border-soft hover:bg-surface-2"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={type === "VIDEO" ? "video/mp4,video/quicktime,video/x-m4v" : ".pdf,.doc,.docx,.ppt,.pptx,image/*"}
            onChange={handleChange}
          />
          <div className="mx-auto h-12 w-12 rounded-full bg-surface-3 flex items-center justify-center mb-3">
            {type === "VIDEO" ? (
              <Film className="h-6 w-6 text-text-secondary" />
            ) : (
              <UploadCloud className="h-6 w-6 text-text-secondary" />
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary">
            Click or drag to upload {type === "VIDEO" ? "video" : "file"}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {type === "VIDEO" ? "MP4, MOV up to 1GB" : "PDF, DOC, PPT up to 50MB"}
          </p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border-soft rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-white border border-border-soft flex items-center justify-center">
                {type === "VIDEO" ? <Film className="h-5 w-5 text-brand-red" /> : <File className="h-5 w-5 text-brand-blue" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{file.name}</p>
                <p className="text-[11px] text-text-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)} className="text-text-muted hover:text-brand-red p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {uploading ? (
            <div className="space-y-2">
              <div className="h-2 w-full bg-border-soft rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-blue transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-text-muted">
                <span>Uploading...</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mt-4">
              <button
                onClick={onCancel}
                className="flex-1 py-2 text-xs font-semibold text-text-secondary hover:bg-white rounded-lg transition-colors border border-border-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 py-2 text-xs font-semibold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-lg transition-colors shadow-sm"
              >
                Upload Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
