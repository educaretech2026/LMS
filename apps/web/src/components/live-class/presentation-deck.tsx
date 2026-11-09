"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import JSZip from "jszip";
import { fetchApi } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Upload,
  PenTool,
  Highlighter,
  Eraser,
  Type,
  Square,
  ArrowRight,
  Sparkles,
  Download,
  RotateCcw,
  RotateCw,
  Trash2,
  Check,
  X,
  FileText,
  Users,
  Eye,
  Sliders,
  ZoomIn,
  ZoomOut,
  Layers,
  MousePointer,
} from "lucide-react";

export interface SlideItem {
  id: string;
  url: string;
  pageNumber: number;
  title?: string;
  width?: number;
  height?: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingStroke {
  id: string;
  slideIndex: number;
  authorId: string;
  authorName: string;
  authorRole: "Teacher" | "Student";
  tool: "pen" | "highlighter" | "arrow" | "rect" | "text";
  color: string;
  size: number;
  points: DrawingPoint[];
  text?: string;
  createdAt: number;
}

interface PresentationDeckProps {
  isTeacher: boolean;
  classId?: string;
  room?: any;
  myIdentity: string;
  myName: string;
  initialFiles?: { name: string; url: string }[];
  allowStudentDraw: boolean;
  onToggleStudentDraw?: (allowed: boolean) => void;
  onClose?: () => void;
  onForceReload?: () => void;
}

const PRESET_COLORS = [
  "#ee1b24", // Educare Red
  "#0162b1", // Educare Blue
  "#22c55e", // Green
  "#eab308", // Yellow
  "#a855f7", // Purple
  "#ffffff", // White
  "#000000", // Black
];

const STROKE_SIZES = [2, 4, 8, 14];

// Security Helper: Anti-SSRF URL verification (rejects loopback, link-local metadata, LAN IPs)
const isSafeUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("data:")) return true;
  if (url.startsWith("/")) return true; // same-origin relative
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "169.254.169.254" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export function PresentationDeck({
  isTeacher,
  classId,
  room,
  myIdentity,
  myName,
  initialFiles = [],
  allowStudentDraw,
  onToggleStudentDraw,
  onClose,
  onForceReload,
}: PresentationDeckProps) {
  // Slides State
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
  const [isResyncing, setIsResyncing] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Drawing Tools State
  const [currentTool, setCurrentTool] = useState<
    "pen" | "highlighter" | "laser" | "arrow" | "rect" | "text" | "eraser" | "select"
  >("pen");
  const [penColor, setPenColor] = useState<string>("#ee1b24");
  const [penSize, setPenSize] = useState<number>(4);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Per-slide drawing strokes memory
  const [strokesBySlide, setStrokesBySlide] = useState<Record<number, DrawingStroke[]>>({});
  const [currentDrawingStroke, setCurrentDrawingStroke] = useState<DrawingStroke | null>(null);

  // Laser Pointer State
  const [laserPosition, setLaserPosition] = useState<{ x: number; y: number; name: string } | null>(null);
  const laserTimerRef = useRef<any>(null);

  // Canvas Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef<boolean>(false);

  // Permission synchronization ref (prevents closure staleness)
  const [studentDrawAllowed, setStudentDrawAllowed] = useState<boolean>(allowStudentDraw);
  const allowStudentDrawRef = useRef<boolean>(allowStudentDraw);
  useEffect(() => {
    setStudentDrawAllowed(allowStudentDraw);
    allowStudentDrawRef.current = allowStudentDraw;
  }, [allowStudentDraw]);

  // Permission check
  const canDraw = isTeacher || studentDrawAllowed;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PDF.js Dynamic Loader (Loads client-side with Blob Worker to bypass CORS)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadPdfJs = useCallback(async (): Promise<any> => {
    if (typeof window === "undefined") return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    return new Promise((resolve, reject) => {
      const existing = document.getElementById("pdfjs-engine-script") || document.getElementById("pdfjs-cdn-script");
      if (existing) {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if ((window as any).pdfjsLib) {
            clearInterval(interval);
            resolve((window as any).pdfjsLib);
          } else if (attempts > 50) {
            clearInterval(interval);
            reject(new Error("Timeout loading PDF.js"));
          }
        }, 100);
        return;
      }

      // Step 1: Attempt to load from same-origin vendor bundle (fast, offline-ready, 0 CSP friction)
      const script = document.createElement("script");
      script.id = "pdfjs-engine-script";
      script.src = "/vendor/pdfjs/pdf.min.js";

      const setupWorkerAndResolve = (lib: any) => {
        try {
          lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js";
        } catch {
          try {
            const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const blob = new Blob([`importScripts("${workerUrl}");`], {
              type: "application/javascript",
            });
            lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          } catch {
            lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
        }
        resolve(lib);
      };

      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          setupWorkerAndResolve(lib);
        } else {
          loadFromCdnFallback();
        }
      };

      const loadFromCdnFallback = () => {
        const cdnScript = document.createElement("script");
        cdnScript.id = "pdfjs-cdn-script";
        cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        cdnScript.onload = () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            try {
              const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              const blob = new Blob([`importScripts("${workerUrl}");`], {
                type: "application/javascript",
              });
              lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
            } catch {
              lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            }
            resolve(lib);
          } else {
            reject(new Error("PDF.js library unavailable after CDN load"));
          }
        };
        cdnScript.onerror = () => reject(new Error("Failed to load PDF.js engine from both local vendor bundle and CDN"));
        document.head.appendChild(cdnScript);
      };

      script.onerror = () => {
        loadFromCdnFallback();
      };

      document.head.appendChild(script);
    });
  }, []);

  // Presentation Source Tracking for Lightweight WebRTC Sync (< 300 bytes per message)
  const activePresentationRef = useRef<{
    fileUrl: string;
    fileName: string;
    fileType: "pdf" | "pptx" | "image";
  } | null>(null);

  const broadcastPresentationSource = useCallback(
    (fileUrl: string, fileName: string, fileType: "pdf" | "pptx" | "image", slideIdx: number = 0) => {
      activePresentationRef.current = { fileUrl, fileName, fileType };
      if (room?.localParticipant) {
        const payload = JSON.stringify({
          type: "PRESENTATION_SOURCE",
          fileUrl,
          fileName,
          fileType,
          currentSlideIndex: slideIdx,
        });
        const bytes = new TextEncoder().encode(payload);
        room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
      }
    },
    [room]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Render PowerPoint (.pptx) Presentations with JSZip
  // ─────────────────────────────────────────────────────────────────────────────
  const processPptxFile = useCallback(
    async (fileOrUrl: File | string, fileName?: string) => {
      setIsLoadingPdf(true);
      setPdfProgress("Unpacking PowerPoint presentation (.pptx)...");
      try {
        let zipBuffer: ArrayBuffer;
        if (typeof fileOrUrl === "string") {
          if (!isSafeUrl(fileOrUrl)) {
            throw new Error("Target presentation URL failed security policy verification.");
          }
          const res = await fetch(fileOrUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zipBuffer = await res.arrayBuffer();
        } else {
          zipBuffer = await fileOrUrl.arrayBuffer();
        }

        const zip = await JSZip.loadAsync(zipBuffer);

        // Security check: Zip Bomb / Decompression Bomb protection (60MB uncompressed limit)
        let totalUncompressedSize = 0;
        const MAX_UNCOMPRESSED_LIMIT = 60 * 1024 * 1024;
        zip.forEach((_, entry) => {
          const uncompressed = (entry as any)._data?.uncompressedSize || 0;
          totalUncompressedSize += uncompressed;
        });

        if (totalUncompressedSize > MAX_UNCOMPRESSED_LIMIT) {
          throw new Error("PowerPoint document exceeds uncompressed security limit (60MB).");
        }

        // Find all slide XML files
        const slideFiles: { name: string; num: number }[] = [];
        zip.forEach((relativePath) => {
          const match = relativePath.match(/^ppt\/slides\/slide([0-9]+)\.xml$/i);
          if (match && match[1]) {
            slideFiles.push({ name: relativePath, num: parseInt(match[1], 10) });
          }
        });

        slideFiles.sort((a, b) => a.num - b.num);

        if (slideFiles.length === 0) {
          throw new Error("No slide XML files found in this PowerPoint document.");
        }

        if (slideFiles.length > 100) {
          throw new Error("Presentation contains more than 100 slides, exceeding memory safety limits.");
        }

        const generatedSlides: SlideItem[] = [];
        const parser = new DOMParser();

        for (let i = 0; i < slideFiles.length; i++) {
          const slideEntry = slideFiles[i];
          setPdfProgress(`Rendering slide ${i + 1} of ${slideFiles.length}...`);

          const xmlText = await zip.file(slideEntry.name)?.async("text");
          if (!xmlText) continue;

          const doc = parser.parseFromString(xmlText, "application/xml");

          // Extract paragraphs and text
          const paragraphs = Array.from(doc.getElementsByTagName("a:p"));
          let titleText = "";
          const bulletLines: string[] = [];

          for (const p of paragraphs) {
            const textNodes = Array.from(p.getElementsByTagName("a:t"));
            const line = textNodes.map((t) => t.textContent || "").join("").trim();
            if (!line) continue;

            if (!titleText) {
              titleText = line;
            } else {
              bulletLines.push(line);
            }
          }

          // Check for embedded media in slide rels
          const relsPath = `ppt/slides/_rels/slide${slideEntry.num}.xml.rels`;
          let slideImageUrl = "";
          const relsFile = zip.file(relsPath);
          if (relsFile) {
            try {
              const relsXml = await relsFile.async("text");
              const relsDoc = parser.parseFromString(relsXml, "application/xml");
              const rels = Array.from(relsDoc.getElementsByTagName("Relationship"));
              for (const rel of rels) {
                const target = rel.getAttribute("Target") || "";
                if (target.includes("media/")) {
                  const mediaFileName = target.split("/").pop();
                  if (mediaFileName) {
                    const mediaEntry = zip.file(`ppt/media/${mediaFileName}`);
                    if (mediaEntry) {
                      const base64Img = await mediaEntry.async("base64");
                      const ext = mediaFileName.split(".").pop()?.toLowerCase() || "png";
                      slideImageUrl = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${base64Img}`;
                      break;
                    }
                  }
                }
              }
            } catch { }
          }

          // Render slide onto high-res 16:9 canvas (1920x1080)
          const offCanvas = document.createElement("canvas");
          offCanvas.width = 1920;
          offCanvas.height = 1080;
          const ctx = offCanvas.getContext("2d");
          if (!ctx) continue;

          // Background gradient
          const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
          gradient.addColorStop(0, "#0b0f19");
          gradient.addColorStop(0.5, "#111827");
          gradient.addColorStop(1, "#0f172a");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 1920, 1080);

          // Top accent line
          const topAccent = ctx.createLinearGradient(0, 0, 1920, 0);
          topAccent.addColorStop(0, "#3b82f6");
          topAccent.addColorStop(0.5, "#6366f1");
          topAccent.addColorStop(1, "#ec4899");
          ctx.fillStyle = topAccent;
          ctx.fillRect(0, 0, 1920, 6);

          // Slide Title
          const displayTitle = titleText || `${fileName || "Slide"} ${i + 1}`;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 56px Inter, system-ui, sans-serif";
          ctx.fillText(displayTitle.slice(0, 75), 100, 140);

          // Divider below title
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(100, 180);
          ctx.lineTo(1820, 180);
          ctx.stroke();

          // If image exists, draw it
          if (slideImageUrl) {
            try {
              const img = new Image();
              await new Promise<void>((res) => {
                img.onload = () => res();
                img.onerror = () => res();
                img.src = slideImageUrl;
              });

              if (img.width > 0) {
                if (bulletLines.length > 0) {
                  const maxW = 800;
                  const maxH = 750;
                  const ratio = Math.min(maxW / img.width, maxH / img.height);
                  const iw = img.width * ratio;
                  const ih = img.height * ratio;
                  const ix = 1050 + (maxW - iw) / 2;
                  const iy = 230 + (maxH - ih) / 2;

                  ctx.drawImage(img, ix, iy, iw, ih);

                  // Draw bullets on left
                  ctx.fillStyle = "#e2e8f0";
                  ctx.font = "32px Inter, system-ui, sans-serif";
                  let y = 260;
                  for (const b of bulletLines.slice(0, 10)) {
                    ctx.fillStyle = "#38bdf8";
                    ctx.fillText("•", 100, y);
                    ctx.fillStyle = "#e2e8f0";
                    ctx.fillText(b.slice(0, 65), 140, y);
                    y += 65;
                  }
                } else {
                  const maxW = 1600;
                  const maxH = 780;
                  const ratio = Math.min(maxW / img.width, maxH / img.height);
                  const iw = img.width * ratio;
                  const ih = img.height * ratio;
                  const ix = (1920 - iw) / 2;
                  const iy = 210 + (maxH - ih) / 2;
                  ctx.drawImage(img, ix, iy, iw, ih);
                }
              }
            } catch { }
          } else {
            // Full width bullet points
            ctx.fillStyle = "#e2e8f0";
            ctx.font = "36px Inter, system-ui, sans-serif";
            let y = 280;
            for (const b of bulletLines.slice(0, 11)) {
              ctx.fillStyle = "#38bdf8";
              ctx.fillText("•", 100, y);
              ctx.fillStyle = "#f1f5f9";
              ctx.fillText(b.slice(0, 95), 150, y);
              y += 72;
            }
          }

          // Footer branding & Slide number
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.font = "24px Inter, system-ui, sans-serif";
          ctx.fillText("Educare LMS Presentation", 100, 1030);
          ctx.fillText(`Slide ${i + 1} of ${slideFiles.length}`, 1680, 1030);

          const dataUrl = offCanvas.toDataURL("image/jpeg", 0.88);
          generatedSlides.push({
            id: `pptx-${slideEntry.num}-${Date.now()}`,
            url: dataUrl,
            pageNumber: i + 1,
            title: displayTitle,
            width: 1920,
            height: 1080,
          });
        }

        setSlides(generatedSlides);
        setCurrentSlideIndex(0);
      } catch (err: any) {
        console.error("PPTX presentation processing error:", err);
        alert(`Failed to load PowerPoint (.pptx): ${err?.message || "Invalid or inaccessible file"}`);
      } finally {
        setIsLoadingPdf(false);
        setPdfProgress("");
      }
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Render PDF Pages into High-DPI Slide Images
  // ─────────────────────────────────────────────────────────────────────────────
  const processPdfFile = useCallback(
    async (fileOrUrl: File | string, fileName?: string) => {
      setIsLoadingPdf(true);
      setPdfProgress("Initializing slide renderer...");
      try {
        const pdfjs = await loadPdfJs();
        let pdfData: any;

        if (typeof fileOrUrl === "string") {
          if (!isSafeUrl(fileOrUrl)) {
            throw new Error("Target presentation URL failed security policy verification.");
          }
          try {
            const res = await fetch(fileOrUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            pdfData = { data: new Uint8Array(buf) };
          } catch {
            pdfData = { url: fileOrUrl };
          }
        } else {
          const buffer = await fileOrUrl.arrayBuffer();
          pdfData = { data: new Uint8Array(buffer) };
        }

        setPdfProgress("Loading presentation pages...");
        const loadingTask = pdfjs.getDocument(pdfData);
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        if (totalPages === 0) {
          throw new Error("This PDF document contains 0 pages.");
        }

        if (totalPages > 120) {
          throw new Error("PDF document exceeds maximum slide safety limit of 120 pages.");
        }

        const generatedSlides: SlideItem[] = [];

        for (let i = 1; i <= totalPages; i++) {
          setPdfProgress(`Rendering slide ${i} of ${totalPages}...`);
          try {
            const pagePromise = pdf.getPage(i);
            const page = await Promise.race([
              pagePromise,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout fetching slide ${i}`)), 12000)
              ),
            ]);

            // Render at crisp 1.75x scale for sharp text while managing memory
            const viewport = page.getViewport({ scale: 1.75 });
            const offCanvas = document.createElement("canvas");
            offCanvas.width = viewport.width;
            offCanvas.height = viewport.height;
            const ctx = offCanvas.getContext("2d");
            if (!ctx) continue;

            const renderTask = page.render({
              canvasContext: ctx,
              viewport,
            });

            await Promise.race([
              renderTask.promise,
              new Promise((_, reject) =>
                setTimeout(() => {
                  try {
                    renderTask.cancel?.();
                  } catch {}
                  reject(new Error(`Timeout rendering slide ${i}`));
                }, 12000)
              ),
            ]);

            const dataUrl = offCanvas.toDataURL("image/jpeg", 0.85);
            // Immediately release offscreen canvas buffer to avoid memory leaks
            offCanvas.width = 1;
            offCanvas.height = 1;

            generatedSlides.push({
              id: `slide-${i}-${Date.now()}`,
              url: dataUrl,
              pageNumber: i,
              title: `${fileName || "Slide"} ${i}`,
              width: viewport.width,
              height: viewport.height,
            });
          } catch (pageErr) {
            console.warn(`[PDF Rendering] Slide ${i} fallback generated:`, pageErr);
            const offCanvas = document.createElement("canvas");
            offCanvas.width = 1600;
            offCanvas.height = 900;
            const ctx = offCanvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#0f172a";
              ctx.fillRect(0, 0, 1600, 900);
              ctx.fillStyle = "#f87171";
              ctx.font = "bold 34px sans-serif";
              ctx.fillText(`Slide ${i}`, 100, 180);
              ctx.fillStyle = "#94a3b8";
              ctx.font = "22px sans-serif";
              ctx.fillText("Notice: Slide format or complex graphics could not be fully rendered.", 100, 240);
              const dataUrl = offCanvas.toDataURL("image/jpeg", 0.8);
              offCanvas.width = 1;
              offCanvas.height = 1;
              generatedSlides.push({
                id: `slide-${i}-fallback-${Date.now()}`,
                url: dataUrl,
                pageNumber: i,
                title: `${fileName || "Slide"} ${i} (Degraded)`,
                width: 1600,
                height: 900,
              });
            }
          }
        }

        if (generatedSlides.length > 0) {
          setSlides(generatedSlides);
          setCurrentSlideIndex(0);
        } else {
          throw new Error("No slides could be parsed from this presentation file.");
        }
      } catch (err: any) {
        console.error("PDF presentation processing error:", err);
        alert(`Failed to load presentation PDF: ${err?.message || "Invalid or inaccessible file"}`);
      } finally {
        setIsLoadingPdf(false);
        setPdfProgress("");
      }
    },
    [loadPdfJs]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Auto-load pre-attached slides if provided
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (slides.length > 0) return;
    const pptxAttachment = initialFiles.find((f) =>
      /\.(pptx|ppt)$/i.test(f.url) || /\.(pptx|ppt)$/i.test(f.name)
    );
    if (pptxAttachment) {
      processPptxFile(pptxAttachment.url, pptxAttachment.name);
      if (isTeacher) {
        broadcastPresentationSource(pptxAttachment.url, pptxAttachment.name, "pptx", 0);
      }
      return;
    }

    const pdfAttachment = initialFiles.find((f) =>
      /\.pdf$/i.test(f.url) || /\.pdf$/i.test(f.name)
    );
    if (pdfAttachment) {
      processPdfFile(pdfAttachment.url, pdfAttachment.name);
      if (isTeacher) {
        broadcastPresentationSource(pdfAttachment.url, pdfAttachment.name, "pdf", 0);
      }
      return;
    }

    const imageAttachments = initialFiles.filter((f) =>
      /\.(png|jpe?g|webp|svg)$/i.test(f.url) || /\.(png|jpe?g|webp|svg)$/i.test(f.name)
    );
    if (imageAttachments.length > 0) {
      setSlides(
        imageAttachments.map((f, i) => ({
          id: `init-img-${i}`,
          url: f.url,
          pageNumber: i + 1,
          title: f.name,
        }))
      );
      if (isTeacher) {
        broadcastPresentationSource(imageAttachments[0].url, imageAttachments[0].name, "image", 0);
      }
    }
  }, [initialFiles, slides.length, processPdfFile, processPptxFile, broadcastPresentationSource, isTeacher]);

  // Request active presentation from teacher when student joins or opens slides
  useEffect(() => {
    if (!isTeacher && slides.length === 0 && room?.localParticipant) {
      const payload = JSON.stringify({ type: "REQUEST_PRESENTATION_STATE" });
      room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }).catch(() => { });
    }
  }, [isTeacher, slides.length, room]);

  // Teacher periodic heartbeat sync for late-joining students
  useEffect(() => {
    if (!isTeacher || !room?.localParticipant) return;
    const interval = setInterval(() => {
      if (activePresentationRef.current) {
        broadcastPresentationSource(
          activePresentationRef.current.fileUrl,
          activePresentationRef.current.fileName,
          activePresentationRef.current.fileType,
          currentSlideIndex
        );
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isTeacher, room, currentSlideIndex, broadcastPresentationSource]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. LiveKit Synchronization Receiver (Slide navigation & Real-time strokes)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const handleIncomingData = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // Security: WebRTC Sender Role Attestation
        let isSenderHost = false;
        if (participant) {
          if (participant.permissions?.roomAdmin === true) {
            isSenderHost = true;
          } else if (participant.metadata) {
            try {
              const meta = typeof participant.metadata === "string" ? JSON.parse(participant.metadata) : participant.metadata;
              if (meta.isHost === true || meta.role === "TEACHER" || meta.role === "SUPER_ADMIN" || meta.role === "CENTRE_ADMIN") {
                isSenderHost = true;
              }
            } catch { }
          }
        }

        if (data.type === "PRESENTATION_SOURCE" && data.fileUrl) {
          // Reject presentation switch from non-host participants
          if (!isSenderHost) {
            console.warn("[Security] Unauthorized PRESENTATION_SOURCE rejected from", participant?.identity);
            return;
          }
          const { fileUrl, fileName, fileType, currentSlideIndex: targetIdx } = data;
          const isSameFile = activePresentationRef.current?.fileUrl === fileUrl && slides.length > 0;
          activePresentationRef.current = { fileUrl, fileName, fileType };
          if (!isSameFile) {
            if (fileType === "pptx") {
              processPptxFile(fileUrl, fileName)
                .then(() => {
                  if (typeof targetIdx === "number") setCurrentSlideIndex(targetIdx);
                })
                .catch((err) => console.warn("Sync PPTX error:", err));
            } else if (fileType === "pdf") {
              processPdfFile(fileUrl, fileName)
                .then(() => {
                  if (typeof targetIdx === "number") setCurrentSlideIndex(targetIdx);
                })
                .catch((err) => console.warn("Sync PDF error:", err));
            } else if (fileType === "image") {
              setSlides([
                {
                  id: `img-slide-${Date.now()}`,
                  url: fileUrl,
                  pageNumber: 1,
                  title: fileName || "Slide",
                },
              ]);
              if (typeof targetIdx === "number") setCurrentSlideIndex(targetIdx);
            }
          } else {
            // Already loaded: just sync slide index without re-unpacking/re-rendering pages
            if (typeof targetIdx === "number" && targetIdx !== currentSlideIndex) {
              setCurrentSlideIndex(targetIdx);
            }
          }
        } else if (data.type === "REQUEST_PRESENTATION_STATE") {
          if (isTeacher && activePresentationRef.current) {
            broadcastPresentationSource(
              activePresentationRef.current.fileUrl,
              activePresentationRef.current.fileName,
              activePresentationRef.current.fileType,
              currentSlideIndex
            );
            if (room?.localParticipant) {
              const payload = JSON.stringify({
                type: "SLIDE_PERMISSIONS_UPDATE",
                allowStudentDraw: allowStudentDrawRef.current,
              });
              const bytes = new TextEncoder().encode(payload);
              room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
            }
          }
        } else if (data.type === "SLIDE_DECK_LOADED" && Array.isArray(data.slides)) {
          if (!isSenderHost) return;
          setSlides(data.slides);
          setCurrentSlideIndex(0);
        } else if (data.type === "SLIDE_INDEX_CHANGE") {
          if (!isSenderHost) return;
          setCurrentSlideIndex(data.index);
        } else if (data.type === "SLIDE_STROKE_ADDED" && data.stroke) {
          if (!isTeacher && !isSenderHost && !allowStudentDrawRef.current) return;
          const s = data.stroke as DrawingStroke;
          if (!s || !Array.isArray(s.points) || s.points.length === 0) return;
          const validPoints = s.points.filter(
            (pt) => pt && typeof pt.x === "number" && typeof pt.y === "number" && isFinite(pt.x) && isFinite(pt.y)
          );
          if (validPoints.length === 0) return;
          const sanitizedStroke: DrawingStroke = {
            ...s,
            points: validPoints,
          };
          setStrokesBySlide((prev) => {
            const list = prev[sanitizedStroke.slideIndex] || [];
            if (list.some((existing) => existing.id === sanitizedStroke.id)) return prev;
            return {
              ...prev,
              [sanitizedStroke.slideIndex]: [...list, sanitizedStroke],
            };
          });
          requestAnimationFrame(() => redrawCanvas());
        } else if (data.type === "SLIDE_STROKES_CLEARED") {
          if (!isSenderHost && !isTeacher) return;
          setStrokesBySlide((prev) => ({
            ...prev,
            [data.slideIndex]: [],
          }));
          requestAnimationFrame(() => redrawCanvas());
        } else if (data.type === "SLIDE_LASER_POINTER") {
          if (!isSenderHost && !allowStudentDrawRef.current && !isTeacher) return;
          setLaserPosition({ x: data.x, y: data.y, name: data.name || "Speaker" });
          if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
          laserTimerRef.current = setTimeout(() => setLaserPosition(null), 1400);
        } else if (data.type === "SLIDE_PERMISSIONS_UPDATE") {
          if (!isSenderHost) return;
          const nextAllow = Boolean(data.allowStudentDraw);
          setStudentDrawAllowed(nextAllow);
          allowStudentDrawRef.current = nextAllow;
          if (onToggleStudentDraw) {
            onToggleStudentDraw(nextAllow);
          }
        }
      } catch { }
    };

    room.on("dataReceived", handleIncomingData);
    return () => {
      room.off("dataReceived", handleIncomingData);
      if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
    };
  }, [room, onToggleStudentDraw, isTeacher, currentSlideIndex, broadcastPresentationSource, processPdfFile, processPptxFile]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Canvas Drawing Rendering Loop (Hardened with NaN Guards)
  // ─────────────────────────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Match physical pixels with styling
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const slideStrokes = strokesBySlide[currentSlideIndex] || [];
      const allStrokes = currentDrawingStroke ? [...slideStrokes, currentDrawingStroke] : slideStrokes;

      for (const stroke of allStrokes) {
        if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) continue;

        ctx.save();
        try {
          ctx.beginPath();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          if (stroke.tool === "highlighter") {
            ctx.globalAlpha = 0.38;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size * 2.5;
          } else {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
          }

          if (stroke.tool === "arrow" && stroke.points.length >= 2) {
            const p1 = stroke.points[0];
            const p2 = stroke.points[stroke.points.length - 1];
            if (p1 && p2 && isFinite(p1.x) && isFinite(p1.y) && isFinite(p2.x) && isFinite(p2.y)) {
              const x1 = p1.x * canvas.width;
              const y1 = p1.y * canvas.height;
              const x2 = p2.x * canvas.width;
              const y2 = p2.y * canvas.height;

              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();

              // Arrow head
              const angle = Math.atan2(y2 - y1, x2 - x1);
              const headlen = 16;
              ctx.beginPath();
              ctx.moveTo(x2, y2);
              ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
              ctx.moveTo(x2, y2);
              ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
              ctx.stroke();
            }
          } else if (stroke.tool === "rect" && stroke.points.length >= 2) {
            const p1 = stroke.points[0];
            const p2 = stroke.points[stroke.points.length - 1];
            if (p1 && p2 && isFinite(p1.x) && isFinite(p1.y) && isFinite(p2.x) && isFinite(p2.y)) {
              const x = Math.min(p1.x, p2.x) * canvas.width;
              const y = Math.min(p1.y, p2.y) * canvas.height;
              const w = Math.abs(p2.x - p1.x) * canvas.width;
              const h = Math.abs(p2.y - p1.y) * canvas.height;
              ctx.strokeRect(x, y, w, h);
            }
          } else {
            // Freeform pen or highlighter
            const first = stroke.points[0];
            if (first && isFinite(first.x) && isFinite(first.y)) {
              ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

              for (let i = 1; i < stroke.points.length; i++) {
                const pt = stroke.points[i];
                if (pt && isFinite(pt.x) && isFinite(pt.y)) {
                  ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
                }
              }
              ctx.stroke();
            }
          }
        } finally {
          ctx.restore();
        }
      }
    } catch (canvasErr) {
      console.warn("[PresentationCanvas] Render loop error suppressed:", canvasErr);
    }
  }, [strokesBySlide, currentSlideIndex, currentDrawingStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Window resize handler to maintain canvas coordinate fidelity
  useEffect(() => {
    const handleResize = () => redrawCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redrawCanvas]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Touch & Pointer Drawing Gestures
  // ─────────────────────────────────────────────────────────────────────────────
  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): DrawingPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      pressure: e.pressure || 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || currentTool === "select") return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    isPointerDownRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (currentTool === "laser") {
      broadcastLaser(pt.x, pt.y);
      return;
    }

    if (currentTool === "eraser") {
      eraseNearPoint(pt.x, pt.y);
      return;
    }

    const newStroke: DrawingStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slideIndex: currentSlideIndex,
      authorId: myIdentity,
      authorName: myName,
      authorRole: isTeacher ? "Teacher" : "Student",
      tool: currentTool as any,
      color: penColor,
      size: penSize,
      points: [pt],
      createdAt: Date.now(),
    };

    setCurrentDrawingStroke(newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current && currentTool !== "laser") return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    if (currentTool === "laser") {
      broadcastLaser(pt.x, pt.y);
      return;
    }

    if (currentTool === "eraser") {
      if (isPointerDownRef.current) eraseNearPoint(pt.x, pt.y);
      return;
    }

    if (currentDrawingStroke) {
      setCurrentDrawingStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, pt],
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { }

    if (currentDrawingStroke && currentDrawingStroke.points.length > 0) {
      const finalized = currentDrawingStroke;
      setCurrentDrawingStroke(null);

      // Save locally
      setStrokesBySlide((prev) => {
        const list = prev[finalized.slideIndex] || [];
        return {
          ...prev,
          [finalized.slideIndex]: [...list, finalized],
        };
      });

      // Broadcast to all participants via LiveKit
      if (room?.localParticipant) {
        const payload = JSON.stringify({
          type: "SLIDE_STROKE_ADDED",
          stroke: finalized,
        });
        const bytes = new TextEncoder().encode(payload);
        room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
      }
    }
  };

  const broadcastLaser = (x: number, y: number) => {
    setLaserPosition({ x, y, name: myName });
    if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
    laserTimerRef.current = setTimeout(() => setLaserPosition(null), 1400);

    if (room?.localParticipant) {
      const payload = JSON.stringify({
        type: "SLIDE_LASER_POINTER",
        x,
        y,
        name: myName,
      });
      const bytes = new TextEncoder().encode(payload);
      room.localParticipant.publishData(bytes, { reliable: false }).catch(() => { });
    }
  };

  const eraseNearPoint = (x: number, y: number) => {
    setStrokesBySlide((prev) => {
      const list = prev[currentSlideIndex] || [];
      const threshold = 0.04; // 4% coordinate proximity
      const filtered = list.filter((s) => {
        return !s.points.some((p) => Math.hypot(p.x - x, p.y - y) < threshold);
      });
      return {
        ...prev,
        [currentSlideIndex]: filtered,
      };
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Slide Navigation Handlers (Teacher Broadcasted)
  // ─────────────────────────────────────────────────────────────────────────────
  const goToSlide = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    setCurrentSlideIndex(index);

    if (isTeacher && room?.localParticipant) {
      const payload = JSON.stringify({
        type: "SLIDE_INDEX_CHANGE",
        index,
      });
      const bytes = new TextEncoder().encode(payload);
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
    }
  };

  const clearCurrentSlideAnnotations = () => {
    setStrokesBySlide((prev) => ({
      ...prev,
      [currentSlideIndex]: [],
    }));

    if (room?.localParticipant) {
      const payload = JSON.stringify({
        type: "SLIDE_STROKES_CLEARED",
        slideIndex: currentSlideIndex,
      });
      const bytes = new TextEncoder().encode(payload);
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
    }
  };

  const toggleStudentPermission = () => {
    if (!isTeacher) return;
    const nextState = !studentDrawAllowed;
    setStudentDrawAllowed(nextState);
    allowStudentDrawRef.current = nextState;
    if (onToggleStudentDraw) {
      onToggleStudentDraw(nextState);
    }
    if (room?.localParticipant) {
      const payload = JSON.stringify({
        type: "SLIDE_PERMISSIONS_UPDATE",
        allowStudentDraw: nextState,
      });
      const bytes = new TextEncoder().encode(payload);
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => { });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. In-Class Instant Resync / Recovery Action
  // ─────────────────────────────────────────────────────────────────────────────
  const handleResyncDeck = useCallback(() => {
    setIsResyncing(true);
    try {
      if (isTeacher) {
        if (activePresentationRef.current) {
          broadcastPresentationSource(
            activePresentationRef.current.fileUrl,
            activePresentationRef.current.fileName,
            activePresentationRef.current.fileType,
            currentSlideIndex
          );
        }
      } else {
        if (room?.localParticipant) {
          const payload = JSON.stringify({ type: "REQUEST_PRESENTATION_STATE" });
          room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }).catch(() => {});
        }
      }
      requestAnimationFrame(() => redrawCanvas());
      if (onForceReload) {
        onForceReload();
      }
    } catch (err) {
      console.warn("Deck resync error:", err);
    } finally {
      setTimeout(() => setIsResyncing(false), 500);
    }
  }, [isTeacher, currentSlideIndex, broadcastPresentationSource, redrawCanvas, onForceReload, room]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. File Upload Handler (Real-Time in Class with PPTX & PDF Support)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isPptx = ext === "pptx" || ext === "ppt";
    const isPdf = ext === "pdf" || file.type === "application/pdf";
    const isImg = file.type.startsWith("image/");

    if (!isPptx && !isPdf && !isImg) {
      alert("Please upload a PowerPoint presentation (.pptx), PDF (.pdf), or slide image.");
      return;
    }

    setIsLoadingPdf(true);
    setPdfProgress("Uploading and preparing presentation...");

    try {
      const inferredMime = isPptx
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : isPdf
          ? "application/pdf"
          : file.type || "image/png";

      let uploadedUrl = "";

      // 1. Try pre-signed Cloudflare R2 upload
      try {
        const presigned = await fetchApi<any>(
          `/storage/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(inferredMime)}`,
          { silent: true }
        );

        if (presigned?.uploadUrl && presigned?.finalUrl) {
          const res = await fetch(presigned.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": inferredMime },
            body: file,
          });

          if (res.ok) {
            uploadedUrl = presigned.finalUrl;
            if (classId) {
              await fetchApi(`/live-class/${classId}/files`, {
                method: "POST",
                body: JSON.stringify({
                  fileName: file.name,
                  fileUrl: uploadedUrl,
                  fileSize: file.size,
                  mimeType: inferredMime,
                }),
                silent: true,
              });
            }
          }
        }
      } catch (presignedErr) {
        console.warn("Storage presigned upload bypassed, falling back to direct upload:", presignedErr);
      }

      // 2. Direct server fallback upload if presigned upload is unavailable or unconfigured
      if (!uploadedUrl && classId) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read local presentation file"));
          reader.readAsDataURL(file);
        });

        const uploadRes = await fetchApi<any>(`/live-class/${classId}/upload`, {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            fileType: inferredMime,
            fileSize: file.size,
            dataUrl,
          }),
        });

        if (uploadRes?.file?.url) {
          uploadedUrl = uploadRes.file.url;
        }
      }

      // 3. Render slides locally
      if (isPptx) {
        await processPptxFile(file, file.name);
      } else if (isPdf) {
        await processPdfFile(file, file.name);
      } else if (isImg) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            const newSlide: SlideItem = {
              id: `slide-img-${Date.now()}`,
              url: reader.result,
              pageNumber: 1,
              title: file.name,
            };
            setSlides([newSlide]);
            setCurrentSlideIndex(0);
          }
        };
        reader.readAsDataURL(file);
      }

      // 4. Lightweight WebRTC Broadcast to students (< 300 bytes)
      if (uploadedUrl && isTeacher) {
        broadcastPresentationSource(
          uploadedUrl,
          file.name,
          isPptx ? "pptx" : isPdf ? "pdf" : "image",
          0
        );

        if (room?.localParticipant) {
          const fileSharedPayload = JSON.stringify({
            type: "FILE_SHARED",
            name: file.name,
            url: uploadedUrl,
          });
          room.localParticipant.publishData(new TextEncoder().encode(fileSharedPayload), { reliable: true }).catch(() => { });
        }
      }
    } catch (err: any) {
      console.error("Presentation file upload error:", err);
      alert(`Presentation loading error: ${err?.message || "Invalid or inaccessible file"}`);
    } finally {
      setIsLoadingPdf(false);
      setPdfProgress("");
      if (e.target) e.target.value = "";
    }
  };

  const activeSlide = slides[currentSlideIndex];

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex flex-col relative overflow-hidden bg-[#0d0f14] ${isFullscreen ? "fixed inset-0 z-50" : ""
        }`}
    >
      {/* ── TOP SLIDE NAVIGATION & ACTIONS BAR ── */}
      <div className="h-12 shrink-0 bg-[#161820] border-b border-white/10 px-3 flex items-center justify-between text-white text-xs z-30">
        {/* Left: Deck info & Thumbnails Toggle */}
        <div className="flex items-center gap-2">
          {slides.length > 0 && (
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${showThumbnails
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                }`}
              title="Slide Overview"
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Slides ({slides.length})</span>
            </button>
          )}

          {activeSlide && (
            <span className="text-white/60 font-medium truncate max-w-[140px] sm:max-w-xs">
              {activeSlide.title || `Slide ${currentSlideIndex + 1}`}
            </span>
          )}
        </div>

        {/* Center: Slide Prev / Next / Counter */}
        {slides.length > 0 && (
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-white/10">
            <button
              onClick={() => goToSlide(currentSlideIndex - 1)}
              disabled={currentSlideIndex === 0 || (!isTeacher && !studentDrawAllowed)}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous Slide"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-[11px] font-bold px-2 text-white">
              {currentSlideIndex + 1} / {slides.length}
            </span>

            <button
              onClick={() => goToSlide(currentSlideIndex + 1)}
              disabled={currentSlideIndex === slides.length - 1 || (!isTeacher && !studentDrawAllowed)}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next Slide"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Right: Teacher Controls & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Teacher: Allow Students to Draw Toggle */}
          {isTeacher && (
            <button
              onClick={toggleStudentPermission}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${studentDrawAllowed
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                }`}
              title="Toggle whether students can draw on presentation slides"
            >
              <Users size={13} />
              <span className="hidden md:inline">Students Draw:</span>
              <span className={studentDrawAllowed ? "text-emerald-400 font-bold" : "text-white/40"}>
                {studentDrawAllowed ? "ON" : "OFF"}
              </span>
            </button>
          )}

          {/* Teacher: Upload Presentation */}
          {isTeacher && (
            <label className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors shadow-sm">
              <Upload size={13} />
              <span className="hidden sm:inline">Open Slides</span>
              <input
                type="file"
                accept=".pdf,.pptx,.ppt,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}

          {/* Resync Deck / Clear Stuck State Button */}
          <button
            onClick={handleResyncDeck}
            disabled={isResyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
            title="Resync slides and clear any stuck state"
          >
            <RotateCw size={12} className={isResyncing ? "animate-spin text-blue-400" : ""} />
            <span className="hidden sm:inline">{isResyncing ? "Resyncing..." : "Resync"}</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors ml-1"
              title="Close Presentation View"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN SLIDE STAGE & ANNOTATION CANVAS ── */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Expandable Slide Thumbnails Sidebar */}
        {showThumbnails && slides.length > 0 && (
          <div className="w-48 shrink-0 bg-[#12141a] border-r border-white/10 overflow-y-auto p-2 flex flex-col gap-2 z-20">
            <div className="flex items-center justify-between text-[11px] text-white/50 px-1 py-0.5 mb-1 font-semibold">
              <span>All Slides</span>
              <button onClick={() => setShowThumbnails(false)} className="hover:text-white">
                <X size={12} />
              </button>
            </div>
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => goToSlide(idx)}
                className={`relative rounded-lg overflow-hidden border transition-all text-left group ${idx === currentSlideIndex
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100"
                  }`}
              >
                <div className="aspect-[16/10] bg-black/40 w-full relative">
                  <img src={s.url} alt={`Slide ${idx + 1}`} className="w-full h-full object-contain" />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-bold text-white px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Central Presentation Canvas Area */}
        <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          {isLoadingPdf ? (
            <div className="flex flex-col items-center justify-center gap-3 text-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-xs font-medium text-white/70">{pdfProgress}</p>
            </div>
          ) : !activeSlide ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-6 max-w-sm rounded-2xl bg-white/5 border border-white/10 text-white">
              <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileText size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold">No Presentation Loaded</h4>
                <p className="text-xs text-white/50 mt-1">
                  {isTeacher
                    ? "Upload a PDF presentation or slide deck to begin presenting and drawing."
                    : "Waiting for the instructor to open presentation slides."}
                </p>
              </div>
              {isTeacher && (
                <label className="mt-2 cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-lg">
                  <Upload size={14} />
                  <span>Choose Presentation (PDF / PowerPoint)</span>
                  <input
                    type="file"
                    accept=".pdf,.pptx,.ppt,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          ) : (
            <div
              className="relative max-h-full max-w-full flex items-center justify-center select-none shadow-2xl rounded-xl overflow-hidden"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: "transform 0.15s ease-out",
              }}
            >
              {/* Underlying Slide Image (Memoized to prevent flashing on drawing strokes) */}
              <SlideBackground url={activeSlide.url} />

              {/* Overlaid Vector Drawing Canvas */}
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />

              {/* Laser Pointer Pulse */}
              {laserPosition && (
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-40 transition-transform duration-75"
                  style={{
                    left: `${laserPosition.x * 100}%`,
                    top: `${laserPosition.y * 100}%`,
                  }}
                >
                  <div className="h-4 w-4 rounded-full bg-red-500 border-2 border-white shadow-[0_0_12px_#ef4444] animate-ping" />
                  <span className="text-[9px] font-bold text-white bg-black/75 px-1.5 py-0.2 rounded mt-1 shadow-md">
                    {laserPosition.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FLOATING DRAWING TOOLBAR ── */}
        {canDraw && activeSlide && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#161820]/90 border border-white/15 shadow-2xl backdrop-blur-md max-w-[calc(100vw-1.5rem)] overflow-x-auto scrollbar-none">
            {/* Tool: Pen */}
            <button
              onClick={() => setCurrentTool("pen")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "pen" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Pen (Draw)"
            >
              <PenTool size={16} />
            </button>

            {/* Tool: Highlighter */}
            <button
              onClick={() => setCurrentTool("highlighter")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "highlighter" ? "bg-amber-500 text-black font-bold" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Highlighter"
            >
              <Highlighter size={16} />
            </button>

            {/* Tool: Laser Pointer */}
            <button
              onClick={() => setCurrentTool("laser")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "laser" ? "bg-red-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Laser Pointer (Temporary focus)"
            >
              <Sparkles size={16} />
            </button>

            {/* Tool: Arrow */}
            <button
              onClick={() => setCurrentTool("arrow")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "arrow" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Arrow"
            >
              <ArrowRight size={16} />
            </button>

            {/* Tool: Rectangle */}
            <button
              onClick={() => setCurrentTool("rect")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "rect" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Box / Rectangle"
            >
              <Square size={16} />
            </button>

            {/* Tool: Eraser */}
            <button
              onClick={() => setCurrentTool("eraser")}
              className={`p-2 rounded-xl transition-colors ${currentTool === "eraser" ? "bg-white/25 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              title="Eraser"
            >
              <Eraser size={16} />
            </button>

            <div className="h-6 w-px bg-white/15 mx-0.5" />

            {/* Color Palette Popover Button */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="h-7 w-7 rounded-full border border-white/20 flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: penColor }}
                title="Change Color"
              />

              {showColorPicker && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-[#1e212b] border border-white/15 shadow-2xl flex items-center gap-1.5 z-50">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setPenColor(c);
                        setShowColorPicker(false);
                      }}
                      className="h-6 w-6 rounded-full border border-white/20 transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: c }}
                    >
                      {penColor === c && <Check size={12} className={c === "#ffffff" ? "text-black" : "text-white"} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stroke Size Cycle */}
            <button
              onClick={() => {
                const nextIdx = (STROKE_SIZES.indexOf(penSize) + 1) % STROKE_SIZES.length;
                setPenSize(STROKE_SIZES[nextIdx]);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold flex items-center justify-center min-w-[28px]"
              title="Stroke Thickness"
            >
              {penSize}px
            </button>

            <div className="h-6 w-px bg-white/15 mx-0.5" />

            {/* Clear Current Slide Drawings */}
            <button
              onClick={clearCurrentSlideAnnotations}
              className="p-2 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear all annotations on this slide"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SlideBackground = memo(function SlideBackground({ url }: { url: string }) {
  return (
    <img
      src={url}
      alt="Presentation Slide"
      className="max-h-[82dvh] max-w-full object-contain pointer-events-none rounded-xl"
      draggable={false}
    />
  );
});

