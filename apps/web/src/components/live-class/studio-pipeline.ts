import { Track, Room, LocalVideoTrack } from "livekit-client";
import { StudioSettings, BitratePreset, DEFAULT_STUDIO_SETTINGS } from "./studio-types";

/**
 * High-performance In-Pipeline Studio Video Processor for Edu-Meet Live Studio.
 * Applies T1 (Crop/Pan/Zoom), T3 (Color Grading), T7 (Green Screen / Ultra Key), and T8 (Mirror)
 * directly into the WebRTC upstream publication pipeline via an OffscreenCanvas.
 */
export class StudioVideoProcessor {
  name = "StudioVideoProcessor";
  processedTrack?: MediaStreamTrack;

  private settings: StudioSettings = { ...DEFAULT_STUDIO_SETTINGS };
  private sourceVideo: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private bgImage: HTMLImageElement | null = null;
  private isProcessing = false;
  private frameCallbackId: number | null = null;
  private rafId: number | null = null;

  constructor(initialSettings?: StudioSettings) {
    if (initialSettings) {
      this.settings = { ...initialSettings };
    }
  }

  public updateSettings(newSettings: StudioSettings) {
    const prevBg = this.settings.chromaKey.backgroundUrl;
    this.settings = { ...newSettings };

    // Preload new background image if changed
    if (this.settings.chromaKey.enabled && this.settings.chromaKey.backgroundUrl !== prevBg) {
      this.loadBackgroundImage(this.settings.chromaKey.backgroundUrl);
    }
  }

  private loadBackgroundImage(url: string) {
    if (!url) {
      this.bgImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      this.bgImage = img;
    };
    img.onerror = () => {
      console.warn("StudioProcessor: Failed to load background image:", url);
      this.bgImage = null;
    };
  }

