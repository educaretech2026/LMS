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
  knownDurationSeconds?: number;
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
 * Fast preparation of recorded blob for direct upload.
 * Injects EBML duration header in < 200ms if WebM, or preserves MP4 container.
 * Accurately detects MIME type and file extension so presigned URLs match uploaded bytes.
 */
export async function prepareRecordingBlobForUpload(
  blob: Blob,
  durationSeconds?: number
): Promise<{ uploadBlob: Blob; mimeType: string; extension: string }> {
  const rawType = (blob.type || '').toLowerCase();
  const isMp4 = rawType.includes('mp4') || (!rawType.includes('webm') && !rawType.includes('matroska'));
  const mimeType = isMp4 ? 'video/mp4' : 'video/webm';
  const extension = isMp4 ? '.mp4' : '.webm';

  if (!isMp4 && durationSeconds && durationSeconds > 0) {
    try {
      const fixed = await fixWebmDuration(blob, Math.round(durationSeconds * 1000));
      return { uploadBlob: fixed, mimeType, extension };
    } catch {
      return { uploadBlob: blob, mimeType, extension };
    }
  }

  return { uploadBlob: blob, mimeType, extension };
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
 * Injects or updates the EBML Duration element in a WebM file.
 * Browser MediaRecorder creates streaming WebM files without duration metadata,
 * causing video players to report Infinity duration and freeze or stall during scrubbing.
 */
export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Look for Info element [0x15, 0x49, 0xA9, 0x66]
    let infoPos = -1;
    for (let i = 0; i < Math.min(bytes.length - 4, 15000); i++) {
      if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xA9 && bytes[i + 3] === 0x66) {
        infoPos = i;
        break;
      }
    }

    if (infoPos === -1) {
      return blob; // Not a standard WebM or Info not in first 15KB
    }

    // Read Info length (variable length int)
    let pos = infoPos + 4;
    let infoLen = 0;
    let mask = 0x80;
    let lenBytes = 1;
    while (lenBytes <= 8 && !(bytes[pos] & mask)) {
      mask >>= 1;
      lenBytes++;
    }
    if (lenBytes > 8) return blob;

    infoLen = bytes[pos] & (mask - 1);
    for (let i = 1; i < lenBytes; i++) {
      infoLen = (infoLen << 8) | bytes[pos + i];
    }
    const infoEnd = pos + lenBytes + infoLen;
    pos += lenBytes;

    // Search for TimecodeScale (0x2A 0xD7 0xB1) and Duration (0x44 0x89) inside Info
    let timecodeScale = 1000000; // default 1ms
    let durationPos = -1;
    let durationLen = 0;

    let scanPos = pos;
    while (scanPos < Math.min(infoEnd, bytes.length - 4)) {
      if (bytes[scanPos] === 0x2A && bytes[scanPos + 1] === 0xD7 && bytes[scanPos + 2] === 0xB1) {
        const tLen = bytes[scanPos + 3] & 0x7F;
        let ts = 0;
        for (let j = 0; j < tLen; j++) {
          ts = (ts << 8) | bytes[scanPos + 4 + j];
        }
        if (ts > 0) timecodeScale = ts;
        scanPos += 4 + tLen;
      } else if (bytes[scanPos] === 0x44 && bytes[scanPos + 1] === 0x89) {
        durationPos = scanPos;
        const dLenByte = bytes[scanPos + 2];
        durationLen = dLenByte & 0x7F;
        break;
      } else {
        scanPos++;
      }
    }

    const durationInUnits = (durationMs * 1000000) / timecodeScale;

    if (durationPos !== -1 && (durationLen === 4 || durationLen === 8)) {
      // Overwrite existing Duration element
      const view = new DataView(buffer);
      if (durationLen === 4) {
        view.setFloat32(durationPos + 3, durationInUnits, false);
      } else {
        view.setFloat64(durationPos + 3, durationInUnits, false);
      }
      return new Blob([buffer], { type: blob.type });
    }

    // Duration element not present in Info: inject 0x44 0x89 [0x84] [float32] (7 bytes) into Info
    const durationElem = new Uint8Array(7);
    durationElem[0] = 0x44;
    durationElem[1] = 0x89;
    durationElem[2] = 0x84; // 4-byte float size with marker
    const dView = new DataView(durationElem.buffer);
    dView.setFloat32(3, durationInUnits, false);

    // Reconstruct buffer with injected duration into Info
    const newBytes = new Uint8Array(bytes.length + 7);
    newBytes.set(bytes.subarray(0, pos), 0);
    newBytes.set(durationElem, pos);
    newBytes.set(bytes.subarray(pos), pos + 7);

    // Update Info element size (+7 bytes)
    const newInfoLen = infoLen + 7;
    if (lenBytes === 4) {
      newBytes[infoPos + 4] = 0x10 | ((newInfoLen >> 24) & 0x0F);
      newBytes[infoPos + 5] = (newInfoLen >> 16) & 0xFF;
      newBytes[infoPos + 6] = (newInfoLen >> 8) & 0xFF;
      newBytes[infoPos + 7] = newInfoLen & 0xFF;
    }

    return new Blob([newBytes], { type: blob.type });
  } catch (err) {
    console.warn('Could not patch WebM duration header, returning original blob:', err);
    return blob;
  }
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

  const rawDuration = video.duration;
  const effectiveDuration = (options.knownDurationSeconds && options.knownDurationSeconds > 0)
    ? options.knownDurationSeconds
    : (Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0);
  const duration = effectiveDuration > 0 ? effectiveDuration : 1;

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
    let renderTimer: any = null;
    let stallWatchdogTimer: any = null;
    let isFinished = false;
    let lastTime = -1;
    let stallCounter = 0;

    const cleanup = () => {
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (renderTimer) clearInterval(renderTimer);
      if (stallWatchdogTimer) clearInterval(stallWatchdogTimer);
      combinedStream.getTracks().forEach((t) => t.stop());
      canvasStream.getTracks().forEach((t) => t.stop());
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      URL.revokeObjectURL(sourceUrl);
    };

    const finishCompression = () => {
      if (isFinished) return;
      isFinished = true;
      onProgress?.({ percent: 98, stage: 'Finalizing compressed stream package...' });
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 200);
    };

    recorder.onstop = async () => {
      cleanup();
      const rawBlob = new Blob(chunks, { type: mimeType });
      // Inject WebM Duration metadata to fix video player seeking and runtime status bar
      let compressedBlob = rawBlob;
      if (mimeType.includes('webm') && duration > 0) {
        try {
          compressedBlob = await fixWebmDuration(rawBlob, Math.round(duration * 1000));
        } catch {
          compressedBlob = rawBlob;
        }
      }
      const compressedSize = compressedBlob.size;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

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

    // Frame drawing routine: resilient to background tab throttling
    const drawFrame = () => {
      if (isFinished) return;
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        const progressRatio = duration > 0 ? Math.min(1, Math.max(0, video.currentTime / duration)) : 0;
        const percent = Math.min(95, Math.round(15 + progressRatio * 80));
        onProgress?.({
          percent,
          stage: `Compressing frames (${Math.round(progressRatio * 100)}%)...`,
        });

        // If video reached target duration, complete
        if (effectiveDuration > 0 && video.currentTime >= effectiveDuration - 0.2) {
          finishCompression();
          return;
        }
      }

      if (!video.ended && !video.paused && !isFinished) {
        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(drawFrame);
        } else {
          animFrameId = requestAnimationFrame(drawFrame);
        }
      }
    };

    video.onended = () => {
      finishCompression();
    };

    // Stall detector to ensure background tab throttling or Infinity duration doesn't hang forever
    stallWatchdogTimer = setInterval(() => {
      if (isFinished) return;
      if (Math.abs(video.currentTime - lastTime) < 0.05 && !video.paused) {
        stallCounter++;
        if (stallCounter >= 8) {
          console.warn('Video playback stall detected during compression, wrapping up stream...');
          finishCompression();
        }
      } else {
        stallCounter = 0;
        lastTime = video.currentTime;
      }
    }, 1000);

    // Start recorder and playback
    try {
      recorder.start(1000);
      video.playbackRate = 1.0; // Strictly normal speed to match MediaRecorder wall-clock timestamps
      // Backup timer to guarantee frames are pushed even if requestAnimationFrame throttles in background
      renderTimer = setInterval(drawFrame, Math.round(1000 / targetFps));
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

