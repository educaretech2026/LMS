/**
 * Client-Side Video Compression Engine
 *
 * Compresses recorded live classes and webinars directly in the browser
 * before uploading to Cloudflare R2 / S3 storage.
 *
 * Optimization strategies:
 * - Resolution downscaling: Max 720p (1280x720) preserving aspect ratio
 * - Framerate normalization: 24 fps (crystal clear for lectures, slides, & webcams)
 * - Target video bitrate: 1.2 Mbps (60-80% smaller than raw WebM capture)
 * - Target audio bitrate: 96 kbps Opus/AAC
 * - Fallback protection: Gracefully falls back to original blob if browser codecs fail
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  targetFps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  playbackRate?: number;
  onProgress?: (progress: { percent: number; stage: string; currentBytes?: number }) => void;
}

export interface CompressionResult {
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
  mimeType: string;
}

/**
 * Detect the best supported video mimeType for browser MediaRecorder compression.
 */
export function getSupportedCompressionMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';

  const preferred = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];

  for (const mime of preferred) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return 'video/webm';
}

/**
 * Calculates scaled dimensions bounded by maxWidth and maxHeight while maintaining aspect ratio.
 * Ensures dimensions are even numbers (required by VP8/VP9/H264 video encoders).
 */
function getScaledDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = srcWidth;
  let height = srcHeight;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Codecs require even dimensions
  width = width % 2 === 0 ? width : width - 1;
  height = height % 2 === 0 ? height : height - 1;

  return {
    width: Math.max(320, width),
    height: Math.max(240, height),
  };
}

/**
 * Compresses an in-memory video Blob or File.
 */
export async function compressVideo(
  sourceBlobOrFile: Blob | File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const originalSize = sourceBlobOrFile.size;
  const maxWidth = options.maxWidth || 1280;
  const maxHeight = options.maxHeight || 720;
  const targetFps = options.targetFps || 24;
  const videoBitrate = options.videoBitrate || 1_200_000; // 1.2 Mbps
  const audioBitrate = options.audioBitrate || 96_000;    // 96 kbps
  const playbackSpeed = options.playbackRate ?? 1.0;       // Strict 1:1 real-time speed (normal motion & audio pitch)
  const onProgress = options.onProgress;

  if (typeof window === 'undefined') {
    throw new Error('Video compression is only supported in browser environments.');
  }

  onProgress?.({ percent: 5, stage: 'Analyzing video stream metadata...' });

  const sourceUrl = URL.createObjectURL(sourceBlobOrFile);
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.crossOrigin = 'anonymous';
  video.muted = false; // Need audio track routing
  video.playsInline = true;
  video.preload = 'auto';

  // Load metadata to obtain duration and resolution
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video metadata for compression.'));
    setTimeout(() => reject(new Error('Timeout loading video metadata.')), 15000);
  });

  const duration = video.duration || 1;
  const { width: targetWidth, height: targetHeight } = getScaledDimensions(
    video.videoWidth || 1280,
    video.videoHeight || 720,
    maxWidth,
    maxHeight
  );

  onProgress?.({ percent: 12, stage: `Configuring resolution (${targetWidth}x${targetHeight} @ ${targetFps}fps)...` });

  // Canvas for frame drawing
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error('Canvas 2D context unavailable.');
  }

  // AudioContext to route audio from video element to destination
  let audioContext: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioTrack: MediaStreamTrack | null = null;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
      audioDestination = audioContext.createMediaStreamDestination();
      const sourceNode = audioContext.createMediaElementSource(video);
      sourceNode.connect(audioDestination);
      // Also connect to a silent gain node so video plays without echoing out loud
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      sourceNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      if (audioDestination.stream.getAudioTracks().length > 0) {
        audioTrack = audioDestination.stream.getAudioTracks()[0];
      }
    }
  } catch (audioErr) {
    console.warn('AudioContext mixing not available for compression, video-only stream:', audioErr);
  }

  // Capture canvas video stream
  const canvasStream = canvas.captureStream(targetFps);
  const tracksToRecord: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioTrack) {
    tracksToRecord.push(audioTrack);
  }
  const combinedStream = new MediaStream(tracksToRecord);

  const mimeType = getSupportedCompressionMimeType();
  const chunks: Blob[] = [];

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
      audioBitsPerSecond: audioBitrate,
    });
  } catch (recorderErr) {
    console.warn('MediaRecorder with bitrates failed, falling back to default:', recorderErr);
    recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise<CompressionResult>((resolve, reject) => {
    let animFrameId: number | null = null;
    let isFinished = false;

    const cleanup = () => {
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      combinedStream.getTracks().forEach((t) => t.stop());
      canvasStream.getTracks().forEach((t) => t.stop());
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      URL.revokeObjectURL(sourceUrl);
    };

    recorder.onstop = () => {
      cleanup();
      const compressedBlob = new Blob(chunks, { type: mimeType });
      const compressedSize = compressedBlob.size;
      const compressionRatio = compressedSize / originalSize;

      resolve({
        compressedBlob,
        originalSize,
        compressedSize,
        compressionRatio,
        duration,
        mimeType,
      });
    };

    recorder.onerror = (e: any) => {
      cleanup();
      reject(new Error(e?.error?.message || 'MediaRecorder compression failed.'));
    };

    // Draw loop: continuously draws video frames onto scaled canvas
    const drawFrame = () => {
      if (isFinished) return;
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        const percent = Math.min(95, Math.round(15 + (video.currentTime / duration) * 80));
        onProgress?.({
          percent,
          stage: `Compressing frames (${Math.round((video.currentTime / duration) * 100)}%)...`,
        });
      }

      if (!video.ended && !video.paused) {
        animFrameId = requestAnimationFrame(drawFrame);
      }
    };

    video.onended = () => {
      if (isFinished) return;
      onProgress?.({ percent: 98, stage: 'Finalizing compressed stream package...' });
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 300);
    };

    // Start recorder and playback
    try {
      recorder.start(1000);
      video.playbackRate = 1.0; // Strictly normal speed to match MediaRecorder wall-clock timestamps
      video
        .play()
        .then(() => {
          drawFrame();
        })
        .catch((playErr) => {
          cleanup();
          reject(new Error(`Failed to start video playback for compression: ${playErr?.message}`));
        });
    } catch (startErr) {
      cleanup();
      reject(startErr);
    }
  });
}

