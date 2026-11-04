"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
}: PresentationDeckProps) {
  // Slides State
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
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

  // Permission check
  const canDraw = isTeacher || allowStudentDraw;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PDF.js Dynamic Loader (Loads client-side from CDN without changing package.json)
  // ─────────────────────────────────────────────────────────────────────────────
  const loadPdfJs = useCallback(async (): Promise<any> => {
    if (typeof window === "undefined") return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(lib);
        } else {
          reject(new Error("pdfjsLib not available after script load"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js engine"));
      document.head.appendChild(script);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Render PDF Pages into High-DPI Slide Images
  // ─────────────────────────────────────────────────────────────────────────────
  const processPdfFile = useCallback(
    async (fileOrUrl: File | string, fileName?: string) => {
      setIsLoadingPdf(true);
      setPdfProgress("Initializing slide renderer...");
      try {
        const pdfjs = await loadPdfJs();
        let pdfData: any;

        if (typeof fileOrUrl === "string") {
          pdfData = { url: fileOrUrl };
        } else {
          const buffer = await fileOrUrl.arrayBuffer();
          pdfData = { data: buffer };
        }

        setPdfProgress("Loading presentation pages...");
        const loadingTask = pdfjs.getDocument(pdfData);
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        const generatedSlides: SlideItem[] = [];

        for (let i = 1; i <= totalPages; i++) {
          setPdfProgress(`Rendering slide ${i} of ${totalPages}...`);
          const page = await pdf.getPage(i);

          // Render at 2x scale for sharp text on Retina / mobile screens
          const viewport = page.getViewport({ scale: 2 });
          const offCanvas = document.createElement("canvas");
          const ctx = offCanvas.getContext("2d");
          if (!ctx) continue;

          offCanvas.width = viewport.width;
          offCanvas.height = viewport.height;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = offCanvas.toDataURL("image/jpeg", 0.88);
          generatedSlides.push({
            id: `slide-${i}-${Date.now()}`,
            url: dataUrl,
            pageNumber: i,
            title: `${fileName || "Slide"} ${i}`,
            width: viewport.width,
            height: viewport.height,
          });
        }

        setSlides(generatedSlides);
        setCurrentSlideIndex(0);

        // Broadcast to students via LiveKit
        if (isTeacher && room?.localParticipant) {
          const payload = JSON.stringify({
            type: "SLIDE_DECK_LOADED",
            slides: generatedSlides.map((s) => ({
              id: s.id,
              url: s.url,
              pageNumber: s.pageNumber,
              title: s.title,
            })),
          });
          const bytes = new TextEncoder().encode(payload);
          room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
        }
      } catch (err: any) {
        console.error("PDF presentation processing error:", err);
        alert("Failed to load presentation PDF. Please make sure the file is valid.");
      } finally {
        setIsLoadingPdf(false);
        setPdfProgress("");
      }
    },
    [loadPdfJs, isTeacher, room]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Auto-load pre-attached slides if provided
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (slides.length > 0) return;
    const pdfAttachment = initialFiles.find((f) => f.url.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfAttachment) {
      processPdfFile(pdfAttachment.url, pdfAttachment.name);
    } else {
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
      }
    }
  }, [initialFiles, slides.length, processPdfFile]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. LiveKit Synchronization Receiver (Slide navigation & Real-time strokes)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;

    const handleIncomingData = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "SLIDE_DECK_LOADED" && Array.isArray(data.slides)) {
          setSlides(data.slides);
          setCurrentSlideIndex(0);
        } else if (data.type === "SLIDE_INDEX_CHANGE") {
          setCurrentSlideIndex(data.index);
        } else if (data.type === "SLIDE_STROKE_ADDED" && data.stroke) {
          const s = data.stroke as DrawingStroke;
          setStrokesBySlide((prev) => {
            const list = prev[s.slideIndex] || [];
            return {
              ...prev,
              [s.slideIndex]: [...list, s],
            };
          });
        } else if (data.type === "SLIDE_STROKES_CLEARED") {
          setStrokesBySlide((prev) => ({
            ...prev,
            [data.slideIndex]: [],
          }));
        } else if (data.type === "SLIDE_LASER_POINTER") {
          setLaserPosition({ x: data.x, y: data.y, name: data.name || "Speaker" });
          if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
          laserTimerRef.current = setTimeout(() => setLaserPosition(null), 1400);
        } else if (data.type === "SLIDE_PERMISSIONS_UPDATE") {
          if (onToggleStudentDraw) {
            onToggleStudentDraw(Boolean(data.allowStudentDraw));
          }
        }
      } catch {}
    };

    room.on("dataReceived", handleIncomingData);
    return () => {
      room.off("dataReceived", handleIncomingData);
      if (laserTimerRef.current) clearTimeout(laserTimerRef.current);
    };
  }, [room, onToggleStudentDraw]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Canvas Drawing Rendering Loop
  // ─────────────────────────────────────────────────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match physical pixels with styling
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const slideStrokes = strokesBySlide[currentSlideIndex] || [];
    const allStrokes = currentDrawingStroke ? [...slideStrokes, currentDrawingStroke] : slideStrokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length === 0) continue;

      ctx.save();
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
      } else if (stroke.tool === "rect" && stroke.points.length >= 2) {
        const p1 = stroke.points[0];
        const p2 = stroke.points[stroke.points.length - 1];
        const x = Math.min(p1.x, p2.x) * canvas.width;
        const y = Math.min(p1.y, p2.y) * canvas.height;
        const w = Math.abs(p2.x - p1.x) * canvas.width;
        const h = Math.abs(p2.y - p1.y) * canvas.height;
        ctx.strokeRect(x, y, w, h);
      } else {
        // Freeform pen or highlighter
        const first = stroke.points[0];
        ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
        }
        ctx.stroke();
      }

      ctx.restore();
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
    } catch {}

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
        room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
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
      room.localParticipant.publishData(bytes, { reliable: false }).catch(() => {});
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
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
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
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
    }
  };

  const toggleStudentPermission = () => {
    if (!isTeacher) return;
    const nextState = !allowStudentDraw;
    if (onToggleStudentDraw) {
      onToggleStudentDraw(nextState);
    }
    if (room?.localParticipant) {
      const payload = JSON.stringify({
        type: "SLIDE_PERMISSIONS_UPDATE",
        allowStudentDraw: nextState,
      });
      const bytes = new TextEncoder().encode(payload);
      room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. File Upload Handler (Real-Time in Class)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      processPdfFile(file, file.name);
    } else if (file.type.startsWith("image/")) {
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

          if (isTeacher && room?.localParticipant) {
            const payload = JSON.stringify({
              type: "SLIDE_DECK_LOADED",
              slides: [newSlide],
            });
            const bytes = new TextEncoder().encode(payload);
            room.localParticipant.publishData(bytes, { reliable: true }).catch(() => {});
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please upload a PDF presentation or slide image file (.pdf, .png, .jpg).");
    }
  };

  const activeSlide = slides[currentSlideIndex];

  return (
    <div
      ref={containerRef}
      className={`h-full w-full flex flex-col relative overflow-hidden bg-[#0d0f14] ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* ── TOP SLIDE NAVIGATION & ACTIONS BAR ── */}
      <div className="h-12 shrink-0 bg-[#161820] border-b border-white/10 px-3 flex items-center justify-between text-white text-xs z-30">
        {/* Left: Deck info & Thumbnails Toggle */}
        <div className="flex items-center gap-2">
          {slides.length > 0 && (
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showThumbnails
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
              disabled={currentSlideIndex === 0 || (!isTeacher && !allowStudentDraw)}
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
              disabled={currentSlideIndex === slides.length - 1 || (!isTeacher && !allowStudentDraw)}
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                allowStudentDraw
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
              title="Toggle whether students can draw on presentation slides"
            >
              <Users size={13} />
              <span className="hidden md:inline">Students Draw:</span>
              <span className={allowStudentDraw ? "text-emerald-400 font-bold" : "text-white/40"}>
                {allowStudentDraw ? "ON" : "OFF"}
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
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          )}

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
                className={`relative rounded-lg overflow-hidden border transition-all text-left group ${
                  idx === currentSlideIndex
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
                  <span>Choose Presentation (PDF)</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
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
              {/* Underlying Slide Image */}
              <img
                src={activeSlide.url}
                alt="Presentation Slide"
                className="max-h-[82dvh] max-w-full object-contain pointer-events-none rounded-xl"
                draggable={false}
              />

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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#161820]/90 border border-white/15 shadow-2xl backdrop-blur-md">
            {/* Tool: Pen */}
            <button
              onClick={() => setCurrentTool("pen")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "pen" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Pen (Draw)"
            >
              <PenTool size={16} />
            </button>

            {/* Tool: Highlighter */}
            <button
              onClick={() => setCurrentTool("highlighter")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "highlighter" ? "bg-amber-500 text-black font-bold" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Highlighter"
            >
              <Highlighter size={16} />
            </button>

            {/* Tool: Laser Pointer */}
            <button
              onClick={() => setCurrentTool("laser")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "laser" ? "bg-red-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Laser Pointer (Temporary focus)"
            >
              <Sparkles size={16} />
            </button>

            {/* Tool: Arrow */}
            <button
              onClick={() => setCurrentTool("arrow")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "arrow" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Arrow"
            >
              <ArrowRight size={16} />
            </button>

            {/* Tool: Rectangle */}
            <button
              onClick={() => setCurrentTool("rect")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "rect" ? "bg-blue-600 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Box / Rectangle"
            >
              <Square size={16} />
            </button>

            {/* Tool: Eraser */}
            <button
              onClick={() => setCurrentTool("eraser")}
              className={`p-2 rounded-xl transition-colors ${
                currentTool === "eraser" ? "bg-white/25 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
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

