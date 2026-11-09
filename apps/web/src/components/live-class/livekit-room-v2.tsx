"use client";

import React, { useEffect, useState, useCallback, useRef, memo, useMemo, Component } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext,
  useTracks,
  useParticipants,
  ParticipantTile,
  ConnectionQualityIndicator,
  useTrackToggle,
  useDisconnectButton,
  useLocalParticipant,
  TrackReferenceOrPlaceholder,
  FocusLayout,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Track,
  RoomOptions,
  RoomConnectOptions,
  VideoPresets,
  DisconnectReason,
  LocalVideoTrack,
} from "livekit-client";
import { fetchApi } from "@/lib/api";
import {
  Loader2, WifiOff, FileDown, Upload, MicOff, StopCircle,
  Video, VideoOff, Mic, MonitorUp, MonitorOff, LogOut, FileText,
  Monitor, AlertCircle, AlertTriangle, Hand, MessageSquare, Send, CheckCircle2,
  ChevronRight, Minimize2, Maximize2, Shield, Users, RefreshCw, RotateCw,
  Trash2, Edit3, SlidersHorizontal, X, Presentation, LayoutGrid,
  PenTool, MoreHorizontal, Info, Clock, Download, FileSpreadsheet,
  UserCheck, UserX, ChevronDown, Check, Search, Globe, Radio,
  Share2, Copy, ExternalLink, Play, Pause, Circle, Square,
  GripVertical, Move, Eye, EyeOff
} from "lucide-react";
import { StudioDrawer } from "./studio-drawer";
import { IntermissionStage } from "./intermission-stage";
import { StudioSettings, BreakState, DEFAULT_STUDIO_SETTINGS } from "./studio-types";
import { StudioVideoProcessor } from "./studio-pipeline";
import { PresentationDeck } from "./presentation-deck";
import { MobileSheet } from "./mobile-sheet";
import { PreJoinLobby } from "./pre-join-lobby";
import { WebinarWelcomeLobby } from "./webinar-welcome-lobby";
import { SynchronizedWhiteboard } from "./synchronized-whiteboard";
import { RecordingUploadModal } from "./recording-upload-modal";

interface LiveKitRoomV2Props {
  classId?: string;
  roomId: string;
  identity: string;
  name: string;
  role: string;
  isWebinar?: boolean;
  classTitle?: string;
  subject?: string;
  teacherName?: string;
  backgroundImageUrl?: string | null;
  onLeave: () => void;
}

interface TokenResponse {
  token: string;
  wsUrl: string;
  roomName?: string;
  classId?: string;
  isHost?: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  role: string;
  text: string;
  timestamp: string;
}

interface SharedFile {
  name: string;
  url: string;
}

export interface HandRaiseEntry {
  identity: string;
  name: string;
  raisedAt: number;
}

export interface SessionAttendee {
  identity: string;
  name: string;
  role: string;
  firstJoinedAt: string;
  lastSeenAt: string;
  isOnline: boolean;
}

export type ClassroomStageMode = "grid" | "slides" | "whiteboard";

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatRecordingDuration(totalSec: number) {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function playHandRaiseChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Dual-tone chime: A5 (880Hz) followed by C6 (1046Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046, now + 0.11);
    gain2.gain.setValueAtTime(0.18, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.45);
  } catch {}
}

export function safePublishData(
  room: any,
  payload: any,
  options: { reliable?: boolean } = { reliable: true }
): boolean {
  try {
    if (!room || room.state !== "connected" || !room.localParticipant) {
      return false;
    }
    const bytes =
      typeof payload === "string"
        ? new TextEncoder().encode(payload)
        : payload instanceof Uint8Array
          ? payload
          : new TextEncoder().encode(JSON.stringify(payload));

    if (bytes.byteLength > 62000) {
      console.warn("Payload exceeds single packet threshold:", bytes.byteLength);
      return false;
    }

    room.localParticipant.publishData(bytes, options).catch((err: any) => {
      const msg = String(err?.message || "");
      if (!msg.includes("closed") && !msg.includes("not establish")) {
        console.warn("safePublishData warning:", msg);
      }
    });
    return true;
  } catch (err) {
    console.warn("safePublishData exception:", err);
    return false;
  }
}

/* ── STUDIO PIPELINE MANAGER ── */
function StudioPipelineManager({
  isTeacher,
  settings,
  processorRef,
}: {
  isTeacher: boolean;
  settings: StudioSettings;
  processorRef: React.MutableRefObject<StudioVideoProcessor | null>;
}) {
  const { cameraTrack } = useLocalParticipant();

  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateSettings(settings);
    }
  }, [settings, processorRef]);

  useEffect(() => {
    if (!isTeacher || !cameraTrack || !cameraTrack.track) return;
    const localVideoTrack = cameraTrack.track as LocalVideoTrack;

    const isStudioEffectActive =
      settings.mirror ||
      settings.crop.zoom > 1.0 ||
      settings.crop.panX !== 0 ||
      settings.crop.panY !== 0 ||
      settings.crop.aspectRatio !== "16:9" ||
      settings.color.brightness !== 100 ||
      settings.color.contrast !== 100 ||
      settings.color.saturation !== 100 ||
      settings.color.warmth !== 0 ||
      settings.color.exposure !== 0 ||
      settings.chromaKey.enabled;

    const currentProcessor = localVideoTrack.getProcessor();

    if (isStudioEffectActive && !currentProcessor) {
      const processor = new StudioVideoProcessor(settings);
      processorRef.current = processor;
      localVideoTrack.setProcessor(processor as any, true).catch((err) => {
        console.warn("Failed to set studio video processor:", err);
      });
    } else if (!isStudioEffectActive && currentProcessor) {
      localVideoTrack.stopProcessor().catch(() => { });
      processorRef.current = null;
    }
  }, [isTeacher, cameraTrack, settings, processorRef]);

  return null;
}

/* ── RESILIENT MEDIA TRACK INITIALIZER ── */
function MediaTrackInitializer({
  initialCameraEnabled,
  initialMicEnabled,
  isWebinar,
  isTeacher,
}: {
  initialCameraEnabled: boolean;
  initialMicEnabled: boolean;
  isWebinar?: boolean;
  isTeacher: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!room || !localParticipant || hasInitializedRef.current) return;

    const initializeMedia = async () => {
      hasInitializedRef.current = true;
      // Allow browser and OS device drivers 250ms to cleanly cycle after lobby transition
      await new Promise((r) => setTimeout(r, 250));

      const canPublish = isTeacher || !isWebinar;
      if (!canPublish) return;

      // 1. Microphone Initialization
      if (initialMicEnabled && !localParticipant.isMicrophoneEnabled) {
        try {
          await localParticipant.setMicrophoneEnabled(true);
        } catch (err) {
          console.warn("MediaTrackInitializer mic auto-enable warning:", err);
        }
      }

      // 2. Camera Initialization with Tiered Resolution Fallback
      if (initialCameraEnabled && !localParticipant.isCameraEnabled) {
        try {
          await localParticipant.setCameraEnabled(true);
        } catch (err) {
          console.warn("MediaTrackInitializer primary camera failed, falling back to 360p/standard:", err);
          try {
            await localParticipant.setCameraEnabled(true, {
              resolution: VideoPresets.h360.resolution,
            });
          } catch (fallbackErr) {
            console.warn("MediaTrackInitializer fallback camera failed:", fallbackErr);
          }
        }
      }
    };

    if (room.state === "connected") {
      initializeMedia();
    } else {
      const handleConnected = () => {
        initializeMedia();
      };
      room.once("connected", handleConnected);
      return () => {
        room.off("connected", handleConnected);
      };
    }
  }, [room, localParticipant, initialCameraEnabled, initialMicEnabled, isWebinar, isTeacher]);

  return null;
}