  async init(opts: { kind: any; track: MediaStreamTrack; element?: HTMLMediaElement }): Promise<void> {
    await this.destroy();

    // 1. Create source hidden video player
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = new MediaStream([opts.track]);

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
        resolve();
      };
      // Fallback timeout in case onloadedmetadata doesn't fire immediately
      setTimeout(resolve, 800);
    });

    this.sourceVideo = video;

    // 2. Setup processing canvas
    const canvas = document.createElement("canvas");
    const targetWidth = video.videoWidth || 1280;
    const targetHeight = video.videoHeight || 720;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: false });
    this.canvas = canvas;
    this.ctx = ctx;

    // 3. Setup temporary canvas for Chroma Key operations
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    this.tempCanvas = tempCanvas;
    this.tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true, alpha: true });

    if (this.settings.chromaKey.enabled && this.settings.chromaKey.backgroundUrl) {
      this.loadBackgroundImage(this.settings.chromaKey.backgroundUrl);
    }

    // 4. Capture output stream
    const processedStream = canvas.captureStream(30);
    this.processedTrack = processedStream.getVideoTracks()[0];

    // 5. Start render loop
    this.isProcessing = true;
    this.renderLoop();
  }

  async restart(opts: { kind: any; track: MediaStreamTrack; element?: HTMLMediaElement }): Promise<void> {
    await this.init(opts);
  }

  async destroy(): Promise<void> {
    this.isProcessing = false;
    if (this.frameCallbackId !== null && this.sourceVideo && "cancelVideoFrameCallback" in this.sourceVideo) {
      (this.sourceVideo as any).cancelVideoFrameCallback(this.frameCallbackId);
      this.frameCallbackId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.processedTrack) {
      this.processedTrack.stop();
      this.processedTrack = undefined;
    }
    if (this.sourceVideo) {
      this.sourceVideo.pause();
      this.sourceVideo.srcObject = null;
      this.sourceVideo = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.tempCanvas = null;
    this.tempCtx = null;
  }

  private renderLoop = () => {
    if (!this.isProcessing) return;

    if (this.sourceVideo && "requestVideoFrameCallback" in this.sourceVideo) {
      this.frameCallbackId = (this.sourceVideo as any).requestVideoFrameCallback(() => {
        this.processCurrentFrame();
        this.renderLoop();
      });
    } else {
      this.rafId = requestAnimationFrame(() => {
        this.processCurrentFrame();
        this.renderLoop();
      });
    }
  };

  private processCurrentFrame() {
    const video = this.sourceVideo;
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!video || !canvas || !ctx || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // --- T1: Crop / Pan / Zoom Calculations ---
    const crop = this.settings.crop;
    let targetAspect = vw / vh;
    if (crop.aspectRatio === "16:9") targetAspect = 16 / 9;
    else if (crop.aspectRatio === "4:3") targetAspect = 4 / 3;
    else if (crop.aspectRatio === "1:1") targetAspect = 1;

    let baseCropWidth = vw;
    let baseCropHeight = vh;
    if (vw / vh > targetAspect) {
      baseCropWidth = vh * targetAspect;
    } else {
      baseCropHeight = vw / targetAspect;
    }

    const zoom = Math.max(1.0, Math.min(3.0, crop.zoom || 1.0));
    const sw = baseCropWidth / zoom;
    const sh = baseCropHeight / zoom;

    // Pan percentage offset (-50% to +50%)
    const maxPanX = (vw - sw) / 2;
    const maxPanY = (vh - sh) / 2;
    const panOffsetPxX = (crop.panX / 50) * maxPanX;
    const panOffsetPxY = (crop.panY / 50) * maxPanY;

    const sx = Math.max(0, Math.min(vw - sw, (vw - sw) / 2 + panOffsetPxX));
    const sy = Math.max(0, Math.min(vh - sh, (vh - sh) / 2 + panOffsetPxY));

    // --- T3: Colour Adjustment Filter String ---
    const color = this.settings.color;
    const effectiveBrightness = Math.max(0, color.brightness + color.exposure);
    const contrast = Math.max(0, color.contrast);
    const saturation = Math.max(0, color.saturation);
    const warmth = color.warmth;
    const sepia = warmth > 0 ? warmth * 0.8 : 0;
    const hueRotate = warmth < 0 ? warmth * 0.4 : 0;
    const filterString = `brightness(${effectiveBrightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg)`;

    // --- T7: Green Screen / Ultra Key Processing ---
    const chroma = this.settings.chromaKey;
    const isChromaActive = chroma.enabled && this.tempCanvas && this.tempCtx;

    ctx.save();

    // --- T8: Mirror Effect ---
    if (this.settings.mirror) {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }

    if (!isChromaActive) {
      // Normal direct drawing with color grading
      ctx.filter = filterString;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
      ctx.filter = "none";
    } else {
      // Chroma Key active
      const tc = this.tempCanvas!;
      const tctx = this.tempCtx!;

      // 1. Draw virtual background first onto main canvas
      if (this.bgImage && this.bgImage.complete && this.bgImage.naturalWidth > 0) {
        ctx.drawImage(this.bgImage, 0, 0, cw, ch);
      } else {
        // Fallback stylish studio gradient background
        const grad = ctx.createLinearGradient(0, 0, cw, ch);
        grad.addColorStop(0, "#0f172a");
        grad.addColorStop(0.5, "#1e293b");
        grad.addColorStop(1, "#090d16");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
      }

      // 2. Draw cropped video onto temp canvas
      tctx.clearRect(0, 0, cw, ch);
      tctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

      // 3. Key out green / selected color
      try {
        const frameData = tctx.getImageData(0, 0, cw, ch);
        const data = frameData.data;
        const keyRgb = hexToRgb(chroma.keyColor || "#00FF00");
        const threshold = chroma.threshold;
        const smoothness = Math.max(0.01, chroma.smoothness);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Normalized color distance from key color
          const diffR = (r - keyRgb.r) / 255;
          const diffG = (g - keyRgb.g) / 255;
          const diffB = (b - keyRgb.b) / 255;
          const dist = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB) / 1.732;

          if (dist < threshold) {
            data[i + 3] = 0; // Fully transparent
          } else if (dist < threshold + smoothness) {
            // Soft feathered boundary
            const alphaFactor = (dist - threshold) / smoothness;
            data[i + 3] = Math.floor(alphaFactor * 255);
          } else {
            // Despill green fringe around edges
            if (g > (r + b) / 2) {
              data[i + 1] = Math.floor((r + b) / 2);
            }
          }
        }
        tctx.putImageData(frameData, 0, 0);

        // 4. Draw keyed foreground with color adjustments on top of virtual background
        ctx.filter = filterString;
        ctx.drawImage(tc, 0, 0, cw, ch);
        ctx.filter = "none";
      } catch (err) {
        // Fallback if getImageData throws (e.g. cross-origin taint)
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
      }
    }

    ctx.restore();
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0, g: 255, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * T2: Dynamic WebRTC Bitrate Controller for upstream video publication
 */
export async function applySenderBitrate(room: any, bitratePreset: BitratePreset, customKbps: number) {
  if (!room || !room.localParticipant) return;
  const pub = Array.from(room.localParticipant.videoTrackPublications.values() as any[]).find(
    (p: any) => p.source === Track.Source.Camera
  );
  const track = pub?.track as LocalVideoTrack | undefined;
  if (!track || !track.sender) return;

  let bps = 750000;
  switch (bitratePreset) {
    case "saver":
      bps = 250000;
      break;
    case "balanced":
      bps = 750000;
      break;
    case "high":
      bps = 1500000;
      break;
    case "studio":
      bps = 3000000;
      break;
    case "custom":
      bps = Math.max(100, Math.min(5000, customKbps)) * 1000;
      break;
  }

  try {
    const params = track.sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = bps;
    await track.sender.setParameters(params);
  } catch (err) {
    console.warn("Bitrate update notice:", err);
  }
}

/**
 * T4: Real-time Audio VU Meter Monitor
 */
export class AudioMeterManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;

  public start(stream: MediaStream, onLevel: (level: number) => void) {
    this.stop();
    this.onLevelCallback = onLevel;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      this.source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        this.onLevelCallback?.(normalized);
        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn("AudioMeterManager init failed", e);
    }
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
    this.analyser = null;
    this.onLevelCallback?.(0);
  }
}

/**
 * T4: Play Pleasant Educational Chime for Speaker Output Testing
 */
export function playTestChime(sinkId?: string) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.3); // D6

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => ctx.close(), 700);
  } catch (err) {
    console.warn("Test chime failed", err);
  }
}

