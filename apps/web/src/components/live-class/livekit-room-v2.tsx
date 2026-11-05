"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
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
  Monitor, AlertCircle, Hand, MessageSquare, Send, CheckCircle2,
  ChevronRight, Minimize2, Maximize2, Shield, Users, RefreshCw,
  Trash2, Edit3, SlidersHorizontal, X, Presentation, LayoutGrid,
  PenTool, MoreHorizontal, Info, Clock, Download, FileSpreadsheet,
  UserCheck, UserX, ChevronDown, Check, Search, Globe, Radio,
  Share2, Copy, ExternalLink, Play, Pause, Circle, Square
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

  // Chat & Files Sidebar / Mobile Drawer State
  const [activeSidebarTab, setActiveSidebarTab] = useState<"chat" | "files">("chat");
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
  const isTeacher = ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN", "PRESENTER", "HOST"].includes(normalizedRole);
  const isImmersed = !isTeacher && stageMode !== "grid";

  // High-Fidelity In-Browser Multi-Source Recording State
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "paused" | "saving">("idle");
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [remoteRecordingActive, setRemoteRecordingActive] = useState<boolean>(false);
  const [remoteRecordingPaused, setRemoteRecordingPaused] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingMicStreamRef = useRef<MediaStream | null>(null);
  const recordingAudioCtxRef = useRef<AudioContext | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      alert("Screen and audio recording is not supported in this browser.");
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

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // The recording is only assembled and saved to disk after the recording is explicitly ended
        try {
          if (recordedChunksRef.current.length > 0) {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeTitle = (classTitle || (isWebinar ? "webinar" : "live-class")).replace(/[^a-zA-Z0-9_-]/g, "_");
            const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const ext = mimeType.includes("mp4") ? "mp4" : "webm";
            a.download = `${safeTitle}_${dateStr}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 15000);
          }
        } catch (saveErr) {
          console.error("Failed to assemble or save recording blob:", saveErr);
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
    }
  }, []);

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

      // Fallback: Check localStorage if not in URL query parameters
      if (targetPublicId && typeof window !== "undefined") {
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

      let res: TokenResponse | null = null;
      const credentialToTry = passToken || regToken;

      // 1. Authenticate with signed passport or registration credential
      if (credentialToTry && targetPublicId) {
        try {
          res = await fetchApi<TokenResponse>(
            `/live-class/public/${targetPublicId}/token?registrationToken=${encodeURIComponent(
              credentialToTry
            )}&name=${encodeURIComponent(confirmedDisplayName || name || "")}`
          );
        } catch (tokenErr: any) {
          console.warn("Public token validation with primary credential failed:", tokenErr?.message);
          // If we tried passToken first and it failed, retry with regToken if different
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

      // 2. Authenticated LMS token endpoint strictly for regular logged-in students/teachers (never public webinars)
      if (!res && !isWebinar && normalizedRole !== "PUBLIC_LEARNER") {
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
      }

      if (!res && (isWebinar || normalizedRole === "PUBLIC_LEARNER")) {
        throw new Error("Your webinar registration credential could not be verified (session expired or unconfirmed). Please register for free to get instant access.");
      }

      if (!res && (isWebinar || normalizedRole === "PUBLIC_LEARNER")) {
        throw new Error("Unable to establish public webinar stream. Please refresh or enter the webinar again.");
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

    fetchApi<any[]>(`/live-class/${classId}/messages`, { silent: true })
      .then((msgs) => {
        if (Array.isArray(msgs) && msgs.length > 0) {
          setChatMessages(
            msgs.map((m) => ({
              id: m.id || Math.random().toString(36).slice(2, 9),
              sender: m.senderName || m.sender?.name || m.sender || "User",
              role: m.senderRole || m.role || "Student",
              text: m.message || m.content || m.text,
              timestamp: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }))
          );
        }
      })
      .catch(() => { });
  }, [classId, isWebinar, normalizedRole]);

  // Room Options
  const roomOptions: RoomOptions = useMemo(
    () => ({
      adaptiveStream: false,
      dynacast: false,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: false,
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
      Boolean(error && /registration|credential|access denied|authentication/i.test(error));
    const webinarLandingId = classId || roomId;

    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-[#0b0c10] text-white p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle size={24} />
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-bold">Classroom Entry Failed</h3>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            {isRegistrationError || isWebinar
              ? "Your webinar registration credential could not be verified (session expired or unconfirmed). Please register for free to get instant access."
              : (error || "Could not retrieve access credentials.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {webinarLandingId && (isWebinar || isRegistrationError) && (
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
      className="h-[100dvh] w-full flex flex-col relative overflow-hidden select-none"
      style={{ background: "#0b0c10" }}
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
          const isChatActive = activeSidebarTab === "chat" && !isImmersed && (typeof window !== "undefined" && window.innerWidth >= 768);
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
            setRecentHandRaiseAlert({ name, identity });
          }
        }}
        onUpdateAttendees={setSessionAttendees}
        setRemoteRecordingActive={setRemoteRecordingActive}
        setRemoteRecordingPaused={setRemoteRecordingPaused}
      />

      <StudioPipelineManager
        isTeacher={isTeacher}
        settings={studioSettings}
        processorRef={studioProcessorRef}
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

      {/* ── TOP HEADER BAR ── */}
      <header className="h-14 sm:h-16 shrink-0 bg-[#111318] border-b border-white/10 px-3 sm:px-6 flex items-center justify-between z-30">
        {/* Left: Class identity */}
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-md ${
            isWebinar ? "bg-gradient-to-tr from-purple-600 to-indigo-600" : "bg-gradient-to-tr from-blue-600 to-indigo-600"
          }`}>
            {isWebinar ? <Globe size={16} /> : <Video size={16} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-white font-bold text-xs sm:text-sm truncate max-w-[120px] sm:max-w-xs">
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
                  ? (isWebinar ? "Keynote Presenter" : "Teacher")
                  : (isWebinar ? "Audience (Listen-Only)" : "Student")}
              </span>
            </div>
            <p className="text-[10px] text-white/40 hidden sm:block">
              {isWebinar ? "Public Webinar Broadcast" : "HD Interactive Lecture"}
            </p>
          </div>
        </div>

        {/* Center: Stage Switcher (Teacher Interactive) OR Mode Status Pill (Student Read-Only) */}
        {isTeacher ? (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => {
                setStageMode("grid");
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "grid" });
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${stageMode === "grid"
                  ? (isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm")
                  : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">{isWebinar ? "Speaker Stage" : "Camera"}</span>
            </button>

            <button
              onClick={() => {
                setStageMode("slides");
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all relative ${stageMode === "slides"
                  ? (isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm")
                  : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
            >
              <Presentation size={14} />
              <span className="hidden sm:inline">Slides</span>
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
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${stageMode === "whiteboard"
                  ? (isWebinar ? "bg-purple-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm")
                  : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
            >
              <PenTool size={14} />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
        ) : (
          /* Student Status Indicator */
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white/80 shadow-inner">
            {stageMode === "grid" && (
              <>
                {isWebinar ? (
                  <>
                    <Globe size={13} className="text-purple-400 animate-pulse" />
                    <span>Webinar Stage</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid size={13} className="text-emerald-400" />
                    <span>Gallery View</span>
                  </>
                )}
              </>
            )}
            {stageMode === "slides" && (
              <>
                <Presentation size={13} className="text-blue-400 animate-pulse" />
                <span>Presentation Deck</span>
              </>
            )}
            {stageMode === "whiteboard" && (
              <>
                <PenTool size={13} className="text-purple-400 animate-pulse" />
                <span>Whiteboard View</span>
              </>
            )}
          </div>
        )}

        {/* Right: Teacher Controls & Moderation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Recording Status & Controls */}
          {isTeacher ? (
            <>
              {recordingStatus === "idle" && (
                <button
                  onClick={startRecording}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  title="Start recording this session (screen + audio)"
                >
                  <Circle size={10} className="fill-rose-500 text-rose-500 animate-pulse" />
                  <span className="hidden sm:inline">Record</span>
                </button>
              )}

              {recordingStatus === "recording" && (
                <div className="flex items-center gap-1 bg-rose-950/70 border border-rose-500/50 rounded-xl p-0.5 sm:p-1 shadow-lg shadow-rose-950/40">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold text-rose-200">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    <span>REC {formatRecordingDuration(recordingDuration)}</span>
                  </div>
                  <button
                    onClick={pauseRecording}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Pause recording"
                  >
                    <Pause size={12} />
                    <span className="hidden md:inline">Pause</span>
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow cursor-pointer"
                    title="End and save recording file"
                  >
                    <Square size={11} className="fill-white" />
                    <span className="hidden sm:inline">End & Save</span>
                  </button>
                </div>
              )}

              {recordingStatus === "paused" && (
                <div className="flex items-center gap-1 bg-amber-950/70 border border-amber-500/50 rounded-xl p-0.5 sm:p-1 shadow-lg shadow-amber-950/40">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold text-amber-300">
                    <Pause size={12} className="text-amber-400" />
                    <span>PAUSED {formatRecordingDuration(recordingDuration)}</span>
                  </div>
                  <button
                    onClick={resumeRecording}
                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow cursor-pointer"
                    title="Resume recording"
                  >
                    <Play size={11} className="fill-white" />
                    <span className="hidden md:inline">Resume</span>
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 shadow cursor-pointer"
                    title="End and save recording file"
                  >
                    <Square size={11} className="fill-white" />
                    <span className="hidden sm:inline">End & Save</span>
                  </button>
                </div>
              )}

              {recordingStatus === "saving" && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs font-semibold">
                  <Loader2 size={13} className="animate-spin text-blue-400" />
                  <span>Saving...</span>
                </div>
              )}
            </>
          ) : (
            /* Student / Audience Recording Indicator */
            <>
              {(recordingStatus === "recording" || remoteRecordingActive) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>REC</span>
                </div>
              )}
              {(recordingStatus === "paused" || remoteRecordingPaused) && !(recordingStatus === "recording" || remoteRecordingActive) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                  <Pause size={11} className="text-amber-400" />
                  <span>REC PAUSED</span>
                </div>
              )}
            </>
          )}

          {/* Whiteboard Permission Toggle for Instructor */}
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
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${allowStudentWhiteboardDraw
                  ? "bg-purple-600/25 border-purple-500/50 text-purple-300"
                  : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                }`}
              title="Toggle whether students can draw on whiteboard"
            >
              <PenTool size={13} />
              <span>Drawing: {allowStudentWhiteboardDraw ? "Everyone" : "Teacher Only"}</span>
            </button>
          )}

          {/* Raised Hands Identification & Controls */}
          {isTeacher && (
            <div className="relative">
              <button
                onClick={() => setShowRaisedHandsPopover(!showRaisedHandsPopover)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${raisedHandsList.length > 0
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                title="Raised Hands Roster"
              >
                <Hand size={14} />
                <span>{raisedHandsList.length}</span>
                <ChevronDown size={11} />
              </button>

              {/* Raised Hands Dropdown Popover */}
              {showRaisedHandsPopover && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#14161f] border border-white/10 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Hand size={13} className="text-amber-400" /> Raised Hands ({raisedHandsList.length})
                    </span>
                    {raisedHandsList.length > 0 && (
                      <button
                        onClick={() => {
                          const room = (window as any).__lk_room;
                          safePublishData(room, { type: "LOWER_ALL_HANDS" });
                          setRaisedHandsList([]);
                          setShowRaisedHandsPopover(false);
                        }}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                      >
                        Lower All
                      </button>
                    )}
                  </div>

                  {raisedHandsList.length === 0 ? (
                    <div className="py-4 text-center text-xs text-white/40">
                      No raised hands right now.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {raisedHandsList.map((item) => (
                        <div
                          key={item.identity}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] text-white/40">{formatRelativeTime(item.raisedAt)}</p>
                          </div>
                          <button
                            onClick={() => {
                              const room = (window as any).__lk_room;
                              safePublishData(room, {
                                type: "LOWER_STUDENT_HAND",
                                identity: item.identity,
                              });
                              setRaisedHandsList((prev) => prev.filter((h) => h.identity !== item.identity));
                            }}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold shrink-0 transition-colors"
                          >
                            Lower
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teacher Attendance & Attendee Roster Drawer Trigger */}
          {isTeacher && (
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              title={isWebinar ? "View Registered Attendees & Webinar Roster" : "Class Attendance & Attendee Roster"}
            >
              <Users size={14} />
              <span className="hidden lg:inline">
                {isWebinar ? "Webinar Roster" : "Attendance"} ({sessionAttendees.size})
              </span>
            </button>
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
              <span className="hidden sm:inline">{copiedHeaderWebinarLink ? "Copied Link!" : "Webinar Link"}</span>
            </button>
          )}

          {isTeacher && (
            <>
              {/* Mute All */}
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
                <span className="hidden lg:inline">Mute All</span>
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
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${breakState?.isActive
                    ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white"
                  }`}
                title={breakState?.isActive ? "Resume Class" : "Start 5-min Break"}
              >
                <Clock size={14} />
                <span className="hidden lg:inline">{breakState?.isActive ? "Resume" : "Break"}</span>
              </button>

              {/* Studio Tools */}
              <button
                onClick={() => setIsStudioOpen(!isStudioOpen)}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Studio Broadcasting Tools (Crop, Chroma Key, Audio, Filter)"
              >
                <SlidersHorizontal size={14} />
                <span className="hidden md:inline">Studio</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── MAIN STAGE AREA ── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative flex flex-col overflow-hidden bg-[#0b0c10]">
          {/* Mode 1: Camera Grid / Speaker Stage */}
          <div className={`h-full w-full ${stageMode === "grid" ? "block" : "hidden"}`}>
            <V2ClassVideoGrid
              isTeacher={isTeacher}
              classId={classId}
              isWebinar={isWebinar}
              raisedHands={new Set(raisedHandsList.map((h) => h.identity))}
            />
          </div>

          {/* Mode 2: Interactive Slides Deck */}
          <div className={`h-full w-full relative ${stageMode === "slides" ? "block" : "hidden"}`}>
            <PresentationDeck
              isTeacher={isTeacher}
              classId={classId}
              room={(window as any).__lk_room}
              myIdentity={effectiveIdentity}
              myName={confirmedDisplayName || name || "Participant"}
              initialFiles={sharedFiles}
              allowStudentDraw={allowStudentSlideDraw}
              onToggleStudentDraw={setAllowStudentSlideDraw}
            />
            {/* Draggable Camera PiP */}
            <FloatingCamPiP isTeacher={isTeacher} />
          </div>

          {/* Mode 3: Synchronized Whiteboard */}
          <div className={`h-full w-full relative bg-white ${stageMode === "whiteboard" ? "block" : "hidden"}`}>
            <SynchronizedWhiteboard
              isTeacher={isTeacher}
              allowStudentDraw={allowStudentWhiteboardDraw}
              room={(window as any).__lk_room}
              classId={classId}
            />
            <FloatingCamPiP isTeacher={isTeacher} />
          </div>

          {/* Prominent Teacher Raised Hands Panel (Visible in ALL Stage Modes: Grid, Slides, Whiteboard) */}
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

              {/* List of Students with Raised Hands */}
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
                ))}
              </div>
            </div>
          )}

          {/* Teacher Raised Hand Instant Notification Toast */}
          {isTeacher && recentHandRaiseAlert && raisedHandsList.length <= 1 && (
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

        {/* ── DESKTOP COLLAPSIBLE SIDEBAR (HIDDEN FOR IMMERSED STUDENTS) ── */}
        {!isImmersed && (
          <aside className="w-80 shrink-0 hidden md:flex flex-col bg-[#111318] border-l border-white/10 z-20">
            <div className="flex items-center border-b border-white/10 shrink-0 px-2 pt-2">
              <button
                onClick={() => {
                  setActiveSidebarTab("chat");
                  setUnreadChatCount(0);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${activeSidebarTab === "chat"
                    ? "border-blue-500 text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                  }`}
              >
                <MessageSquare size={14} />
                <span>Live Chat</span>
                {unreadChatCount > 0 && activeSidebarTab !== "chat" && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSidebarTab("files")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${activeSidebarTab === "files"
                    ? "border-blue-500 text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                  }`}
              >
                <FileText size={14} />
                <span>Attachments</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">
                  {sharedFiles.length}
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {activeSidebarTab === "chat" ? (
                <ChatContentPanel
                  messages={chatMessages}
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
      </div>

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
            className={`flex-1 py-2 text-xs font-bold border-b-2 text-center ${activeSidebarTab === "chat" ? "border-blue-500 text-white" : "border-transparent text-white/50"
              }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveSidebarTab("files")}
            className={`flex-1 py-2 text-xs font-bold border-b-2 text-center ${activeSidebarTab === "files" ? "border-blue-500 text-white" : "border-transparent text-white/50"
              }`}
          >
            Files ({sharedFiles.length})
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeSidebarTab === "chat" ? (
            <ChatContentPanel
              messages={chatMessages}
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
        />
      )}

      {/* ── BOTTOM TOUCH-ENGINEERED CONTROL DOCK ── */}
      <V2BottomControlDock
        isTeacher={isTeacher}
        isWebinar={isWebinar}
        isImmersed={isImmersed}
        isHandRaised={isHandRaised}
        unreadChatCount={unreadChatCount}
        recordingStatus={recordingStatus}
        recordingDuration={recordingDuration}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
        onToggleHand={() => {
          const room = (window as any).__lk_room;
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
          setIsMobileSheetOpen(true);
          setUnreadChatCount(0);
        }}
        onLeave={onLeave}
      />
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
}: {
  isOpen: boolean;
  onClose: () => void;
  classId?: string;
  sessionAttendees: Map<string, SessionAttendee>;
  defaultTab?: "live" | "webinar";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-[#141620] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
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
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLive.map((a) => (
                    <tr key={a.identity} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">{a.name}</td>
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
                      <td className="py-3 px-3 text-right">
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
function V2ClassVideoGrid({
  isTeacher,
  classId,
  isWebinar = false,
  raisedHands,
}: {
  isTeacher: boolean;
  classId?: string;
  isWebinar?: boolean;
  raisedHands: Set<string>;
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

  // Keynote Presenter track for Webinar Mode
  const presenterTrack = useMemo(() => {
    if (!isWebinar) return null;
    return (
      uniqueCameras.find((t) => {
        try {
          const meta = JSON.parse(t.participant?.metadata || "{}");
          return (
            ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"].includes(meta.role?.toUpperCase()) ||
            Boolean(meta.isHost)
          );
        } catch {
          return false;
        }
      }) || (isTeacher ? uniqueCameras[0] : uniqueCameras.find((t) => !t.participant?.isLocal) || uniqueCameras[0])
    );
  }, [isWebinar, uniqueCameras, isTeacher]);

  // Screen Share Spotlight View
  if (screenTrack) {
    return (
      <div className="h-full w-full flex flex-col p-2 gap-2">
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
          <FocusLayout trackRef={screenTrack} style={{ height: "100%", width: "100%" }} />
          <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1.5 backdrop-blur-md">
            <Monitor size={13} />
            <span>
              {isWebinar ? "Webinar Presentation" : "Screen Presentation"} ({screenTrack.participant?.name || "Presenter"})
            </span>
          </div>
        </div>

        {/* Horizontal Filmstrip on Bottom */}
        <div className="h-24 sm:h-28 shrink-0 flex gap-2 overflow-x-auto pb-1 items-center px-1">
          {uniqueCameras.map((t, idx) => {
            const id = t.participant?.identity || "";
            const isHandUp = id ? raisedHands.has(id) : false;
            return (
              <div
                key={id || idx}
                className={`w-36 sm:w-44 h-full shrink-0 relative rounded-xl overflow-hidden bg-black/40 shadow-md transition-all ${
                  isHandUp ? "border-2 border-amber-400 ring-2 ring-amber-400/40" : "border border-white/10"
                }`}
              >
                <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                {isHandUp && (
                  <div className="absolute top-1 left-1 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10 animate-bounce">
                    <Hand size={10} />
                    <span>Hand</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white truncate max-w-[90%]">
                  {t.participant?.name || "Participant"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Webinar Mode Keynote Spotlight Layout
  if (isWebinar) {
    if (presenterTrack) {
      return (
        <div className="h-full w-full p-2 sm:p-4 flex flex-col items-center justify-center overflow-hidden">
          <div className="h-full w-full max-w-6xl relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black/80 border border-purple-500/25 shadow-2xl flex flex-col justify-between">
            <ParticipantTile trackRef={presenterTrack} style={{ width: "100%", height: "100%" }} />

            {/* Top Stage Indicator Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow-md">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                LIVE WEBINAR
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-medium border border-white/10">
                <Globe size={12} className="text-purple-400" />
                Keynote Broadcast
              </span>
            </div>

            {/* Bottom Presenter Overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <div className="inline-flex items-center gap-2 bg-black/75 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-lg">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Presenter: {presenterTrack.participant?.name || "Keynote Speaker"}</span>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-white/70 text-[11px]">
                <Users size={12} className="text-purple-400" />
                <span>Audience Mode</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Webinar Placeholder when presenter has not started video feed yet
    return (
      <div className="h-full w-full p-4 flex items-center justify-center">
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
      </div>
    );
  }

  // Classroom Gallery Responsive Grid (Cohort Mode)
  return (
    <div className="h-full w-full p-2 sm:p-4 overflow-hidden">
      {uniqueCameras.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-xs">Connecting audio and video...</p>
        </div>
      ) : (
        <div
          className={`h-full w-full grid gap-2 sm:gap-3 ${uniqueCameras.length === 1
              ? "grid-cols-1"
              : uniqueCameras.length === 2
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
                className={`h-full w-full relative rounded-2xl overflow-hidden shadow-lg group transition-all ${
                  isHandUp
                    ? "border-2 border-amber-400 ring-2 ring-amber-400/40 bg-[#1e1b14]"
                    : "border border-white/10 bg-[#14161e]"
                }`}
              >
                <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                {isHandUp && (
                  <div className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                    <Hand size={13} className="animate-bounce" />
                    <span>Hand Raised</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[11px] text-white font-medium flex items-center gap-1.5">
                  <span className={isHandUp ? "text-amber-300 font-bold" : ""}>
                    {t.participant?.name || "Participant"}
                  </span>
                  {isHandUp && <Hand size={12} className="text-amber-400 animate-bounce" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING INSTRUCTOR WEBCAM PIP (SLIDES / WHITEBOARD)
// ─────────────────────────────────────────────────────────────────────────────
function FloatingCamPiP({ isTeacher }: { isTeacher: boolean }) {
  const [minimized, setMinimized] = useState(false);
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

  return (
    <div className="absolute top-16 sm:top-20 right-4 z-40 flex flex-col items-end gap-1 pointer-events-auto">
      <div
        className="rounded-2xl overflow-hidden border border-white/20 bg-[#111318]/90 shadow-2xl backdrop-blur-md transition-all duration-200"
        style={{ width: minimized ? "140px" : "210px" }}
      >
        <div className="flex items-center justify-between px-2.5 py-1 bg-black/50 text-white/70 text-[10px] font-bold">
          <span>Speaker Camera</span>
          <button onClick={() => setMinimized(!minimized)} className="hover:text-white">
            {minimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          </button>
        </div>
        {!minimized && (
          <div className="h-28 sm:h-32 bg-black relative">
            <ParticipantTile trackRef={target} style={{ width: "100%", height: "100%" }} />
          </div>
        )}
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
  isImmersed,
  isHandRaised,
  unreadChatCount,
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
  isImmersed: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
  recordingStatus?: "idle" | "recording" | "paused" | "saving";
  recordingDuration?: number;
  onStartRecording?: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
  onStopRecording?: () => void;
  onToggleHand: () => void;
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
      } else if (micProps.onClick) {
        micProps.onClick(e as any);
      }
    } catch (err) {
      console.warn("Direct microphone toggle failed, running fallback:", err);
      micProps.onClick?.(e as any);
    }
  };

  const handleToggleCam = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (room?.localParticipant) {
        await room.localParticipant.setCameraEnabled(!camOn);
      } else if (camProps.onClick) {
        camProps.onClick(e as any);
      }
    } catch (err) {
      console.warn("Direct camera toggle failed, running fallback:", err);
      camProps.onClick?.(e as any);
    }
  };

  return (
    <footer
      className="h-16 sm:h-20 shrink-0 bg-[#111318] border-t border-white/10 px-3 flex items-center justify-center gap-2 sm:gap-4 z-30"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {/* Microphone Toggle */}
      {isWebinar && !isTeacher ? (
        <div
          className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold text-[10px] sm:text-xs select-none"
          title="Webinar attendees are in listen-only mode. Use Raise Hand to request speaking permission."
        >
          <MicOff size={18} />
          <span>Listen Only</span>
        </div>
      ) : (
        <button
          {...micProps}
          onClick={handleToggleMic}
          className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer ${micOn
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          <span>{micOn ? "Mute" : "Unmute"}</span>
        </button>
      )}

      {/* Camera Toggle */}
      {isWebinar && !isTeacher ? (
        <div
          className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold text-[10px] sm:text-xs select-none"
          title="Webcam streaming is disabled for webinar attendees to maintain stage focus."
        >
          <VideoOff size={18} />
          <span>Audience</span>
        </div>
      ) : (
        <button
          {...camProps}
          onClick={handleToggleCam}
          className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer ${camOn
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}
        >
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          <span>{camOn ? "Camera" : "Cam Off"}</span>
        </button>
      )}

      {/* Screen Share (Teacher / Desktop priority) */}
      {isTeacher && (
        <button
          {...screenProps}
          className={`hidden sm:flex flex-col items-center justify-center gap-1 min-w-[72px] h-14 rounded-2xl font-bold text-xs transition-transform active:scale-95 ${screenOn
              ? "bg-blue-600 text-white"
              : "bg-white/10 text-white hover:bg-white/15"
            }`}
        >
          {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
          <span>{screenOn ? "Stop Share" : "Share"}</span>
        </button>
      )}

      {/* Recording Controls (Presenter/Teacher/Admin) */}
      {isTeacher && (
        <>
          {recordingStatus === "idle" && (
            <button
              onClick={onStartRecording}
              className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-white/10 hover:bg-rose-500/20 hover:border hover:border-rose-500/30 text-white hover:text-rose-300 font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer"
              title="Record session (screen + audio)"
            >
              <Circle size={18} className="fill-rose-500 text-rose-500" />
              <span>Record</span>
            </button>
          )}

          {recordingStatus === "recording" && (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-rose-950/70 border border-rose-500/50">
              <button
                onClick={onPauseRecording}
                className="flex flex-col items-center justify-center gap-1 min-w-[50px] sm:min-w-[60px] h-11 sm:h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer"
                title="Pause recording"
              >
                <Pause size={16} />
                <span>Pause</span>
              </button>
              <button
                onClick={onStopRecording}
                className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[68px] h-11 sm:h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 shadow cursor-pointer"
                title="End recording and save file"
              >
                <Square size={14} className="fill-white" />
                <span>End & Save</span>
              </button>
            </div>
          )}

          {recordingStatus === "paused" && (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-amber-950/70 border border-amber-500/50">
              <button
                onClick={onResumeRecording}
                className="flex flex-col items-center justify-center gap-1 min-w-[50px] sm:min-w-[60px] h-11 sm:h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 shadow cursor-pointer"
                title="Resume recording"
              >
                <Play size={16} className="fill-white" />
                <span>Resume</span>
              </button>
              <button
                onClick={onStopRecording}
                className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[68px] h-11 sm:h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 shadow cursor-pointer"
                title="End recording and save file"
              >
                <Square size={14} className="fill-white" />
                <span>End & Save</span>
              </button>
            </div>
          )}

          {recordingStatus === "saving" && (
            <div className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-[10px] sm:text-xs">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span>Saving...</span>
            </div>
          )}
        </>
      )}

      {/* Student Hand Raise Toggle */}
      {!isTeacher && (
        <button
          onClick={onToggleHand}
          className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 ${
            isHandRaised
              ? "bg-amber-500 text-black shadow-lg"
              : isWebinar
              ? "bg-purple-600/30 text-purple-200 border border-purple-500/40 hover:bg-purple-600/40"
              : "bg-white/10 text-white hover:bg-white/15"
          }`}
          title={isHandRaised ? "Lower hand" : isWebinar ? "Raise hand to ask speaker a question" : "Raise hand"}
        >
          <Hand size={18} className={isHandRaised ? "animate-bounce" : ""} />
          <span>{isHandRaised ? "Lower" : isWebinar ? "Raise Hand" : "Hand"}</span>
        </button>
      )}

      {/* Chat Button (Hidden during immersion mode to eliminate clutter) */}
      {!isImmersed && (
        <button
          onClick={onToggleChat}
          className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-white/10 text-white hover:bg-white/15 font-bold text-[10px] sm:text-xs relative transition-transform active:scale-95"
        >
          <MessageSquare size={18} />
          <span>{isWebinar ? "Q&A / Chat" : "Chat"}</span>
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-2 h-4 w-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>
      )}

      {/* Leave Button */}
      <button
        onClick={onLeave}
        className="flex flex-col items-center justify-center gap-1 min-w-[62px] sm:min-w-[78px] h-12 sm:h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 shadow-lg"
      >
        <LogOut size={18} />
        <span>{isWebinar ? "Exit" : "Leave"}</span>
      </button>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT & FILES PANELS
// ─────────────────────────────────────────────────────────────────────────────
function ChatContentPanel({
  messages,
  onSendMessage,
}: {
  messages: ChatMessage[];
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/30 p-4">
            <MessageSquare size={28} />
            <p className="text-xs">No questions yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`p-2.5 rounded-2xl border text-xs ${m.role === "Teacher"
                  ? "bg-blue-600/15 border-blue-500/30 text-white"
                  : "bg-white/5 border-white/10 text-white/90"
                }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1 opacity-70">
                <span className="font-bold">{m.sender}</span>
                <span>{m.timestamp}</span>
              </div>
              <p className="break-words leading-relaxed">{m.text}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2 bg-[#0e1015]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 transition-colors"
        >
          <Send size={15} />
        </button>
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
}: any) {
  const room = useRoomContext();
  const participants = useParticipants();

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
              if (meta.isHost === true || meta.role === "TEACHER" || meta.role === "SUPER_ADMIN" || meta.role === "CENTRE_ADMIN") {
                isSenderHost = true;
              }
            } catch { }
          }
        }

        if (data.type === "STAGE_MODE_CHANGE" && data.mode) {
          if (!isSenderHost) return;
          setStageMode(data.mode);
        } else if (data.type === "WHITEBOARD_PERMISSION") {
          if (!isSenderHost) return;
          setAllowStudentWhiteboardDraw(!!data.allowStudentDraw);
        } else if (data.type === "CHAT_MESSAGE") {
          setChatMessages((prev: any) => [...prev, data]);
          if (activeTabRef.current !== "chat") {
            setUnreadChatCount((prev: number) => prev + 1);
          }
          onNewChatMessage?.(data);
        } else if (data.type === "FILE_SHARED") {
          const newFile = { name: data.name, url: data.url };
          setSharedFiles((prev: any) => [...prev, newFile]);
          onNewFileShared?.(newFile);
        } else if (data.type === "MUTE_STUDENT" && !isTeacher) {
          if (!isSenderHost) return;
          const myLocalId = room?.localParticipant?.identity;
          if (data.identity === myLocalId || data.identity === myIdentity) {
            room.localParticipant?.setMicrophoneEnabled(false).catch(() => {});
          }
        } else if (data.type === "MUTE_ALL" && !isTeacher) {
          if (!isSenderHost) return;
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
            onNewHandRaise?.(targetName, targetId);
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

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [
    room,
    isTeacher,
    myIdentity,
    setStageMode,
    setAllowStudentWhiteboardDraw,
    setChatMessages,
    setSharedFiles,
    activeTabRef,
    setUnreadChatCount,
    setRaisedHandsList,
    setIsHandRaised,
    setBreakState,
    onNewChatMessage,
    onNewFileShared,
    onNewHandRaise,
  ]);

  return null;
}