export function LiveKitClassRoomV2({
  classId,
  roomId,
  identity,
  name,
  role,
  isWebinar = false,
  classTitle,
  subject,
  teacherName,
  backgroundImageUrl,
  onLeave,
}: LiveKitRoomV2Props) {
  // Pre-join Welcome Lobby State
  const [hasJoinedFromLobby, setHasJoinedFromLobby] = useState<boolean>(false);
  const [initialCameraEnabled, setInitialCameraEnabled] = useState<boolean>(true);
  const [initialMicEnabled, setInitialMicEnabled] = useState<boolean>(true);
  const [confirmedDisplayName, setConfirmedDisplayName] = useState<string>(name || "");

  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Classroom Mode: Camera Grid vs Presentation Slides vs Whiteboard
  const [stageMode, setStageMode] = useState<ClassroomStageMode>("grid");
  const [allowStudentSlideDraw, setAllowStudentSlideDraw] = useState<boolean>(false);
  const [allowStudentWhiteboardDraw, setAllowStudentWhiteboardDraw] = useState<boolean>(false);
  const [presentationKey, setPresentationKey] = useState<number>(0);

  const handleForceReloadPresentation = useCallback(() => {
    setPresentationKey((prev) => prev + 1);
  }, []);

  // Chat & Files Sidebar / Mobile Drawer State
  const [activeSidebarTab, setActiveSidebarTab] = useState<"chat" | "files">("chat");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Immersion Mode Activity Alert Toast
  const [recentActivityAlert, setRecentActivityAlert] = useState<{
    type: "chat" | "file";
    text: string;
    sender?: string;
    url?: string;
  } | null>(null);

  // Raised Hands Tracker with Names & Timestamps
  const [raisedHandsList, setRaisedHandsList] = useState<HandRaiseEntry[]>([]);
  const [showRaisedHandsPopover, setShowRaisedHandsPopover] = useState<boolean>(false);
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [recentHandRaiseAlert, setRecentHandRaiseAlert] = useState<{ name: string; identity: string } | null>(null);

  // Audience Mic Moderation (Presenter permission grant)
  const [allowedMics, setAllowedMics] = useState<Set<string>>(new Set());
  const [micAllowedByHost, setMicAllowedByHost] = useState<boolean>(false);
  const [hostAllowedMicToast, setHostAllowedMicToast] = useState<boolean>(false);

  // Auto-dismiss hand raise alert after 6 seconds
  useEffect(() => {
    if (!recentHandRaiseAlert) return;
    const timer = setTimeout(() => {
      setRecentHandRaiseAlert(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [recentHandRaiseAlert]);

  // Attendance & Attendee Roster
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [sessionAttendees, setSessionAttendees] = useState<Map<string, SessionAttendee>>(new Map());
  const [copiedHeaderWebinarLink, setCopiedHeaderWebinarLink] = useState(false);

  // Class & Teacher Controls
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [studioSettings, setStudioSettings] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [breakState, setBreakState] = useState<BreakState | null>(null);
  const [networkAlert, setNetworkAlert] = useState<string | null>(null);
  const [isUnexpectedDisconnect, setIsUnexpectedDisconnect] = useState<boolean>(false);

  // Refs
  const studioProcessorRef = useRef<StudioVideoProcessor | null>(null);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  chatMessagesRef.current = chatMessages;
  const activeTabRef = useRef<"chat" | "files">(activeSidebarTab);
  activeTabRef.current = activeSidebarTab;
  const breakStateRef = useRef<BreakState | null>(breakState);
  breakStateRef.current = breakState;

  const normalizedRole = (role || "").toUpperCase();
  const isTeacher =
    Boolean(tokenData?.isHost) ||
    Boolean((tokenData as any)?.role && ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN", "PRESENTER", "HOST", "SPEAKER", "INSTRUCTOR", "STAFF", "EDUCATOR", "MODERATOR", "CO_HOST"].includes(String((tokenData as any).role).toUpperCase())) ||
    ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN", "PRESENTER", "HOST", "SPEAKER", "INSTRUCTOR", "STAFF", "EDUCATOR", "MODERATOR", "CO_HOST"].includes(normalizedRole);
  const isImmersed = !isTeacher && stageMode !== "grid";

  // Toggle Audience Microphone Permission (Presenter -> Student)
  const toggleParticipantMic = useCallback(
    async (targetIdentity: string, enable: boolean) => {
      if (!isTeacher) return;
      try {
        setAllowedMics((prev) => {
          const next = new Set(prev);
          if (enable) next.add(targetIdentity);
          else next.delete(targetIdentity);
          return next;
        });

        const room = (window as any).__lk_room;
        if (room) {
          safePublishData(room, {
            type: enable ? "ALLOW_MIC" : "MUTE_STUDENT",
            identity: targetIdentity,
            allowed: enable,
          });
        }

        if (classId) {
          await fetchApi(`/live-class/${classId}/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: enable ? "UNMUTE_STUDENT" : "MUTE_STUDENT",
              targetIdentity,
              muted: !enable,
            }),
            silent: true,
          }).catch((err) => {
            console.warn("Backend mic moderation update error:", err?.message);
          });
        }
      } catch (err) {
        console.error("Failed to toggle mic permission:", err);
      }
    },
    [classId, isTeacher]
  );

  // High-Fidelity In-Browser Multi-Source Recording State
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "paused" | "saving">("idle");
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [remoteRecordingActive, setRemoteRecordingActive] = useState<boolean>(false);
  const [remoteRecordingPaused, setRemoteRecordingPaused] = useState<boolean>(false);
  const [finishedRecordingBlob, setFinishedRecordingBlob] = useState<Blob | null>(null);
  const [finishedRecordingDuration, setFinishedRecordingDuration] = useState<number>(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingMicStreamRef = useRef<MediaStream | null>(null);
  const recordingAudioCtxRef = useRef<AudioContext | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDurationRef = useRef<number>(0);
  recordingDurationRef.current = recordingDuration;

  // Recording Timer: ticks during "recording", freezes during "paused", stops when "idle"
  useEffect(() => {
    if (recordingStatus === "recording") {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [recordingStatus]);

  // Clean up recording tracks/timers on component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordingAudioCtxRef.current?.state !== "closed") {
        recordingAudioCtxRef.current?.close().catch(() => {});
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    // If browser does not support getDisplayMedia (mobile/tablets/iPads), use server-side cloud egress
    if (typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      if (classId) {
        try {
          setRecordingStatus("saving");
          const serverRes = await fetchApi<any>(`/live-class/${classId}/recording/server/start`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (serverRes?.success || serverRes?.egressId) {
            setRemoteRecordingActive(true);
            setRecordingStatus("recording");
            setRecordingDuration(0);
            const room = (window as any).__lk_room;
            safePublishData(room, {
              type: "RECORDING_STATE",
              isRecording: true,
              isPaused: false,
            });
            return;
          }
        } catch (serverErr: any) {
          console.warn("Server egress recording fallback failed:", serverErr?.message);
        }
      }
      alert("Screen recording is not supported on mobile browser tabs. Please use a desktop browser or enable cloud recording.");
      setRecordingStatus("idle");
      return;
    }

    try {
      setRecordingStatus("saving");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as any);

      recordingStreamRef.current = stream;

      let finalAudioTrack: MediaStreamTrack | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          recordingAudioCtxRef.current = audioCtx;
          const dest = audioCtx.createMediaStreamDestination();
          let hasAudioSource = false;

          // Capture system/tab audio
          if (stream.getAudioTracks().length > 0) {
            const displaySrc = audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
            displaySrc.connect(dest);
            hasAudioSource = true;
          }

          // Capture instructor/presenter microphone audio
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            recordingMicStreamRef.current = micStream;
            if (micStream.getAudioTracks().length > 0) {
              const micSrc = audioCtx.createMediaStreamSource(micStream);
              micSrc.connect(dest);
              hasAudioSource = true;
            }
          } catch (micErr) {
            console.warn("Could not attach presenter mic to recording:", micErr);
          }

          if (hasAudioSource && dest.stream.getAudioTracks().length > 0) {
            finalAudioTrack = dest.stream.getAudioTracks()[0];
          }
        }
      } catch (err) {
        console.warn("AudioContext mixing fallback for recording:", err);
      }

      const tracksToRecord = [
        ...stream.getVideoTracks(),
        ...(finalAudioTrack ? [finalAudioTrack] : stream.getAudioTracks()),
      ];
      const combinedStream = new MediaStream(tracksToRecord);

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
          mimeType = "video/webm;codecs=vp9,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
          mimeType = "video/webm;codecs=vp8,opus";
        } else if (MediaRecorder.isTypeSupported("video/webm")) {
          mimeType = "video/webm";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        }
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 1_200_000,
        audioBitsPerSecond: 96_000,
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, recorderOptions);
      } catch {
        recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
      }
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // The recording is assembled upon session end and presented in the upload/download dialog
        try {
          if (recordedChunksRef.current.length > 0) {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
            setFinishedRecordingBlob(blob);
            setFinishedRecordingDuration(recordingDurationRef.current || recordingDuration);
            setIsUploadModalOpen(true);
          }
        } catch (saveErr) {
          console.error("Failed to assemble recording blob:", saveErr);
        } finally {
          recordedChunksRef.current = [];
          setRecordingStatus("idle");
          setRecordingDuration(0);

          stream.getTracks().forEach((t) => t.stop());
          recordingMicStreamRef.current?.getTracks().forEach((t) => t.stop());
          recordingMicStreamRef.current = null;
          recordingStreamRef.current = null;
          if (recordingAudioCtxRef.current?.state !== "closed") {
            recordingAudioCtxRef.current?.close().catch(() => {});
          }
          recordingAudioCtxRef.current = null;

          const room = (window as any).__lk_room;
          safePublishData(room, {
            type: "RECORDING_STATE",
            isRecording: false,
            isPaused: false,
          });

          if (classId) {
            fetchApi(`/live-class/${classId}/recording/stop`, {
              method: "POST",
              body: JSON.stringify({}),
              silent: true,
            }).catch(() => {});
          }
        }
      };

      if (stream.getVideoTracks()[0]) {
        stream.getVideoTracks()[0].onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        };
      }

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingStatus("recording");
      setRecordingDuration(0);

      const room = (window as any).__lk_room;
      safePublishData(room, {
        type: "RECORDING_STATE",
        isRecording: true,
        isPaused: false,
      });

      if (classId) {
        fetchApi(`/live-class/${classId}/recording/start`, {
          method: "POST",
          silent: true,
        }).catch(() => {});
      }
    } catch (e: any) {
      console.warn("Screen recording start cancelled or failed:", e?.message);
      setRecordingStatus("idle");
    }
  }, [classTitle, isWebinar, classId]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
        setRecordingStatus("paused");
        const room = (window as any).__lk_room;
        safePublishData(room, {
          type: "RECORDING_STATE",
          isRecording: true,
          isPaused: true,
        });
      } catch (err) {
        console.error("Failed to pause recording:", err);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
        setRecordingStatus("recording");
        const room = (window as any).__lk_room;
        safePublishData(room, {
          type: "RECORDING_STATE",
          isRecording: true,
          isPaused: false,
        });
      } catch (err) {
        console.error("Failed to resume recording:", err);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        setRecordingStatus("saving");
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Failed to stop recording:", err);
        setRecordingStatus("idle");
      }
    } else if (remoteRecordingActive && classId) {
      try {
        setRecordingStatus("saving");
        fetchApi(`/live-class/${classId}/recording/server/stop`, {
          method: "POST",
          body: JSON.stringify({}),
          silent: true,
        }).catch(() => {});
      } finally {
        setRemoteRecordingActive(false);
        setRecordingStatus("idle");
        setRecordingDuration(0);
        const room = (window as any).__lk_room;
        safePublishData(room, {
          type: "RECORDING_STATE",
          isRecording: false,
          isPaused: false,
        });
      }
    }
  }, [remoteRecordingActive, classId]);

  // Auto-dismiss activity alert after 6 seconds
  useEffect(() => {
    if (!recentActivityAlert) return;
    const timer = setTimeout(() => {
      setRecentActivityAlert(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [recentActivityAlert]);

  const effectiveIdentity = useMemo(() => {
    if (identity && identity.trim().length > 0) return identity;
    const sessionSalt = Math.random().toString(36).slice(2, 7);
    return `user_${(name || "anon").replace(/[^a-zA-Z0-9]/g, "_")}_${sessionSalt}`;
  }, [identity, name]);

  // Fetch Token
  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let passToken =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("pass")
          : null;
      let regToken =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("regToken")
          : null;

      const targetPublicId = classId || roomId;
      let res: TokenResponse | null = null;
      const isStaff = ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN", "PRESENTER", "HOST"].includes(normalizedRole);

      // 1. Authenticated LMS token endpoint: ALWAYS attempted first for teachers/admins/staff
      if (isStaff || (!isWebinar && normalizedRole !== "PUBLIC_LEARNER")) {
        try {
          const query = new URLSearchParams({
            roomId: roomId || "",
            identity: effectiveIdentity,
            name: confirmedDisplayName || name || "",
            role: normalizedRole || "STUDENT",
          });
          if (classId) {
            query.set("classId", classId);
          }
          res = await fetchApi<TokenResponse>(
            `/live-class/token?${query.toString()}`
          );
          // When host/staff successfully authenticates, purge any stale attendee tokens from localStorage
          if (res && targetPublicId && (isStaff || res.isHost) && typeof window !== "undefined") {
            try {
              localStorage.removeItem(`live_access_${targetPublicId}`);
            } catch {}
          }
        } catch (authErr: any) {
          console.warn("Authenticated LMS token fetch failed:", authErr?.message);
        }
      }

      // 2. Fallback for public webinar attendees with signed registration credential (only if not staff)
      if (!res && targetPublicId && !isStaff) {
        let passToken =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("pass")
            : null;
        let regToken =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("regToken")
            : null;

        if (typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem(`live_access_${targetPublicId}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (!passToken && parsed?.passportToken) {
                passToken = parsed.passportToken;
              }
              if (!regToken && parsed?.registrationToken) {
                regToken = parsed.registrationToken;
              }
            }
          } catch {}
        }

        const credentialToTry = passToken || regToken;
        if (credentialToTry) {
          try {
            res = await fetchApi<TokenResponse>(
              `/live-class/public/${targetPublicId}/token?registrationToken=${encodeURIComponent(
                credentialToTry
              )}&name=${encodeURIComponent(confirmedDisplayName || name || "")}`
            );
          } catch (tokenErr: any) {
            console.warn("Public token validation with primary credential failed:", tokenErr?.message);
            if (passToken && regToken && passToken !== regToken) {
              try {
                res = await fetchApi<TokenResponse>(
                  `/live-class/public/${targetPublicId}/token?registrationToken=${encodeURIComponent(
                    regToken
                  )}&name=${encodeURIComponent(confirmedDisplayName || name || "")}`
                );
              } catch (fallbackErr: any) {
                console.warn("Public token validation with fallback regToken failed:", fallbackErr?.message);
              }
            }
          }
        }
      }

      if (!res) {
        if (isStaff) {
          throw new Error("Unable to authenticate your presenter session. Please ensure you are signed in to the LMS with teacher or admin permissions.");
        }
        if (isWebinar || normalizedRole === "PUBLIC_LEARNER") {
          throw new Error("Your webinar registration credential could not be verified (session expired or unconfirmed). Please register for free to get instant access.");
        }
        throw new Error("Unable to establish classroom security token. Please try entering the class again.");
      }

      setTokenData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load classroom security token");
    } finally {
      setLoading(false);
    }
  }, [classId, roomId, effectiveIdentity, confirmedDisplayName, name, normalizedRole, isWebinar, subject]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Fetch Pre-attached Files & Initial Chat History for this Live Class
  useEffect(() => {
    if (!classId) return;
    // Public webinar attendees do not have authenticated session cookies;
    // skip authenticated REST calls to prevent 401 errors in console.
    if (isWebinar || normalizedRole === "PUBLIC_LEARNER") return;

    fetchApi<any[]>(`/live-class/${classId}/files`, { silent: true })
      .then((files) => {
        if (Array.isArray(files)) {
          setSharedFiles(
            files.map((f) => ({
              name: f.name || f.fileName || "Class Attachment",
              url: f.url || f.fileUrl,
            }))
          );
        }
      })
      .catch(() => { });

    const reconcileChat = () => {
      fetchApi<any[]>(`/live-class/${classId}/messages`, { silent: true })
        .then((msgs) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            setChatMessages((prev) => {
              const existingKeys = new Set(prev.map((m) => `${m.sender}_${m.text}`));
              const toAdd: ChatMessage[] = [];
              for (const m of msgs) {
                const s = m.senderName || m.sender?.name || m.sender || "User";
                const t = m.message || m.content || m.text;
                if (!existingKeys.has(`${s}_${t}`)) {
                  toAdd.push({
                    id: m.id || Math.random().toString(36).slice(2, 9),
                    sender: s,
                    role: m.senderRole || m.role || "Student",
                    text: t,
                    timestamp: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  });
                }
              }
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
          }
        })
        .catch(() => {});
    };

    reconcileChat();
    const chatInterval = setInterval(reconcileChat, 5000);
    return () => clearInterval(chatInterval);
  }, [classId, isWebinar, normalizedRole]);

  // Host Periodic Stage Mode Heartbeat: ensures students who join late or switch tabs immediately sync to active stage
  useEffect(() => {
    if (!isTeacher) return;
    const interval = setInterval(() => {
      const room = (window as any).__lk_room;
      if (room && room.state === "connected") {
        safePublishData(room, {
          type: "STAGE_MODE_HEARTBEAT",
          mode: stageMode,
          allowStudentWhiteboardDraw,
          allowStudentSlideDraw,
        });
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isTeacher, stageMode, allowStudentWhiteboardDraw, allowStudentSlideDraw]);

  // Room Options - Configured for adaptive bandwidth, dynamic resolution & resilient multi-bitrate streaming
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true,
        stopMicTrackOnMute: false,
        videoCodec: "vp8",
      },
    }),
    []
  );

  const connectOptions: RoomConnectOptions = useMemo(
    () => ({
      autoSubscribe: true,
      peerConnectionTimeout: 30000,
      maxRetries: 5,
      rtcConfig: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    }),
    []
  );

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-3 bg-[#0b0c10] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-xs font-semibold text-white/70">Connecting to Virtual Classroom...</p>
      </div>
    );
  }

  if (error || !tokenData) {
    const isRegistrationError =
      !isTeacher && Boolean(error && /registration|credential|access denied|authentication/i.test(error));
    const webinarLandingId = classId || roomId;

    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-[#0b0c10] text-white p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle size={24} />
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-bold">Classroom Entry Failed</h3>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            {error || "Could not retrieve access credentials."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {webinarLandingId && isRegistrationError && (
            <a
              href={`/live/${encodeURIComponent(webinarLandingId)}`}
              onClick={() => {
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem(`live_access_${webinarLandingId}`);
                  } catch {}
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold shadow-lg text-white transition-all inline-flex items-center gap-2"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              Register & Join Free
            </a>
          )}
          {isTeacher && (
            <button
              onClick={() => fetchToken()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold shadow-lg text-white transition-all"
            >
              Retry Presenter Entry
            </button>
          )}
          <button
            onClick={fetchToken}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold shadow-md transition-colors"
          >
            Retry Connection
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white/80 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  // Welcome & Waiting Screen: Distinct Keynote Webinar Stage vs Interactive Classroom Tech Check
  if (!hasJoinedFromLobby) {
    if (isWebinar) {
      return (
        <WebinarWelcomeLobby
          webinarTitle={classTitle || "Public Webinar Masterclass"}
          subject={subject || "Keynote Webinar"}
          presenterName={teacherName || (isTeacher ? "Keynote Presenter" : "Educare Instructor")}
          initialName={confirmedDisplayName || name || (isTeacher ? "Keynote Presenter" : "Webinar Attendee")}
          isTeacher={isTeacher}
          classId={classId}
          backgroundImageUrl={backgroundImageUrl}
          onJoin={(settings) => {
            setConfirmedDisplayName(settings.name);
            setInitialCameraEnabled(settings.cameraEnabled);
            setInitialMicEnabled(settings.micEnabled);
            setHasJoinedFromLobby(true);
          }}
          onCancel={onLeave}
        />
      );
    }

    return (
      <PreJoinLobby
        classTitle={classTitle || "Edu-Meet Interactive Virtual Classroom"}
        subject={subject || "Live Cohort Session"}
        teacherName={teacherName || "Educare Instructor"}
        initialName={confirmedDisplayName || name || (isTeacher ? "Teacher" : "Student")}
        isTeacher={isTeacher}
        onJoin={(settings) => {
          setConfirmedDisplayName(settings.name);
          setInitialCameraEnabled(settings.cameraEnabled);
          setInitialMicEnabled(settings.micEnabled);
          setHasJoinedFromLobby(true);
        }}
        onCancel={onLeave}
      />
    );
  }

  return (
    <LiveKitRoom
      key={tokenData.token}
      token={tokenData.token}
      serverUrl={tokenData.wsUrl}
      connect={true}
      video={initialCameraEnabled}
      audio={initialMicEnabled}
      options={roomOptions}
      connectOptions={connectOptions}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.CLIENT_INITIATED) {
          onLeave();
        } else {
          setIsUnexpectedDisconnect(true);
        }
      }}
      className="h-[100dvh] w-full flex p-1.5 sm:p-2.5 md:p-3 gap-2 sm:gap-3 bg-[#08090d] text-slate-100 overflow-hidden select-none"
    >
      {/* Synchronization Engine */}
      <ClassroomV2Sync
        classId={classId}
        isTeacher={isTeacher}
        myIdentity={effectiveIdentity}
        stageMode={stageMode}
        setStageMode={setStageMode}
        setSharedFiles={setSharedFiles}
        setChatMessages={setChatMessages}
        chatMessagesRef={chatMessagesRef}
        activeTabRef={activeTabRef}
        setUnreadChatCount={setUnreadChatCount}
        allowStudentWhiteboardDraw={allowStudentWhiteboardDraw}
        setAllowStudentWhiteboardDraw={setAllowStudentWhiteboardDraw}
        allowStudentSlideDraw={allowStudentSlideDraw}
        setAllowStudentSlideDraw={setAllowStudentSlideDraw}
        setRaisedHandsList={setRaisedHandsList}
        setIsHandRaised={setIsHandRaised}
        setNetworkAlert={setNetworkAlert}
        breakStateRef={breakStateRef}
        setBreakState={setBreakState}
        onNewChatMessage={(msg: ChatMessage) => {
          const isChatActive = activeSidebarTab === "chat" && isRightPanelOpen && !isImmersed && (typeof window !== "undefined" && window.innerWidth >= 768);
          if (!isChatActive) {
            setRecentActivityAlert({
              type: "chat",
              text: msg.text,
              sender: msg.sender,
            });
          }
        }}
        onNewFileShared={(f: SharedFile) => {
          setRecentActivityAlert({
            type: "file",
            text: f.name,
            url: f.url,
          });
        }}
        onNewHandRaise={(name: string, identity: string) => {
          if (isTeacher) {
            playHandRaiseChime();
            setRecentHandRaiseAlert({ name, identity });
          }
        }}
        onUpdateAttendees={setSessionAttendees}
        setRemoteRecordingActive={setRemoteRecordingActive}
        setRemoteRecordingPaused={setRemoteRecordingPaused}
        setMicAllowedByHost={setMicAllowedByHost}
        setHostAllowedMicToast={setHostAllowedMicToast}
        setAllowedMics={setAllowedMics}
      />

      <StudioPipelineManager
        isTeacher={isTeacher}
        settings={studioSettings}
        processorRef={studioProcessorRef}
      />
      <MediaTrackInitializer
        initialCameraEnabled={initialCameraEnabled}
        initialMicEnabled={initialMicEnabled}
        isWebinar={isWebinar}
        isTeacher={isTeacher}
      />
      <RoomAudioRenderer />

      {/* Autoplay Audio Prompt */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
        <StartAudio
          label="🔊 Enable Audio"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3.5 rounded-full shadow-lg text-[11px] cursor-pointer"
        />
      </div>

      {/* Network Alert Notification */}
      {networkAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs shadow-xl backdrop-blur-md">
          <AlertCircle size={14} className="animate-pulse text-amber-400" />
          <span>{networkAlert}</span>
        </div>
      )}

      {/* ── 1. LEFT NAVIGATION SIDEBAR ── */}
      <aside className="w-14 sm:w-16 shrink-0 hidden md:flex flex-col items-center justify-between py-4 px-1.5 bg-[#12141c] border border-white/10 rounded-2xl md:rounded-3xl shadow-xl z-20 select-none">
        {/* App Logo */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={`h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
              isWebinar
                ? "bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 shadow-purple-500/20"
                : "bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 shadow-blue-500/20"
            }`}
            title="EduCare LMS Workspace"
          >
            {isWebinar ? <Globe size={20} /> : <Video size={20} />}
          </div>
        </div>

        {/* Middle Navigation Actions */}
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Stage Modes */}
          <button
            onClick={() => {
              setStageMode("grid");
              const room = (window as any).__lk_room;
              safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "grid" });
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
              stageMode === "grid"
                ? isWebinar
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title={isWebinar ? "Keynote Stage" : "Camera Grid View"}
          >
            <LayoutGrid size={18} />
            {stageMode === "grid" && (
              <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full" />
            )}
          </button>

          <button
            onClick={() => {
              setStageMode("slides");
              const room = (window as any).__lk_room;
              safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
              stageMode === "slides"
                ? isWebinar
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title="Interactive Slides Deck"
          >
            <Presentation size={18} />
            {sharedFiles.some((f) => f.url.toLowerCase().endsWith(".pdf")) && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5 ring-2 ring-[#12141c]" />
            )}
            {stageMode === "slides" && (
              <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full" />
            )}
          </button>

          <button
            onClick={() => {
              setStageMode("whiteboard");
              const room = (window as any).__lk_room;
              safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "whiteboard" });
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
              stageMode === "whiteboard"
                ? isWebinar
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
            title="Synchronized Whiteboard"
          >
            <PenTool size={18} />
            {stageMode === "whiteboard" && (
              <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full" />
            )}
          </button>

          <div className="w-8 h-px bg-white/10 my-1" />

          {/* Attendance / Attendee Roster */}
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-all relative"
            title={isWebinar ? "Webinar Attendee Roster" : "Class Attendance Roster"}
          >
            <Users size={18} />
            {sessionAttendees.size > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                {sessionAttendees.size}
              </span>
            )}
          </button>

          {/* Teacher Dedicated Tools */}
          {isTeacher && (
            <>
              {/* Raised Hands Trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowRaisedHandsPopover(!showRaisedHandsPopover)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
                    raisedHandsList.length > 0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                  title="Raised Hands Roster"
                >
                  <Hand size={18} />
                  {raisedHandsList.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                      {raisedHandsList.length}
                    </span>
                  )}
                </button>

                {/* Popover adjacent to Sidebar */}
                {showRaisedHandsPopover && (
                  <div className="absolute left-12 top-0 z-50 w-72 sm:w-80 rounded-2xl bg-[#141622]/98 border border-amber-500/40 shadow-2xl p-3 text-white backdrop-blur-xl animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Hand size={13} className={raisedHandsList.length > 0 ? "animate-bounce" : ""} />
                        </div>
                        <span className="text-xs font-bold text-amber-300">
                          Raised Hands ({raisedHandsList.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {raisedHandsList.length > 0 && (
                          <button
                            onClick={() => {
                              const room = (window as any).__lk_room;
                              safePublishData(room, { type: "LOWER_ALL_HANDS" });
                              setRaisedHandsList([]);
                              setRecentHandRaiseAlert(null);
                            }}
                            className="text-[10px] text-white/70 hover:text-white px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 font-semibold transition-colors"
                          >
                            Lower All
                          </button>
                        )}
                        <button
                          onClick={() => setShowRaisedHandsPopover(false)}
                          className="h-5 w-5 rounded-full flex items-center justify-center text-white/50 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {raisedHandsList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/40">
                        No students currently raising their hands.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {raisedHandsList.map((item) => (
                          <div
                            key={item.identity}
                            className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                              <span className="font-semibold text-white truncate max-w-[130px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleParticipantMic(item.identity, !allowedMics.has(item.identity))}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                                  allowedMics.has(item.identity)
                                    ? "bg-rose-500/25 text-rose-300 border-rose-500/40 hover:bg-rose-500/35"
                                    : "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35"
                                }`}
                              >
                                {allowedMics.has(item.identity) ? (
                                  <>
                                    <MicOff size={10} />
                                    <span>Mute</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={10} />
                                    <span>Allow Mic</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  const room = (window as any).__lk_room;
                                  safePublishData(room, {
                                    type: "LOWER_STUDENT_HAND",
                                    identity: item.identity,
                                  });
                                  setRaisedHandsList((prev) => prev.filter((h) => h.identity !== item.identity));
                                  if (recentHandRaiseAlert?.identity === item.identity) {
                                    setRecentHandRaiseAlert(null);
                                  }
                                }}
                                className="text-[10px] text-amber-300 hover:text-white font-bold px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                              >
                                Lower
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Studio Broadcasting Tools */}
              <button
                onClick={() => setIsStudioOpen(!isStudioOpen)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isStudioOpen ? "bg-white/15 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
                title="Studio Broadcasting Tools"
              >
                <SlidersHorizontal size={18} />
              </button>

              {/* Intermission Break Trigger */}
              <button
                onClick={() => {
                  const room = (window as any).__lk_room;
                  if (breakState?.isActive) {
                    safePublishData(room, { type: "BREAK_STATE", isActive: false });
                    setBreakState(null);
                  } else {
                    const now = Date.now();
                    const b: BreakState = {
                      isActive: true,
                      durationMinutes: 5,
                      startedAt: now,
                      endsAt: now + 5 * 60 * 1000,
                      mediaType: "BANNER",
                      mediaUrl: "",
                      title: "Short Class Break",
                      message: "Class will resume in 5 minutes",
                    };
                    safePublishData(room, { type: "BREAK_STATE", ...b });
                    setBreakState(b);
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  breakState?.isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
                title={breakState?.isActive ? "Resume Class" : "Start 5-min Break"}
              >
                <Clock size={18} />
              </button>
            </>
          )}
        </div>

        {/* User Profile Avatar at Bottom */}
        <div className="flex flex-col items-center">
          <div
            className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/20 flex items-center justify-center text-white font-bold text-xs shadow-md cursor-pointer group"
            title={`${confirmedDisplayName || name || "User"} (${isTeacher ? "Host/Teacher" : "Student"})`}
          >
            {(confirmedDisplayName || name || "U").charAt(0).toUpperCase()}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#12141c]" />
          </div>
        </div>
      </aside>

      {/* ── 2. CENTER LIVE MEETING AREA ── */}
      <main className="flex-1 min-w-0 flex flex-col bg-[#0e1017] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Meeting Header */}
        <header className="h-14 sm:h-16 shrink-0 bg-[#12141c]/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-5 flex items-center justify-between z-30">
          {/* Left: Meeting Title & Session Information */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-xs">
                  {classTitle || (isWebinar ? "Webinar Session" : "Edu-Meet Class")}
                </h2>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                    isTeacher
                      ? isWebinar
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-blue-500/20 border-blue-500/40 text-blue-300"
                      : isWebinar
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {isTeacher
                    ? isWebinar
                      ? "Keynote Presenter"
                      : "Teacher"
                    : isWebinar
                    ? "Audience"
                    : "Student"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-white/40 hidden sm:block truncate max-w-[160px]">
                  {subject || (isWebinar ? "Public Webinar Broadcast" : "HD Interactive Lecture")}
                </p>

                {/* Recording Status & Duration Badge */}
                {(recordingStatus === "recording" || remoteRecordingActive) && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span>REC {formatRecordingDuration(recordingDuration)}</span>
                  </div>
                )}
                {(recordingStatus === "paused" || remoteRecordingPaused) && !(recordingStatus === "recording" || remoteRecordingActive) && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                    <Pause size={10} className="text-amber-400" />
                    <span>REC PAUSED</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Meeting Actions & Quick Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Stage Switcher Pills (Teacher) */}
            {isTeacher ? (
              <div className="hidden sm:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => {
                    setStageMode("grid");
                    const room = (window as any).__lk_room;
                    safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "grid" });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    stageMode === "grid"
                      ? isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>{isWebinar ? "Stage" : "Camera"}</span>
                </button>

                <button
                  onClick={() => {
                    setStageMode("slides");
                    const room = (window as any).__lk_room;
                    safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all relative ${
                    stageMode === "slides"
                      ? isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Presentation size={13} />
                  <span>Slides</span>
                  {sharedFiles.some((f) => f.url.toLowerCase().endsWith(".pdf")) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
                  )}
                </button>

                <button
                  onClick={() => {
                    setStageMode("whiteboard");
                    const room = (window as any).__lk_room;
                    safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "whiteboard" });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    stageMode === "whiteboard"
                      ? isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <PenTool size={13} />
                  <span>Board</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white/80">
                {stageMode === "grid" && <LayoutGrid size={13} className="text-emerald-400" />}
                {stageMode === "slides" && <Presentation size={13} className="text-blue-400 animate-pulse" />}
                {stageMode === "whiteboard" && <PenTool size={13} className="text-purple-400 animate-pulse" />}
                <span>{stageMode === "grid" ? "Camera View" : stageMode === "slides" ? "Slides View" : "Whiteboard"}</span>
              </div>
            )}

            {/* Public Webinar Share Link */}
            {isWebinar && classId && (
              <button
                onClick={() => {
                  const publicUrl = `${window.location.origin}/live/${classId}`;
                  navigator.clipboard.writeText(publicUrl);
                  setCopiedHeaderWebinarLink(true);
                  setTimeout(() => setCopiedHeaderWebinarLink(false), 2000);
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  copiedHeaderWebinarLink
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                    : "border-purple-500/40 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                }`}
                title="Copy Public Webinar Share Link"
              >
                {copiedHeaderWebinarLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span className="hidden sm:inline">{copiedHeaderWebinarLink ? "Copied!" : "Share"}</span>
              </button>
            )}

            {/* Whiteboard Permission Toggle */}
            {isTeacher && stageMode === "whiteboard" && (
              <button
                onClick={() => {
                  const nextVal = !allowStudentWhiteboardDraw;
                  setAllowStudentWhiteboardDraw(nextVal);
                  const room = (window as any).__lk_room;
                  safePublishData(room, {
                    type: "WHITEBOARD_PERMISSION",
                    allowStudentDraw: nextVal,
                  });
                }}
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  allowStudentWhiteboardDraw
                    ? "bg-purple-600/25 border-purple-500/50 text-purple-300"
                    : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                }`}
                title="Toggle whether students can draw on whiteboard"
              >
                <PenTool size={13} />
                <span>Draw: {allowStudentWhiteboardDraw ? "Everyone" : "Teacher"}</span>
              </button>
            )}

            {/* Mute All Students (Teacher) */}
            {isTeacher && (
              <button
                onClick={() => {
                  const room = (window as any).__lk_room;
                  safePublishData(room, { type: "MUTE_ALL" });
                  if (classId) {
                    fetchApi(`/live-class/${classId}/moderate`, {
                      method: "POST",
                      body: JSON.stringify({ action: "MUTE_ALL" }),
                      silent: true,
                    }).catch(() => { });
                  }
                }}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Mute All Students"
              >
                <MicOff size={14} />
                <span className="hidden xl:inline">Mute All</span>
              </button>
            )}

            {/* Attendance Roster (Teacher - accessible on mobile/tablet too) */}
            {isTeacher && (
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="View Attendance & Registrations"
              >
                <Users size={14} />
                <span className="hidden sm:inline">Roster</span>
                {sessionAttendees.size > 0 && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {sessionAttendees.size}
                  </span>
                )}
              </button>
            )}

            {/* Raised Hands Trigger & Popover in Header (Teacher) */}
            {isTeacher && (
              <div className="relative">
                <button
                  onClick={() => setShowRaisedHandsPopover(!showRaisedHandsPopover)}
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    raisedHandsList.length > 0
                      ? "border-amber-500/60 bg-amber-500/25 text-amber-300 animate-pulse shadow-lg shadow-amber-500/20"
                      : "border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                  }`}
                  title="View Raised Hands"
                >
                  <Hand size={14} className={raisedHandsList.length > 0 ? "animate-bounce text-amber-400" : ""} />
                  <span className="hidden sm:inline">Hands</span>
                  {raisedHandsList.length > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                      {raisedHandsList.length}
                    </span>
                  )}
                </button>

                {showRaisedHandsPopover && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#141622]/98 border border-amber-500/40 shadow-2xl p-3 z-50 text-white backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Hand size={13} className={raisedHandsList.length > 0 ? "animate-bounce" : ""} />
                        </div>
                        <span className="text-xs font-bold text-amber-300">
                          Raised Hands ({raisedHandsList.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {raisedHandsList.length > 0 && (
                          <button
                            onClick={() => {
                              const room = (window as any).__lk_room;
                              safePublishData(room, { type: "LOWER_ALL_HANDS" });
                              setRaisedHandsList([]);
                              setRecentHandRaiseAlert(null);
                            }}
                            className="text-[10px] text-white/70 hover:text-white px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 font-semibold transition-colors"
                          >
                            Lower All
                          </button>
                        )}
                        <button
                          onClick={() => setShowRaisedHandsPopover(false)}
                          className="h-5 w-5 rounded-full flex items-center justify-center text-white/50 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {raisedHandsList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/40">
                        No students currently raising their hands.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {raisedHandsList.map((item) => (
                          <div
                            key={item.identity}
                            className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                              <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-[160px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleParticipantMic(item.identity, !allowedMics.has(item.identity))}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                                  allowedMics.has(item.identity)
                                    ? "bg-rose-500/25 text-rose-300 border-rose-500/40 hover:bg-rose-500/35"
                                    : "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35"
                                }`}
                              >
                                {allowedMics.has(item.identity) ? (
                                  <>
                                    <MicOff size={10} />
                                    <span>Mute</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={10} />
                                    <span>Allow Mic</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  const room = (window as any).__lk_room;
                                  safePublishData(room, {
                                    type: "LOWER_STUDENT_HAND",
                                    identity: item.identity,
                                  });
                                  setRaisedHandsList((prev) => prev.filter((h) => h.identity !== item.identity));
                                  if (recentHandRaiseAlert?.identity === item.identity) {
                                    setRecentHandRaiseAlert(null);
                                  }
                                }}
                                className="text-[10px] text-amber-300 hover:text-white font-bold px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                              >
                                Lower
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Chat Panel Toggle */}
            {!isImmersed && (
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setIsRightPanelOpen((prev) => !prev);
                  }
                }}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isRightPanelOpen
                    ? "border-blue-500/40 bg-blue-500/20 text-blue-300"
                    : "border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white"
                }`}
                title={isRightPanelOpen ? "Collapse Chat Panel" : "Expand Chat Panel"}
              >
                <MessageSquare size={14} />
                <span className="hidden sm:inline">Messages</span>
                {unreadChatCount > 0 && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {/* ── MAIN VIDEO / STAGE CONTENT AREA ── */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-[#0a0b10]">
          {/* Mode 1: Camera Grid / Speaker Stage */}
          <div className={`h-full w-full ${stageMode === "grid" ? "block" : "hidden"}`}>
            <V2ClassVideoGrid
              isTeacher={isTeacher}
              classId={classId}
              isWebinar={isWebinar}
              raisedHands={new Set(raisedHandsList.map((h) => h.identity))}
              raisedHandsList={raisedHandsList}
              onLowerHand={(identity) => {
                const room = (window as any).__lk_room;
                safePublishData(room, {
                  type: "LOWER_STUDENT_HAND",
                  identity,
                });
                setRaisedHandsList((prev) => prev.filter((h) => h.identity !== identity));
              }}
              onToggleMic={toggleParticipantMic}
              allowedMics={allowedMics}
            />
          </div>

          {/* Mode 2: Interactive Slides Deck */}
          <div className={`h-full w-full relative ${stageMode === "slides" ? "block" : "hidden"}`}>
            <PresentationErrorBoundary onReset={handleForceReloadPresentation}>
              <PresentationDeck
                key={`pres-deck-instance-${presentationKey}`}
                isTeacher={isTeacher}
                classId={classId}
                room={(window as any).__lk_room}
                myIdentity={effectiveIdentity}
                myName={confirmedDisplayName || name || "Participant"}
                initialFiles={sharedFiles}
                allowStudentDraw={allowStudentSlideDraw}
                onToggleStudentDraw={setAllowStudentSlideDraw}
                onForceReload={handleForceReloadPresentation}
              />
            </PresentationErrorBoundary>
            <FloatingCamPiP isTeacher={isTeacher} stageMode="slides" defaultCorner="top-right" />
          </div>

          {/* Mode 3: Synchronized Whiteboard */}
          <div className={`h-full w-full relative bg-white ${stageMode === "whiteboard" ? "block" : "hidden"}`}>
            <SynchronizedWhiteboard
              isTeacher={isTeacher}
              allowStudentDraw={allowStudentWhiteboardDraw}
              room={(window as any).__lk_room}
              classId={classId}
            />
            <FloatingCamPiP isTeacher={isTeacher} stageMode="whiteboard" defaultCorner="bottom-right" />
          </div>

          {/* Teacher Raised Hands Panel */}
          {isTeacher && raisedHandsList.length > 0 && (
            <div className="absolute top-16 left-4 z-40 max-w-xs sm:max-w-sm rounded-2xl bg-[#141620]/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl p-3 text-white pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-amber-500/25 text-amber-400 flex items-center justify-center">
                    <Hand size={14} className="animate-bounce" />
                  </div>
                  <span className="text-xs font-bold text-amber-300">
                    Raised Hands ({raisedHandsList.length})
                  </span>
                </div>
                <button
                  onClick={() => {
                    const room = (window as any).__lk_room;
                    safePublishData(room, { type: "LOWER_ALL_HANDS" });
                    setRaisedHandsList([]);
                    setRecentHandRaiseAlert(null);
                  }}
                  className="text-[10px] text-white/60 hover:text-white px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/15 font-semibold transition-colors cursor-pointer"
                >
                  Lower All
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {raisedHandsList.map((item) => (
                  <div
                    key={item.identity}
                    className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                      <span className="font-semibold text-white truncate max-w-[150px] sm:max-w-[190px]" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleParticipantMic(item.identity, !allowedMics.has(item.identity))}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${allowedMics.has(item.identity)
                          ? "bg-rose-500/25 text-rose-300 border-rose-500/40 hover:bg-rose-500/35"
                          : "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35"
                        }`}
                        title={allowedMics.has(item.identity) ? "Turn Off Microphone" : "Turn On Microphone"}
                      >
                        {allowedMics.has(item.identity) ? (
                          <>
                            <MicOff size={11} />
                            <span>Mute</span>
                          </>
                        ) : (
                          <>
                            <Mic size={11} />
                            <span>Allow Mic</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const room = (window as any).__lk_room;
                          safePublishData(room, {
                            type: "LOWER_STUDENT_HAND",
                            identity: item.identity,
                          });
                          setRaisedHandsList((prev) => prev.filter((h) => h.identity !== item.identity));
                          if (recentHandRaiseAlert?.identity === item.identity) {
                            setRecentHandRaiseAlert(null);
                          }
                        }}
                        className="text-[10px] text-amber-300 hover:text-white font-bold px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                      >
                        Lower Hand
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Raised Hand Instant Notification Toast */}
          {isTeacher && recentHandRaiseAlert && (
            <div className="absolute top-16 right-4 sm:right-6 z-50 max-w-sm animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto">
              <div className="p-3 rounded-2xl bg-[#1d150b]/95 border border-amber-500/60 shadow-2xl backdrop-blur-md flex items-center gap-3 text-white">
                <div className="h-9 w-9 rounded-xl bg-amber-500/25 text-amber-300 flex items-center justify-center shrink-0">
                  <Hand size={18} className="animate-bounce text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Hand Raised</p>
                  <p className="text-xs font-semibold text-white truncate">{recentHandRaiseAlert.name}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      const room = (window as any).__lk_room;
                      safePublishData(room, {
                        type: "LOWER_STUDENT_HAND",
                        identity: recentHandRaiseAlert.identity,
                      });
                      setRaisedHandsList((prev) => prev.filter((h) => h.identity !== recentHandRaiseAlert.identity));
                      setRecentHandRaiseAlert(null);
                    }}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold cursor-pointer"
                  >
                    Lower
                  </button>
                  <button onClick={() => setRecentHandRaiseAlert(null)} className="text-white/40 hover:text-white p-1">
                    <X size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Activity Toast (Chat & Files) */}
          {recentActivityAlert && (
            <div className="absolute bottom-24 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
              <div className="p-3 rounded-2xl bg-[#141622]/95 border border-blue-500/40 shadow-2xl backdrop-blur-md flex items-start gap-3 text-white">
                <div className="h-8 w-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  {recentActivityAlert.type === "chat" ? <MessageSquare size={16} /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-blue-300 truncate">
                      {recentActivityAlert.type === "chat" ? recentActivityAlert.sender : "New Attachment"}
                    </span>
                    <button
                      onClick={() => setRecentActivityAlert(null)}
                      className="text-white/40 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-white/90 truncate mt-0.5">{recentActivityAlert.text}</p>
                  {recentActivityAlert.type === "chat" ? (
                    <button
                      onClick={() => {
                        setIsRightPanelOpen(true);
                        setIsMobileSheetOpen(true);
                        setActiveSidebarTab("chat");
                        setRecentActivityAlert(null);
                      }}
                      className="mt-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      Open Chat <ChevronRight size={12} />
                    </button>
                  ) : (
                    <a
                      href={recentActivityAlert.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <FileDown size={12} /> Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Break / Intermission Overlay */}
          {breakState?.isActive && (
            <IntermissionStage
              breakState={breakState}
              isTeacher={isTeacher}
              onEndBreak={() => {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "BREAK_STATE", isActive: false });
                setBreakState(null);
              }}
              onExtendBreak={(mins) => {
                const room = (window as any).__lk_room;
                const updated = {
                  ...breakState,
                  endsAt: Math.max(Date.now(), breakState.endsAt) + mins * 60 * 1000,
                  durationMinutes: breakState.durationMinutes + mins,
                };
                safePublishData(room, { type: "BREAK_STATE", ...updated });
                setBreakState(updated);
              }}
            />
          )}

          {/* Teacher Studio Drawer */}
          {isTeacher && (
            <StudioDrawer
              isOpen={isStudioOpen}
              onClose={() => setIsStudioOpen(false)}
              room={(window as any).__lk_room}
              settings={studioSettings}
              onUpdateSettings={setStudioSettings}
              breakState={breakState}
              onStartBreak={(state) => {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "BREAK_STATE", ...state });
                setBreakState(state);
              }}
              onEndBreak={() => {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "BREAK_STATE", isActive: false });
                setBreakState(null);
              }}
              onExtendBreak={(mins) => {
                const room = (window as any).__lk_room;
                if (!breakState) return;
                const updated = {
                  ...breakState,
                  endsAt: Math.max(Date.now(), breakState.endsAt) + mins * 60 * 1000,
                  durationMinutes: breakState.durationMinutes + mins,
                };
                safePublishData(room, { type: "BREAK_STATE", ...updated });
                setBreakState(updated);
              }}
            />
          )}
        </div>

        {/* ── MEETING CONTROL BAR (POSITIONED DIRECTLY BELOW PARTICIPANT STRIP) ── */}
        <V2BottomControlDock
          isTeacher={isTeacher}
          isWebinar={isWebinar}
          micAllowedByHost={micAllowedByHost}
          isImmersed={isImmersed}
          isHandRaised={isHandRaised}
          unreadChatCount={unreadChatCount}
          isRightPanelOpen={isRightPanelOpen}
          recordingStatus={recordingStatus}
          recordingDuration={recordingDuration}
          onStartRecording={startRecording}
          onPauseRecording={pauseRecording}
          onResumeRecording={resumeRecording}
          onStopRecording={stopRecording}
          onToggleHand={(activeRoom?: any) => {
            const room = activeRoom || (window as any).__lk_room;
            const currentId = room?.localParticipant?.identity || effectiveIdentity;
            const currentName = room?.localParticipant?.name || confirmedDisplayName || name || "Student";
            const next = !isHandRaised;
            setIsHandRaised(next);
            safePublishData(room, {
              type: "HAND_RAISE",
              identity: currentId,
              name: currentName,
              raised: next,
              raisedAt: Date.now(),
            });
            setRaisedHandsList((prev) => {
              if (next) {
                const existing = prev.find((h) => h.identity === currentId);
                if (existing) return prev;
                return [...prev, { identity: currentId, name: currentName, raisedAt: Date.now() }];
              } else {
                return prev.filter((h) => h.identity !== currentId);
              }
            });
          }}
          onToggleChat={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setIsMobileSheetOpen(true);
            } else {
              setIsRightPanelOpen((prev) => !prev);
            }
            setUnreadChatCount(0);
          }}
          onLeave={onLeave}
        />
      </main>

      {/* ── 3. RIGHT LIVE CHAT & ATTACHMENTS PANEL ── */}
      {!isImmersed && isRightPanelOpen && (
        <aside className="w-80 lg:w-88 shrink-0 hidden md:flex flex-col bg-[#12141c] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl z-20">
          <div className="flex items-center justify-between border-b border-white/10 shrink-0 px-3 py-2 bg-black/20">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveSidebarTab("chat");
                  setUnreadChatCount(0);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeSidebarTab === "chat"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <MessageSquare size={13} />
                <span>Messages</span>
                {unreadChatCount > 0 && activeSidebarTab !== "chat" && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSidebarTab("files")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  activeSidebarTab === "files"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <FileText size={13} />
                <span>Files</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/10 text-white/70">
                  {sharedFiles.length}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsRightPanelOpen(false)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Collapse chat panel"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeSidebarTab === "chat" ? (
              <ChatContentPanel
                messages={chatMessages}
                currentUserName={confirmedDisplayName || name || "Anonymous"}
                onSendMessage={(text) => {
                  const room = (window as any).__lk_room;
                  const newMsg: ChatMessage = {
                    id: Math.random().toString(36).slice(2, 9),
                    sender: confirmedDisplayName || name || "Anonymous",
                    role: isTeacher ? "Teacher" : "Student",
                    text,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  };
                  safePublishData(room, { type: "CHAT_MESSAGE", ...newMsg });
                  setChatMessages((prev) => [...prev, newMsg]);

                  if (classId) {
                    fetchApi(`/live-class/${classId}/messages`, {
                      method: "POST",
                      body: JSON.stringify({ message: text }),
                      silent: true,
                    }).catch(() => { });
                  }
                }}
              />
            ) : (
              <FilesContentPanel
                sharedFiles={sharedFiles}
                isTeacher={isTeacher}
                classId={classId}
                room={(window as any).__lk_room}
                onFileUploaded={(newFile) => {
                  setSharedFiles((prev) => [...prev, newFile]);
                }}
                onOpenAsSlides={() => {
                  setStageMode("slides");
                  const room = (window as any).__lk_room;
                  safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
                }}
                onDeleteFile={(url) => {
                  setSharedFiles((prev) => prev.filter((f) => f.url !== url));
                }}
              />
            )}
          </div>
        </aside>
      )}

      {/* ── MOBILE BOTTOM SHEET FOR CHAT & FILES ── */}
      <MobileSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title={activeSidebarTab === "chat" ? "Live Discussion" : "Class Attachments"}
        badge={activeSidebarTab === "chat" ? chatMessages.length : sharedFiles.length}
      >
        <div className="flex items-center border-b border-white/10 px-3 bg-black/20 shrink-0">
          <button
            onClick={() => setActiveSidebarTab("chat")}
            className={`flex-1 py-2 text-xs font-bold border-b-2 text-center ${
              activeSidebarTab === "chat" ? "border-blue-500 text-white" : "border-transparent text-white/50"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveSidebarTab("files")}
            className={`flex-1 py-2 text-xs font-bold border-b-2 text-center ${
              activeSidebarTab === "files" ? "border-blue-500 text-white" : "border-transparent text-white/50"
            }`}
          >
            Files ({sharedFiles.length})
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeSidebarTab === "chat" ? (
            <ChatContentPanel
              messages={chatMessages}
              currentUserName={confirmedDisplayName || name || "Anonymous"}
              onSendMessage={(text) => {
                const room = (window as any).__lk_room;
                const newMsg: ChatMessage = {
                  id: Math.random().toString(36).slice(2, 9),
                  sender: confirmedDisplayName || name || "Anonymous",
                  role: isTeacher ? "Teacher" : "Student",
                  text,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                };
                safePublishData(room, { type: "CHAT_MESSAGE", ...newMsg });
                setChatMessages((prev) => [...prev, newMsg]);

                if (classId) {
                  fetchApi(`/live-class/${classId}/messages`, {
                    method: "POST",
                    body: JSON.stringify({ message: text }),
                    silent: true,
                  }).catch(() => { });
                }
              }}
            />
          ) : (
            <FilesContentPanel
              sharedFiles={sharedFiles}
              isTeacher={isTeacher}
              classId={classId}
              room={(window as any).__lk_room}
              onFileUploaded={(newFile) => {
                setSharedFiles((prev) => [...prev, newFile]);
              }}
              onOpenAsSlides={() => {
                setStageMode("slides");
                setIsMobileSheetOpen(false);
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
              }}
              onDeleteFile={(url) => {
                setSharedFiles((prev) => prev.filter((f) => f.url !== url));
              }}
            />
          )}
        </div>
      </MobileSheet>

      {/* ── ATTENDANCE & ATTENDEE ROSTER MODAL ── */}
      {showAttendanceModal && (
        <AttendanceRosterModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          classId={classId}
          sessionAttendees={sessionAttendees}
          defaultTab={isWebinar ? "webinar" : "live"}
          isTeacher={isTeacher}
          allowedMics={allowedMics}
          onToggleMic={toggleParticipantMic}
          raisedHands={new Set(raisedHandsList.map((h) => h.identity))}
        />
      )}

      {/* ── RECORDING COMPRESSION & CLOUD UPLOAD MODAL ── */}
      {isUploadModalOpen && finishedRecordingBlob && (
        <RecordingUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setFinishedRecordingBlob(null);
          }}
          videoBlob={finishedRecordingBlob}
          classId={classId}
          classTitle={classTitle || (isWebinar ? "Webinar Session" : "Live Class")}
          durationSeconds={finishedRecordingDuration}
        />
      )}

      {/* Presenter Turned On Mic Toast Notification */}
      {hostAllowedMicToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 pointer-events-auto">
          <span className="p-1 rounded-full bg-white/20">
            <Mic size={14} />
          </span>
          <span>The presenter has enabled your microphone! You can now unmute and speak to the session.</span>
          <button
            onClick={() => setHostAllowedMicToast(false)}
            className="ml-2 p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </LiveKitRoom>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE & ATTENDEE ROSTER MODAL
// ─────────────────────────────────────────────────────────────────────────────
function AttendanceRosterModal({
  isOpen,
  onClose,
  classId,
  sessionAttendees,
  defaultTab = "live",
  isTeacher = false,
  allowedMics,
  onToggleMic,
  raisedHands,
}: {
  isOpen: boolean;
  onClose: () => void;
  classId?: string;
  sessionAttendees: Map<string, SessionAttendee>;
  defaultTab?: "live" | "webinar";
  isTeacher?: boolean;
  allowedMics?: Set<string>;
  onToggleMic?: (identity: string, enable: boolean) => void;
  raisedHands?: Set<string>;
}) {
  const [tab, setTab] = useState<"live" | "webinar">(defaultTab);
  const [search, setSearch] = useState("");
  const [webinarRegistrations, setWebinarRegistrations] = useState<any[]>([]);
  const [loadingWebinar, setLoadingWebinar] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (tab === "webinar" && classId) {
      setLoadingWebinar(true);
      fetchApi<any>(`/live-class/${classId}/registrations`)
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.registrations || []);
          setWebinarRegistrations(list);
        })
        .catch(() => setWebinarRegistrations([]))
        .finally(() => setLoadingWebinar(false));
    }
  }, [tab, classId]);

  const attendeesArray = useMemo(() => Array.from(sessionAttendees.values()), [sessionAttendees]);

  const filteredLive = useMemo(() => {
    if (!search.trim()) return attendeesArray;
    const q = search.toLowerCase();
    return attendeesArray.filter(
      (a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
    );
  }, [attendeesArray, search]);

  const filteredWebinar = useMemo(() => {
    if (!search.trim()) return webinarRegistrations;
    const q = search.toLowerCase();
    return webinarRegistrations.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.parentName || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.courseOrClass || "").toLowerCase().includes(q) ||
        (r.organization || "").toLowerCase().includes(q)
    );
  }, [webinarRegistrations, search]);

  const exportLiveCSV = () => {
    const headers = ["Participant Name", "Role", "First Joined At", "Current Status"];
    const rows = attendeesArray.map((a) => [
      `"${a.name}"`,
      `"${a.role}"`,
      `"${a.firstJoinedAt}"`,
      `"${a.isOnline ? "Active" : "Left"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `live_attendance_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportWebinarCSV = () => {
    const headers = ["Student Name", "Parent Name", "Contact", "Email", "Class/Course", "Institute", "Registered At"];
    const rows = webinarRegistrations.map((r) => [
      `"${r.name || ""}"`,
      `"${r.parentName || ""}"`,
      `"${r.phone || ""}"`,
      `"${r.email || ""}"`,
      `"${r.courseOrClass || ""}"`,
      `"${r.organization || ""}"`,
      `"${new Date(r.registeredAt || Date.now()).toLocaleString()}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `webinar_registrations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 safe-area-x safe-area-b">
      <div className="w-full max-w-3xl rounded-2xl sm:rounded-3xl bg-[#141620] border border-white/10 shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Class Attendance & Registrations</h3>
              <p className="text-xs text-white/50">Real-time attendee telemetry and webinar roster</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setTab("live")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${tab === "live"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white/5 text-white/60 hover:text-white"
                }`}
            >
              Live Session Attendees ({attendeesArray.length})
            </button>
            {classId && (
              <button
                onClick={() => setTab("webinar")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${tab === "webinar"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white/5 text-white/60 hover:text-white"
                  }`}
              >
                Webinar Registrations ({webinarRegistrations.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search attendee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={tab === "live" ? exportLiveCSV : exportWebinarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors shrink-0"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Public Webinar Share Link Bar */}
        {classId && (
          <div className="px-5 py-3 bg-purple-950/40 border-b border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Globe size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-white block">Public Webinar Registration Link</span>
                <span className="text-[11px] font-mono text-purple-300 truncate block">
                  {typeof window !== "undefined" ? `${window.location.origin}/live/${classId}` : `/live/${classId}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/live/${classId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
              <a
                href={`/live/${classId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors"
              >
                <ExternalLink size={13} />
                <span>Open Page</span>
              </a>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "live" ? (
            filteredLive.length === 0 ? (
              <div className="py-12 text-center text-xs text-white/40">No attendees match your query.</div>
            ) : (
              <table className="w-full text-left text-xs text-white/80">
                <thead className="text-[10px] uppercase text-white/40 border-b border-white/10 bg-white/[0.02]">
                  <tr>
                    <th className="py-2.5 px-3">Participant Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">First Joined</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    {isTeacher && <th className="py-2.5 px-3 text-right">Microphone</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLive.map((a) => (
                    <tr key={a.identity} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{a.name}</span>
                          {raisedHands?.has(a.identity) && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold inline-flex items-center gap-1 animate-bounce">
                              <Hand size={11} /> Hand Raised
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${a.role === "TEACHER" || a.role === "SUPER_ADMIN"
                              ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                            }`}
                        >
                          {a.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white/50">{a.firstJoinedAt}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${a.isOnline
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/10 text-white/40"
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${a.isOnline ? "bg-emerald-400 animate-pulse" : "bg-white/30"
                              }`}
                          />
                          {a.isOnline ? "Online" : "Left"}
                        </span>
                      </td>
                      {isTeacher && (
                        <td className="py-3 px-3 text-right">
                          {["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN", "PRESENTER"].includes(a.role) ? (
                            <span className="text-[10px] text-white/40 font-medium">Presenter</span>
                          ) : !a.isOnline ? (
                            <span className="text-[10px] text-white/30">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleMic?.(a.identity, !allowedMics?.has(a.identity))}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${allowedMics?.has(a.identity)
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                              }`}
                            >
                              {allowedMics?.has(a.identity) ? (
                                <>
                                  <MicOff size={11} />
                                  <span>Turn Off Mic</span>
                                </>
                              ) : (
                                <>
                                  <Mic size={11} />
                                  <span>Turn On Mic</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : loadingWebinar ? (
            <div className="py-12 flex justify-center items-center text-xs text-white/50 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              Loading registration roster...
            </div>
          ) : filteredWebinar.length === 0 ? (
            <div className="py-12 text-center text-xs text-white/40">No registered webinar attendees found.</div>
          ) : (
            <table className="w-full text-left text-xs text-white/80">
              <thead className="text-[10px] uppercase text-white/40 border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Parent Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Course/Class</th>
                  <th className="py-2.5 px-3">Institute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWebinar.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">{r.name}</td>
                    <td className="py-3 px-3 text-white/70">{r.parentName || "—"}</td>
                    <td className="py-3 px-3 text-white/70">{r.phone || "—"}</td>
                    <td className="py-3 px-3 text-white/70">{r.email || "—"}</td>
                    <td className="py-3 px-3 text-white/70">{r.courseOrClass || "—"}</td>
                    <td className="py-3 px-3 text-white/70">{r.organization || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO GRID COMPONENT WITH RESPONSIVE SPOTLIGHT
// ─────────────────────────────────────────────────────────────────────────────
// VIDEO GRID / STAGE PRESENTATION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function V2ClassVideoGrid({
  isTeacher,
  classId,
  isWebinar = false,
  raisedHands,
  raisedHandsList = [],
  onLowerHand,
  onToggleMic,
  allowedMics,
}: {
  isTeacher: boolean;
  classId?: string;
  isWebinar?: boolean;
  raisedHands: Set<string>;
  raisedHandsList?: HandRaiseEntry[];
  onLowerHand?: (identity: string) => void;
  onToggleMic?: (identity: string, enable: boolean) => void;
  allowedMics?: Set<string>;
}) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare && t.participant);
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera && t.participant);

  // Deduplicate per participant
  const uniqueCameras = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    for (const t of cameraTracks) {
      const id = t.participant?.identity;
      if (!id) continue;
      const prev = map.get(id);
      if (!prev || t.publication) map.set(id, t);
    }
    return Array.from(map.values());
  }, [cameraTracks]);

  // Audio-only students who have raised their hand and are not yet in uniqueCameras
  const cameraIdentities = useMemo(() => {
    return new Set(uniqueCameras.map((t) => t.participant?.identity).filter(Boolean));
  }, [uniqueCameras]);

  const audioOnlyRaisedHands = useMemo(() => {
    return (raisedHandsList || []).filter((h) => !cameraIdentities.has(h.identity));
  }, [raisedHandsList, cameraIdentities]);

  const renderAudioHandCard = (student: HandRaiseEntry) => {
    const isMicOn = allowedMics?.has(student.identity);
    return (
      <div
        key={`audio-hand-${student.identity}`}
        className="w-32 sm:w-36 md:w-44 h-full shrink-0 relative rounded-xl overflow-hidden bg-gradient-to-b from-[#1c1428] to-[#0e1017] border-2 border-amber-400 ring-2 ring-amber-400/40 p-2 flex flex-col justify-between shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 animate-bounce">
            <Hand size={10} />
            <span>Hand</span>
          </div>
          {isTeacher && onLowerHand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLowerHand(student.identity);
              }}
              className="text-[9px] text-white/60 hover:text-white px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Lower Hand"
            >
              Lower
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center my-0.5">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center">
            {(student.name || "S").charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-white truncate max-w-[90%] mt-1">
            {student.name}
          </span>
        </div>

        {isTeacher && onToggleMic && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMic(student.identity, !isMicOn);
            }}
            className={`w-full py-1 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
              isMicOn
                ? "bg-rose-500/25 text-rose-300 border border-rose-500/40 hover:bg-rose-500/35"
                : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/35"
            }`}
          >
            {isMicOn ? <MicOff size={10} /> : <Mic size={10} />}
            <span>{isMicOn ? "Mute" : "Allow Mic"}</span>
          </button>
        )}
      </div>
    );
  };

  // Selected spotlight participant identity
  const [selectedSpotlightId, setSelectedSpotlightId] = useState<string | null>(null);
  // View mode switcher: "speaker" (Dominant video + horizontal participant strip) vs "gallery"
  const [layoutMode, setLayoutMode] = useState<"speaker" | "gallery">("speaker");

  // Keynote Presenter track for Webinar Mode (Strict Host/Teacher Identification)
  const presenterTrack = useMemo(() => {
    if (!isWebinar) return null;
    return (
      uniqueCameras.find((t) => {
        if (isTeacher && t.participant?.isLocal) return true;
        try {
          if ((t.participant as any)?.permissions?.roomAdmin) return true;
          const meta = JSON.parse(t.participant?.metadata || "{}");
          const role = meta.role?.toUpperCase();
          return (
            meta.isHost === true ||
            ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER", "ADMIN", "PRESENTER", "HOST"].includes(role)
          );
        } catch {
          return false;
        }
      }) || null
    );
  }, [isWebinar, uniqueCameras, isTeacher]);

  // Spotlight track for Cohort Camera Mode
  const activeSpotlightTrack = useMemo(() => {
    if (selectedSpotlightId) {
      const found = uniqueCameras.find((t) => t.participant?.identity === selectedSpotlightId);
      if (found) return found;
    }
    // Default: find teacher / presenter or first available
    const teacher = uniqueCameras.find((t) => {
      try {
        const meta = JSON.parse(t.participant?.metadata || "{}");
        return meta.isHost || ["TEACHER", "SUPER_ADMIN", "ADMIN", "PRESENTER"].includes(meta.role?.toUpperCase());
      } catch {
        return false;
      }
    });
    return teacher || uniqueCameras[0] || null;
  }, [uniqueCameras, selectedSpotlightId]);

  // Screen Share Spotlight View
  if (screenTrack) {
    return (
      <div className="h-full w-full flex flex-col p-2.5 sm:p-3 gap-2.5 overflow-hidden">
        {/* Dominant Screen Share Presentation Video */}
        <div className="flex-1 min-h-0 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/70 border border-white/10 shadow-2xl">
          <FocusLayout trackRef={screenTrack} style={{ height: "100%", width: "100%" }} />
          <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 backdrop-blur-md border border-blue-400/30">
            <Monitor size={14} />
            <span>
              {isWebinar ? "Webinar Presentation" : "Screen Presentation"} ({screenTrack.participant?.name || "Presenter"})
            </span>
          </div>
        </div>

        {/* Horizontal Participant Video Strip */}
        {(uniqueCameras.length > 0 || audioOnlyRaisedHands.length > 0) && (
          <div className="h-20 sm:h-24 md:h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1 items-center px-1 scrollbar-thin">
            {audioOnlyRaisedHands.map(renderAudioHandCard)}
            {uniqueCameras.map((t, idx) => {
              const id = t.participant?.identity || "";
              const isHandUp = id ? raisedHands.has(id) : false;
              return (
                <div
                  key={id || idx}
                  className={`w-32 sm:w-36 md:w-44 h-full shrink-0 relative rounded-xl overflow-hidden bg-black/50 shadow-md transition-all ${
                    isHandUp ? "border-2 border-amber-400 ring-2 ring-amber-400/40" : "border border-white/10"
                  }`}
                >
                  <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                  {isHandUp && (
                    <div className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10 animate-bounce">
                      <Hand size={10} />
                      <span>Hand</span>
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white truncate max-w-[85%] border border-white/10">
                    {t.participant?.name || "Participant"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Webinar Mode Keynote Spotlight Layout
  if (isWebinar) {
    if (presenterTrack) {
      const audienceSpeakers = uniqueCameras.filter(
        (t) => t.participant?.identity !== presenterTrack.participant?.identity
      );

      return (
        <div className="h-full w-full p-2.5 sm:p-3 flex flex-col gap-2.5 overflow-hidden">
          {/* Dominant Presenter Video Container */}
          <div className="flex-1 min-h-0 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/80 border border-purple-500/25 shadow-2xl flex flex-col justify-between">
            <ParticipantTile trackRef={presenterTrack} style={{ width: "100%", height: "100%" }} />

            {/* Top Stage Indicator Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow-md">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                LIVE WEBINAR
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-white/90 text-[11px] font-medium border border-white/10">
                <Globe size={13} className="text-purple-400" />
                Keynote Broadcast
              </span>
            </div>

            {/* Bottom Presenter Overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <div className="inline-flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-xl text-white text-xs font-semibold shadow-lg">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Presenter: {presenterTrack.participant?.name || "Keynote Speaker"}</span>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-white/70 text-[11px]">
                <Users size={12} className="text-purple-400" />
                <span>Audience Mode</span>
              </div>
            </div>
          </div>

          {/* If there are permitted student/co-host camera tracks or audio raised hands, display horizontal strip below */}
          {(audienceSpeakers.length > 0 || audioOnlyRaisedHands.length > 0) && (
            <div className="h-20 sm:h-24 md:h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1 items-center px-1 scrollbar-thin">
              {audioOnlyRaisedHands.map(renderAudioHandCard)}
              {audienceSpeakers.map((t, idx) => {
                const id = t.participant?.identity || "";
                const isHandUp = id ? raisedHands.has(id) : false;
                return (
                  <div
                    key={id || idx}
                    className={`w-32 sm:w-36 md:w-44 h-full shrink-0 relative rounded-xl overflow-hidden bg-black/50 shadow-md transition-all ${
                      isHandUp ? "border-2 border-amber-400 ring-2 ring-amber-400/40" : "border border-white/10"
                    }`}
                  >
                    <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white truncate max-w-[85%] border border-white/10">
                      {t.participant?.name || "Speaker"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Webinar Placeholder when presenter has not started video feed yet
    return (
      <div className="h-full w-full p-4 flex flex-col items-center justify-center gap-3">
        <div className="max-w-md w-full p-8 rounded-3xl bg-gradient-to-b from-[#141624] to-[#0c0d14] border border-purple-500/20 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="h-16 w-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-600/10">
            <Radio size={28} className="animate-pulse" />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
            WEBINAR STAGE ACTIVE
          </span>
          <h3 className="text-base font-bold text-white mb-2">Keynote Presentation Stage</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The broadcast session is live. Presenter camera and shared slides will be spotlighted on this stage. Attendees are in audience mode.
          </p>
        </div>

        {audioOnlyRaisedHands.length > 0 && (
          <div className="w-full max-w-2xl">
            <p className="text-xs text-amber-300 font-bold mb-2 flex items-center gap-1.5">
              <Hand size={13} className="animate-bounce" />
              <span>Attendees requesting to speak ({audioOnlyRaisedHands.length}):</span>
            </p>
            <div className="h-20 sm:h-24 md:h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1 items-center px-1 scrollbar-thin">
              {audioOnlyRaisedHands.map(renderAudioHandCard)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── COHORT CLASSROOM VIDEO CONFERENCING MODE ──
  if (uniqueCameras.length === 0) {
    if (audioOnlyRaisedHands.length > 0) {
      return (
        <div className="h-full w-full p-4 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 mb-2 animate-pulse">
              <Hand size={14} className="animate-bounce" />
              Raised Hands in Session ({audioOnlyRaisedHands.length})
            </span>
            <p className="text-xs text-white/50">Students requesting permission to speak</p>
          </div>
          <div className="h-28 shrink-0 flex gap-3 overflow-x-auto pb-1 items-center px-2 scrollbar-thin">
            {audioOnlyRaisedHands.map(renderAudioHandCard)}
          </div>
        </div>
      );
    }
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-white/40">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-xs">Connecting audio and video...</p>
      </div>
    );
  }

  // If only 1 participant: single dominant presentation tile
  if (uniqueCameras.length === 1) {
    const singleTrack = uniqueCameras[0];
    const isHandUp = singleTrack.participant?.identity ? raisedHands.has(singleTrack.participant.identity) : false;
    return (
      <div className="h-full w-full p-2.5 sm:p-3 overflow-hidden flex flex-col gap-2.5">
        <div className="flex-1 min-h-0 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
          <ParticipantTile trackRef={singleTrack} style={{ width: "100%", height: "100%" }} />
          <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
            <span>{singleTrack.participant?.name || "Participant"}</span>
            {isHandUp && <Hand size={13} className="text-amber-400 animate-bounce" />}
          </div>
        </div>

        {audioOnlyRaisedHands.length > 0 && (
          <div className="h-20 sm:h-24 md:h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1 items-center px-1 scrollbar-thin">
            {audioOnlyRaisedHands.map(renderAudioHandCard)}
          </div>
        )}
      </div>
    );
  }

  // If 2 or more participants: Speaker Spotlight + Participant Video Strip Layout
  if (layoutMode === "speaker" && activeSpotlightTrack) {
    const isSpotlightHandUp = activeSpotlightTrack.participant?.identity
      ? raisedHands.has(activeSpotlightTrack.participant.identity)
      : false;

    return (
      <div className="h-full w-full p-2.5 sm:p-3 flex flex-col gap-2.5 overflow-hidden">
        {/* Dominant Main Speaker / Presenter Video */}
        <div className="flex-1 min-h-0 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/70 border border-white/10 shadow-2xl">
          <ParticipantTile trackRef={activeSpotlightTrack} style={{ width: "100%", height: "100%" }} />

          {/* Speaker Name Overlay (Bottom-Left) */}
          <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeSpotlightTrack.participant?.name || "Speaker"}</span>
            {isSpotlightHandUp && <Hand size={13} className="text-amber-400 animate-bounce" />}
          </div>

          {/* View Mode Switcher Overlay (Top-Right) */}
          <button
            onClick={() => setLayoutMode("gallery")}
            className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white/80 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            title="Switch to equal gallery grid view"
          >
            <LayoutGrid size={13} />
            <span>Gallery View</span>
          </button>
        </div>

        {/* Participant Video Strip Directly Below */}
        <div className="h-20 sm:h-24 md:h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1 items-center px-1 scrollbar-thin">
          {audioOnlyRaisedHands.map(renderAudioHandCard)}
          {uniqueCameras.map((t, idx) => {
            const id = t.participant?.identity || "";
            const isSelected = id === activeSpotlightTrack.participant?.identity;
            const isHandUp = id ? raisedHands.has(id) : false;
            return (
              <div
                key={id || idx}
                onClick={() => setSelectedSpotlightId(id)}
                className={`w-32 sm:w-36 md:w-44 h-full shrink-0 relative rounded-xl overflow-hidden bg-black/50 shadow-md transition-all cursor-pointer group ${
                  isSelected
                    ? "border-2 border-blue-500 ring-2 ring-blue-500/40"
                    : isHandUp
                    ? "border-2 border-amber-400 ring-2 ring-amber-400/40"
                    : "border border-white/10 hover:border-white/30"
                }`}
                title={`Click to spotlight ${t.participant?.name || "Participant"}`}
              >
                <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                {isHandUp && (
                  <div className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10 animate-bounce">
                    <Hand size={10} />
                    <span>Hand</span>
                  </div>
                )}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white truncate border border-white/10 flex items-center justify-between">
                  <span className="truncate">{t.participant?.name || "Participant"}</span>
                  {isSelected && <span className="text-[9px] text-blue-400 font-bold ml-1">Active</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Gallery Responsive Grid View
  return (
    <div className="h-full w-full p-2.5 sm:p-3 flex flex-col gap-2.5 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-1">
        <span className="text-xs text-white/50">Gallery Grid ({uniqueCameras.length} Participants)</span>
        <button
          onClick={() => setLayoutMode("speaker")}
          className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Presentation size={13} />
          <span>Speaker & Strip View</span>
        </button>
      </div>

      <div
        className={`flex-1 min-h-0 grid gap-2.5 ${
          uniqueCameras.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : uniqueCameras.length <= 4
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {uniqueCameras.map((t, i) => {
          const id = t.participant?.identity || "";
          const isHandUp = id ? raisedHands.has(id) : false;
          return (
            <div
              key={id || i}
              onClick={() => {
                setSelectedSpotlightId(id);
                setLayoutMode("speaker");
              }}
              className={`h-full w-full relative rounded-2xl overflow-hidden shadow-lg group transition-all cursor-pointer ${
                isHandUp
                  ? "border-2 border-amber-400 ring-2 ring-amber-400/40 bg-[#1e1b14]"
                  : "border border-white/10 bg-[#14161e] hover:border-white/30"
              }`}
              title="Click to switch to speaker spotlight"
            >
              <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
              {isHandUp && (
                <div className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                  <Hand size={13} className="animate-bounce" />
                  <span>Hand Raised</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] text-white font-medium flex items-center gap-1.5 border border-white/10">
                <span className={isHandUp ? "text-amber-300 font-bold" : ""}>
                  {t.participant?.name || "Participant"}
                </span>
                {isHandUp && <Hand size={12} className="text-amber-400 animate-bounce" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION ERROR BOUNDARY (MID-MEETING RECOVERY WITHOUT RESTART)
// ─────────────────────────────────────────────────────────────────────────────
interface PresentationErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface PresentationErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class PresentationErrorBoundary extends React.Component<
  PresentationErrorBoundaryProps,
  PresentationErrorBoundaryState
> {
  constructor(props: PresentationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): PresentationErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[PresentationDeck Error Caught]:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#0d0f14] text-white p-6 text-center select-none">
          <div className="max-w-md p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col items-center gap-4 shadow-2xl">
            <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Presentation View Interrupted</h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                An unexpected rendering or slide synchronization error occurred. You can reload the presentation view instantly without interrupting your meeting.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-lg hover:shadow-blue-500/25 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Reload Presentation Deck</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING INSTRUCTOR WEBCAM PIP (SLIDES / WHITEBOARD - DRAGGABLE & DOCKABLE)
// ─────────────────────────────────────────────────────────────────────────────
type PiPCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const CORNER_CLASSES: Record<PiPCorner, string> = {
  "top-left": "top-16 left-4",
  "top-right": "top-16 right-4",
  "bottom-left": "bottom-20 left-4",
  "bottom-right": "bottom-20 right-4",
};

const CORNER_ROTATION: Record<PiPCorner, PiPCorner> = {
  "top-right": "bottom-right",
  "bottom-right": "bottom-left",
  "bottom-left": "top-left",
  "top-left": "top-right",
};

interface FloatingCamPiPProps {
  isTeacher: boolean;
  stageMode?: ClassroomStageMode;
  defaultCorner?: PiPCorner;
}

function FloatingCamPiP({
  isTeacher,
  stageMode,
  defaultCorner,
}: FloatingCamPiPProps) {
  // Mode-aware corner: In whiteboard mode, default to bottom-right so Tldraw brush controls (top-right) are completely free!
  const resolvedDefaultCorner: PiPCorner =
    defaultCorner || (stageMode === "whiteboard" ? "bottom-right" : "top-right");

  const [corner, setCorner] = useState<PiPCorner>(resolvedDefaultCorner);
  const [sizeMode, setSizeMode] = useState<"normal" | "compact" | "pill">("normal");
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const valid = tracks.filter((t) => t.participant);
  if (valid.length === 0) return null;

  // Prefer teacher camera, or remote participant
  const target =
    valid.find((t) => {
      try {
        const meta = JSON.parse(t.participant?.metadata || "{}");
        return ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"].includes(meta.role?.toUpperCase());
      } catch {
        return false;
      }
    }) || valid[0];

  if (!target) return null;

  // Quick corner switcher
  const handleCycleCorner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragPosition(null); // Clear custom drag offset
    setCorner((prev) => CORNER_ROTATION[prev]);
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on header / drag icon
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === "button" || targetTag === "svg" || targetTag === "path") return;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;

    const rect = el.getBoundingClientRect();
    dragStartOffsetRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const pipW = sizeMode === "pill" ? 140 : sizeMode === "compact" ? 150 : 210;
    const pipH = sizeMode === "pill" ? 32 : sizeMode === "compact" ? 95 : 140;

    const newX = Math.max(8, Math.min(window.innerWidth - pipW - 8, e.clientX - dragStartOffsetRef.current.offsetX));
    const newY = Math.max(56, Math.min(window.innerHeight - pipH - 64, e.clientY - dragStartOffsetRef.current.offsetY));

    setDragPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Render Collapsed Floating Pill Mode
  if (sizeMode === "pill") {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={dragPosition ? { position: "fixed", left: dragPosition.x, top: dragPosition.y } : undefined}
        className={`${!dragPosition ? `absolute ${CORNER_CLASSES[corner]}` : ""} z-40 pointer-events-auto touch-none select-none`}
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#111318]/95 border border-white/20 text-white shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors">
          <GripVertical size={11} className="text-white/40" />
          <Video size={12} className="text-emerald-400" />
          <span className="text-[10px] font-bold text-white/90">Speaker</span>
          <button
            onClick={handleCycleCorner}
            className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white ml-0.5"
            title={`Move corner (Current: ${corner})`}
          >
            <Move size={10} />
          </button>
          <button
            onClick={() => setSizeMode("normal")}
            className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
            title="Expand Camera"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
    );
  }

  // Render Full / Compact Floating Video Tile
  const isCompact = sizeMode === "compact";

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={dragPosition ? { position: "fixed", left: dragPosition.x, top: dragPosition.y } : undefined}
      className={`${!dragPosition ? `absolute ${CORNER_CLASSES[corner]}` : ""} z-40 flex flex-col items-end gap-1 pointer-events-auto touch-none select-none`}
    >
      <div
        className="rounded-2xl overflow-hidden border border-white/20 bg-[#111318]/95 shadow-2xl backdrop-blur-md transition-all duration-150 ring-1 ring-black/40"
        style={{ width: isCompact ? "150px" : "210px" }}
      >
        {/* PiP Header with Drag Handle & Actions */}
        <div className="flex items-center justify-between px-2 py-1 bg-black/60 text-white/80 text-[10px] font-bold border-b border-white/10 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-1">
            <GripVertical size={11} className="text-white/40" />
            <span className="truncate max-w-[80px]">Speaker</span>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Quick corner switch button */}
            <button
              onClick={handleCycleCorner}
              className="p-1 rounded hover:bg-white/15 text-white/70 hover:text-white transition-colors"
              title={`Switch Corner (Current: ${corner})`}
            >
              <Move size={10} />
            </button>
            {/* Toggle Compact size */}
            <button
              onClick={() => setSizeMode(isCompact ? "normal" : "compact")}
              className="p-1 rounded hover:bg-white/15 text-white/70 hover:text-white transition-colors"
              title={isCompact ? "Normal Size" : "Compact Size"}
            >
              {isCompact ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
            </button>
            {/* Collapse to minimal pill */}
            <button
              onClick={() => setSizeMode("pill")}
              className="p-1 rounded hover:bg-white/15 text-white/70 hover:text-white transition-colors"
              title="Minimize to Floating Badge"
            >
              <EyeOff size={10} />
            </button>
          </div>
        </div>

        {/* Video stream container */}
        <div
          className="bg-black relative overflow-hidden"
          style={{ height: isCompact ? "90px" : "125px" }}
        >
          <ParticipantTile trackRef={target} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM TOUCH CONTROL DOCK
// ─────────────────────────────────────────────────────────────────────────────
function V2BottomControlDock({
  isTeacher,
  isWebinar = false,
  micAllowedByHost = false,
  isImmersed,
  isHandRaised,
  unreadChatCount,
  isRightPanelOpen = true,
  recordingStatus = "idle",
  recordingDuration = 0,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  onToggleHand,
  onToggleChat,
  onLeave,
}: {
  isTeacher: boolean;
  isWebinar?: boolean;
  micAllowedByHost?: boolean;
  isImmersed: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
  isRightPanelOpen?: boolean;
  recordingStatus?: "idle" | "recording" | "paused" | "saving";
  recordingDuration?: number;
  onStartRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  onStopRecording?: () => void;
  onToggleHand: (room?: any) => void;
  onToggleChat: () => void;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const { buttonProps: micProps, enabled: micOn } = useTrackToggle({ source: Track.Source.Microphone });
  const { buttonProps: camProps, enabled: camOn } = useTrackToggle({ source: Track.Source.Camera });
  const { buttonProps: screenProps, enabled: screenOn } = useTrackToggle({ source: Track.Source.ScreenShare });

  const handleToggleMic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (room?.localParticipant) {
        await room.localParticipant.setMicrophoneEnabled(!micOn);
      } else if (typeof micProps.onClick === "function") {
        micProps.onClick(e as any);
      }
    } catch (err) {
      console.warn("Direct microphone toggle failed, running fallback:", err);
      if (room?.localParticipant) {
        await room.localParticipant.setMicrophoneEnabled(!micOn).catch(() => {});
      }
    }
  };

  const handleToggleCam = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (room?.localParticipant) {
        const next = !camOn;
        try {
          await room.localParticipant.setCameraEnabled(next);
        } catch (initialErr) {
          console.warn("Camera standard toggle failed, trying tiered resolution:", initialErr);
          await room.localParticipant.setCameraEnabled(next, {
            resolution: VideoPresets.h360.resolution,
          });
        }
      } else if (typeof camProps.onClick === "function") {
        camProps.onClick(e as any);
      }
    } catch (err) {
      console.warn("Direct camera toggle failed, running fallback:", err);
      if (room?.localParticipant) {
        await room.localParticipant.setCameraEnabled(!camOn).catch(() => {});
      }
    }
  };

  return (
    <footer
      className="h-16 sm:h-18 shrink-0 bg-[#12141c]/95 backdrop-blur-md border-t border-white/10 px-3 sm:px-6 flex items-center justify-center gap-2 sm:gap-3.5 z-30"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {/* Microphone Toggle (Circular) */}
      {isWebinar && !isTeacher && !micAllowedByHost ? (
        <div
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/5 border border-white/10 text-white/40 flex items-center justify-center select-none shadow-md"
          title="Webinar attendees are in listen-only mode. Use Raise Hand to request speaking permission."
        >
          <MicOff size={18} />
        </div>
      ) : (
        <button
          {...micProps}
          onClick={handleToggleMic}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer relative shadow-md ${
            micOn
              ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
              : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40"
          }`}
          title={micOn ? "Mute Microphone" : "Unmute Microphone"}
        >
          {micAllowedByHost && !isTeacher && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      )}

      {/* Camera Toggle (Circular) */}
      {isWebinar && !isTeacher ? (
        <div
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-white/5 border border-white/10 text-white/40 flex items-center justify-center select-none shadow-md"
          title="Webcam streaming is disabled for webinar attendees to maintain stage focus."
        >
          <VideoOff size={18} />
        </div>
      ) : (
        <button
          {...camProps}
          onClick={handleToggleCam}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
            camOn
              ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
              : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40"
          }`}
          title={camOn ? "Turn Off Camera" : "Turn On Camera"}
        >
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
      )}

      {/* Screen Share (Circular - Teacher / Presenter) */}
      {isTeacher && (
        <button
          {...screenProps}
          className={`hidden sm:flex h-11 w-11 sm:h-12 sm:w-12 rounded-full items-center justify-center transition-all active:scale-95 shadow-md ${
            screenOn
              ? "bg-blue-600 text-white shadow-blue-600/30"
              : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
          }`}
          title={screenOn ? "Stop Sharing Screen" : "Share Screen"}
        >
          {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>
      )}

      {/* Recording Controls (Presenter/Teacher/Admin) */}
      {isTeacher && (
        <>
          {recordingStatus === "idle" && (
            <button
              onClick={onStartRecording}
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-all active:scale-95 cursor-pointer shadow-md"
              title="Start Recording"
            >
              <Circle size={18} className="fill-rose-500 text-rose-500" />
            </button>
          )}

          {recordingStatus === "recording" && (
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-rose-950/70 border border-rose-500/50 shadow-lg">
              <button
                onClick={onPauseRecording}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
                title="Pause recording"
              >
                <Pause size={15} />
              </button>
              <button
                onClick={onStopRecording}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 cursor-pointer shadow"
                title="End recording and save"
              >
                <Square size={13} className="fill-white" />
              </button>
            </div>
          )}

          {recordingStatus === "paused" && (
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-amber-950/70 border border-amber-500/50 shadow-lg">
              <button
                onClick={onResumeRecording}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 cursor-pointer"
                title="Resume recording"
              >
                <Play size={15} className="fill-white" />
              </button>
              <button
                onClick={onStopRecording}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 cursor-pointer shadow"
                title="End recording and save"
              >
                <Square size={13} className="fill-white" />
              </button>
            </div>
          )}

          {recordingStatus === "saving" && (
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center bg-blue-500/20 border border-blue-500/40 text-blue-300">
              <Loader2 size={18} className="animate-spin text-blue-400" />
            </div>
          )}
        </>
      )}

      {/* Student Hand Raise Toggle (Circular) */}
      {!isTeacher && (
        <button
          onClick={() => onToggleHand(room)}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
            isHandRaised
              ? "bg-amber-500 text-black shadow-amber-500/30 ring-2 ring-amber-400"
              : isWebinar
              ? "bg-purple-600/30 text-purple-200 border border-purple-500/40 hover:bg-purple-600/40"
              : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
          }`}
          title={isHandRaised ? "Lower Hand" : isWebinar ? "Raise Hand to speak" : "Raise Hand"}
        >
          <Hand size={18} className={isHandRaised ? "animate-bounce" : ""} />
        </button>
      )}

      {/* Chat / Messages Toggle (Circular) */}
      {!isImmersed && (
        <button
          onClick={onToggleChat}
          className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer relative shadow-md ${
            isRightPanelOpen
              ? "bg-blue-600 text-white shadow-blue-600/30"
              : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
          }`}
          title="Toggle Messages & Attachments"
        >
          <MessageSquare size={18} />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#12141c]">
              {unreadChatCount}
            </span>
          )}
        </button>
      )}

      {/* Prominent Red Pill Leave Button */}
      <button
        onClick={onLeave}
        className="px-5 sm:px-6 h-11 sm:h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-transform active:scale-95 cursor-pointer ml-1 sm:ml-2"
        title={isWebinar ? "Exit Webinar" : "Leave Live Class"}
      >
        <LogOut size={16} />
        <span>{isWebinar ? "Exit" : "Leave Meeting"}</span>
      </button>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT & FILES PANELS
// ─────────────────────────────────────────────────────────────────────────────
function ChatContentPanel({
  messages,
  currentUserName = "",
  onSendMessage,
}: {
  messages: ChatMessage[];
  currentUserName?: string;
  onSendMessage: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#10121a]">
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center text-white/30 p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
              <MessageSquare size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">No messages yet</p>
              <p className="text-[11px] text-white/40 mt-0.5">Send a question or note to the live class</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = Boolean(currentUserName && m.sender.toLowerCase() === currentUserName.toLowerCase());
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end ml-auto max-w-[85%]" : "items-start mr-auto max-w-[85%]"}`}
              >
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                    <span className="font-semibold text-white/90">{m.sender}</span>
                    {m.role === "Teacher" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/25 border border-blue-500/40 text-blue-300">
                        Teacher
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                    isMe
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-xs"
                      : "bg-white/5 border border-white/10 text-white/95 rounded-2xl rounded-tl-xs"
                  }`}
                >
                  <p className="break-words">{m.text}</p>
                </div>
                <span className="text-[10px] text-white/40 mt-1 px-1">{m.timestamp}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-[#0c0d14]">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-8 w-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md shadow-blue-600/30"
            title="Send Message"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

function FilesContentPanel({
  sharedFiles,
  isTeacher,
  classId,
  room,
  onFileUploaded,
  onOpenAsSlides,
  onDeleteFile,
}: {
  sharedFiles: SharedFile[];
  isTeacher: boolean;
  classId?: string;
  room?: any;
  onFileUploaded?: (file: SharedFile) => void;
  onOpenAsSlides?: (file: SharedFile) => void;
  onDeleteFile?: (fileUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadingName(file.name);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const inferredMime =
        file.type && file.type !== "application/octet-stream"
          ? file.type
          : ext === "pptx"
            ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            : ext === "ppt"
              ? "application/vnd.ms-powerpoint"
              : ext === "pdf"
                ? "application/pdf"
                : ext === "png"
                  ? "image/png"
                  : ext === "jpg" || ext === "jpeg"
                    ? "image/jpeg"
                    : ext === "zip"
                      ? "application/zip"
                      : "application/octet-stream";

      let finalFileUrl = "";

      // Step 1: Try pre-signed Cloudflare R2 upload
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
            finalFileUrl = presigned.finalUrl;
            if (classId) {
              await fetchApi(`/live-class/${classId}/files`, {
                method: "POST",
                body: JSON.stringify({
                  fileName: file.name,
                  fileUrl: finalFileUrl,
                  fileSize: file.size,
                  mimeType: inferredMime,
                }),
                silent: true,
              });
            }
          }
        }
      } catch (presignedErr) {
        console.warn("Presigned R2 upload bypassed, falling back to direct classroom upload:", presignedErr);
      }

      // Step 2: Fallback to direct server-side upload if presigned upload is unavailable or unconfigured
      if (!finalFileUrl && classId) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read local file"));
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
          finalFileUrl = uploadRes.file.url;
        } else {
          throw new Error("Direct file upload could not be completed.");
        }
      }

      if (!finalFileUrl) {
        throw new Error("Could not acquire file upload URL.");
      }

      const newFile: SharedFile = {
        name: file.name,
        url: finalFileUrl,
      };

      if (room) {
        safePublishData(room, {
          type: "FILE_SHARED",
          name: file.name,
          url: finalFileUrl,
        });
      }

      onFileUploaded?.(newFile);
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || "Please check network or file format"}`);
    } finally {
      setUploading(false);
      setUploadingName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (f: SharedFile) => {
    if (!confirm(`Remove "${f.name}" from class attachments?`)) return;
    onDeleteFile?.(f.url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
      {/* Teacher / Admin Upload Section */}
      {isTeacher && (
        <div className="shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/15 text-blue-300 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="truncate">Uploading {uploadingName}...</span>
              </>
            ) : (
              <>
                <Upload size={16} className="text-blue-400" />
                <span>Upload New Attachment</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sharedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/30 p-6">
            <FileText size={32} />
            <p className="text-xs font-semibold">No attachments shared yet.</p>
            {isTeacher && (
              <p className="text-[11px] text-white/40">
                Click upload above to share PDFs, handouts, or notes with students.
              </p>
            )}
          </div>
        ) : (
          sharedFiles.map((f, i) => {
            const isPdf = f.name.toLowerCase().endsWith(".pdf") || f.url.toLowerCase().endsWith(".pdf");
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate" title={f.name}>
                    {f.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={f.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                    >
                      <FileDown size={11} /> Download
                    </a>
                    {isTeacher && isPdf && onOpenAsSlides && (
                      <button
                        onClick={() => onOpenAsSlides(f)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                        title="Present this PDF on the main stage"
                      >
                        <Presentation size={11} /> Present Slides
                      </button>
                    )}
                  </div>
                </div>
                {isTeacher && (
                  <button
                    onClick={() => handleDelete(f)}
                    className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 flex items-center justify-center transition-all shrink-0"
                    title="Remove attachment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSROOM SYNCHRONIZATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function ClassroomV2Sync({
  classId,
  isTeacher,
  myIdentity,
  stageMode,
  setStageMode,
  setSharedFiles,
  setChatMessages,
  chatMessagesRef,
  activeTabRef,
  setUnreadChatCount,
  allowStudentWhiteboardDraw,
  setAllowStudentWhiteboardDraw,
  allowStudentSlideDraw,
  setAllowStudentSlideDraw,
  setRaisedHandsList,
  setIsHandRaised,
  setNetworkAlert,
  breakStateRef,
  setBreakState,
  onNewChatMessage,
  onNewFileShared,
  onNewHandRaise,
  onUpdateAttendees,
  setRemoteRecordingActive,
  setRemoteRecordingPaused,
  setMicAllowedByHost,
  setHostAllowedMicToast,
  setAllowedMics,
}: any) {
  const room = useRoomContext();
  const participants = useParticipants();

  // Stable mutable refs protect listeners from frequent teardowns
  const onNewChatMessageRef = useRef(onNewChatMessage);
  onNewChatMessageRef.current = onNewChatMessage;
  const onNewFileSharedRef = useRef(onNewFileShared);
  onNewFileSharedRef.current = onNewFileShared;
  const onNewHandRaiseRef = useRef(onNewHandRaise);
  onNewHandRaiseRef.current = onNewHandRaise;
  const isTeacherRef = useRef(isTeacher);
  isTeacherRef.current = isTeacher;
  const stageModeRef = useRef(stageMode);
  stageModeRef.current = stageMode;
  const allowStudentWhiteboardDrawRef = useRef(allowStudentWhiteboardDraw);
  allowStudentWhiteboardDrawRef.current = allowStudentWhiteboardDraw;
  const allowStudentSlideDrawRef = useRef(allowStudentSlideDraw);
  allowStudentSlideDrawRef.current = allowStudentSlideDraw;

  // Track and accumulate all participants seen in this live session for attendance
  useEffect(() => {
    if (!room) return;
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    onUpdateAttendees((prev: Map<string, SessionAttendee>) => {
      const nextMap = new Map(prev);

      // Mark current participants as online
      const currentIds = new Set<string>();
      participants.forEach((p) => {
        const id = p.identity || "";
        if (!id) return;
        currentIds.add(id);

        let role = "STUDENT";
        try {
          const meta = JSON.parse(p.metadata || "{}");
          if (meta.role) role = meta.role;
        } catch { }

        const existing = nextMap.get(id);
        if (existing) {
          nextMap.set(id, {
            ...existing,
            isOnline: true,
            lastSeenAt: nowStr,
          });
        } else {
          nextMap.set(id, {
            identity: id,
            name: p.name || id,
            role,
            firstJoinedAt: nowStr,
            lastSeenAt: nowStr,
            isOnline: true,
          });
        }
      });

      // Mark missing participants as offline
      nextMap.forEach((att, key) => {
        if (!currentIds.has(key) && att.isOnline) {
          nextMap.set(key, { ...att, isOnline: false, lastSeenAt: nowStr });
        }
      });

      return nextMap;
    });
  }, [participants, room, onUpdateAttendees]);

  useEffect(() => {
    if (!room) return;
    (window as any).__lk_room = room;

    const handleData = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // Security: WebRTC Sender Attestation
        let isSenderHost = false;
        if (participant) {
          if (participant.permissions?.roomAdmin === true) {
            isSenderHost = true;
          } else if (participant.metadata) {
            try {
              const meta = typeof participant.metadata === "string" ? JSON.parse(participant.metadata) : participant.metadata;
              if (
                meta.isHost === true ||
                meta.role === "TEACHER" ||
                meta.role === "SUPER_ADMIN" ||
                meta.role === "CENTRE_ADMIN" ||
                meta.role === "ADMIN"
              ) {
                isSenderHost = true;
              }
            } catch { }
          }
        }

        // Stage Mode Sync: Supports STAGE_MODE_CHANGE, ROOM_STATE_SYNC & STAGE_MODE_HEARTBEAT
        if (
          (data.type === "STAGE_MODE_CHANGE" ||
            data.type === "ROOM_STATE_SYNC" ||
            data.type === "STAGE_MODE_HEARTBEAT") &&
          data.mode
        ) {
          if (data.type === "STAGE_MODE_CHANGE" && participant && !isSenderHost) return;
          setStageMode((prev: string) => (prev !== data.mode ? data.mode : prev));
          if (typeof data.allowStudentWhiteboardDraw === "boolean") {
            setAllowStudentWhiteboardDraw(data.allowStudentWhiteboardDraw);
          }
          if (typeof data.allowStudentSlideDraw === "boolean") {
            setAllowStudentSlideDraw(data.allowStudentSlideDraw);
          }
        } else if (data.type === "WHITEBOARD_PERMISSION") {
          if (!isSenderHost) return;
          setAllowStudentWhiteboardDraw(!!data.allowStudentDraw);
        } else if (data.type === "CHAT_MESSAGE") {
          setChatMessages((prev: any) => {
            const key = `${data.sender}_${data.text}`;
            if (prev.some((m: any) => `${m.sender}_${m.text}` === key)) return prev;
            return [...prev, data];
          });
          if (activeTabRef.current !== "chat") {
            setUnreadChatCount((prev: number) => prev + 1);
          }
          onNewChatMessageRef.current?.(data);
        } else if (data.type === "FILE_SHARED") {
          const newFile = { name: data.name, url: data.url };
          setSharedFiles((prev: any) => [...prev, newFile]);
          onNewFileSharedRef.current?.(newFile);
        } else if (data.type === "ALLOW_MIC") {
          if (!isSenderHost) return;
          const myLocalId = room?.localParticipant?.identity;
          if (data.identity === myLocalId || data.identity === myIdentity) {
            const allowed = Boolean(data.allowed);
            setMicAllowedByHost?.(allowed);
            if (allowed) {
              setHostAllowedMicToast?.(true);
              room.localParticipant?.setMicrophoneEnabled(true).catch(() => {});
            } else {
              room.localParticipant?.setMicrophoneEnabled(false).catch(() => {});
            }
          }
        } else if (data.type === "MUTE_STUDENT" && !isTeacherRef.current) {
          if (!isSenderHost) return;
          const myLocalId = room?.localParticipant?.identity;
          if (data.identity === myLocalId || data.identity === myIdentity) {
            setMicAllowedByHost?.(false);
            room.localParticipant?.setMicrophoneEnabled(false).catch(() => {});
          }
        } else if (data.type === "MUTE_ALL" && !isTeacherRef.current) {
          if (!isSenderHost) return;
          setMicAllowedByHost?.(false);
          room.localParticipant?.setMicrophoneEnabled(false).catch(() => {});
        } else if (data.type === "HAND_RAISE") {
          const targetId = data.identity || participant?.identity;
          if (!targetId) return;

          let targetName = data.name || participant?.name;
          if (!targetName || targetName === "Student" || targetName === "Participant") {
            const found = participants.find((p: any) => p.identity === targetId);
            if (found?.name && found.name !== "Student") {
              targetName = found.name;
            }
          }
          if (!targetName) targetName = "Student";

          setRaisedHandsList((prev: HandRaiseEntry[]) => {
            if (data.raised) {
              const existing = prev.find((h) => h.identity === targetId);
              if (existing) {
                return prev.map((h) => (h.identity === targetId ? { ...h, name: targetName } : h));
              }
              return [
                ...prev,
                {
                  identity: targetId,
                  name: targetName,
                  raisedAt: data.raisedAt || Date.now(),
                },
              ];
            } else {
              return prev.filter((h) => h.identity !== targetId);
            }
          });
          if (data.raised) {
            if (isTeacherRef.current) {
              playHandRaiseChime();
            }
            onNewHandRaiseRef.current?.(targetName, targetId);
          }
        } else if (data.type === "LOWER_STUDENT_HAND") {
          const myLocalId = room?.localParticipant?.identity;
          if (data.identity === myLocalId || data.identity === myIdentity) {
            setIsHandRaised(false);
          }
          setRaisedHandsList((prev: HandRaiseEntry[]) => prev.filter((h) => h.identity !== data.identity));
        } else if (data.type === "LOWER_ALL_HANDS") {
          if (!isSenderHost) return;
          setRaisedHandsList([]);
          setIsHandRaised(false);
        } else if (data.type === "BREAK_STATE") {
          if (!isSenderHost) return;
          setBreakState(data.active !== undefined ? (data.active ? data : null) : (data.isActive ? data : null));
        } else if (data.type === "RECORDING_STATE") {
          setRemoteRecordingActive?.(Boolean(data.isRecording));
          setRemoteRecordingPaused?.(Boolean(data.isPaused));
        }
      } catch { }
    };

    const handleParticipantConnected = () => {
      // Announce active stage mode to any newly joined participant immediately
      if (isTeacherRef.current && room?.state === "connected") {
        safePublishData(room, {
          type: "ROOM_STATE_SYNC",
          mode: stageModeRef.current,
          allowStudentWhiteboardDraw: allowStudentWhiteboardDrawRef.current,
          allowStudentSlideDraw: allowStudentSlideDrawRef.current,
        });
      }
    };

    room.on("dataReceived", handleData);
    room.on("participantConnected", handleParticipantConnected);

    return () => {
      room.off("dataReceived", handleData);
      room.off("participantConnected", handleParticipantConnected);
    };
  }, [room, myIdentity, setStageMode, setAllowStudentWhiteboardDraw, setAllowStudentSlideDraw, setChatMessages, setSharedFiles, activeTabRef, setUnreadChatCount, setRaisedHandsList, setIsHandRaised, setBreakState, setMicAllowedByHost, setHostAllowedMicToast, setRemoteRecordingActive, setRemoteRecordingPaused, participants]);

  return null;
}
