"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo, Component, ReactNode } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext,
  useTracks,
  ParticipantTile,
  ParticipantContext,
  FocusLayout,
  ConnectionQualityIndicator,
  useTrackToggle,
  useDisconnectButton,
  useLocalParticipant,
  useIsSpeaking,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Track,
  RoomOptions,
  RoomConnectOptions,
  VideoPresets,
  RoomEvent,
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
  PenTool, MoreHorizontal, Info, Clock
} from "lucide-react";
import { StudioDrawer } from "./studio-drawer";
import { IntermissionStage } from "./intermission-stage";
import { StudioSettings, BreakState, DEFAULT_STUDIO_SETTINGS } from "./studio-types";
import { StudioVideoProcessor } from "./studio-pipeline";
import { PresentationDeck } from "./presentation-deck";
import { MobileSheet } from "./mobile-sheet";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

interface LiveKitRoomV2Props {
  classId?: string;
  roomId: string;
  identity: string;
  name: string;
  role: string;
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

export type ClassroomStageMode = "grid" | "slides" | "whiteboard";

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
      localVideoTrack.stopProcessor().catch(() => {});
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
  onLeave,
}: LiveKitRoomV2Props) {
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

  // Class & Teacher Controls
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [studioSettings, setStudioSettings] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [breakState, setBreakState] = useState<BreakState | null>(null);
  const [networkAlert, setNetworkAlert] = useState<string | null>(null);
  const [isUnexpectedDisconnect, setIsUnexpectedDisconnect] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // Mobile More Popover
  const [showMobileMore, setShowMobileMore] = useState<boolean>(false);

  // Refs
  const tldrawEditorRef = useRef<any>(null);
  const studioProcessorRef = useRef<StudioVideoProcessor | null>(null);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  chatMessagesRef.current = chatMessages;
  const activeTabRef = useRef<"chat" | "files">(activeSidebarTab);
  activeTabRef.current = activeSidebarTab;
  const breakStateRef = useRef<BreakState | null>(breakState);
  breakStateRef.current = breakState;

  const normalizedRole = (role || "").toUpperCase();
  const isTeacher = ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN"].includes(normalizedRole);

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

      const regToken =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("regToken")
          : null;

      let res: TokenResponse;
      if (regToken && classId) {
        // Public webinar attendee using cryptographic registration token
        res = await fetchApi<TokenResponse>(
          `/live-class/public/${classId}/token?registrationToken=${encodeURIComponent(
            regToken
          )}&name=${encodeURIComponent(name || "")}`
        );
      } else {
        const query = new URLSearchParams({
          roomId: roomId || "",
          identity: effectiveIdentity,
          name: name || "",
          role: normalizedRole || "STUDENT",
        });
        if (classId) {
          query.set("classId", classId);
        }
        res = await fetchApi<TokenResponse>(
          `/live-class/token?${query.toString()}`
        );
      }

      setTokenData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load classroom security token");
    } finally {
      setLoading(false);
    }
  }, [classId, roomId, effectiveIdentity, name, normalizedRole]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Fetch Pre-attached Files & Initial Chat History for this Live Class
  useEffect(() => {
    if (!classId) return;
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
      .catch(() => {});

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
      .catch(() => {});
  }, [classId]);

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
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 bg-[#0b0c10] text-white p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertCircle size={24} />
        </div>
        <div className="max-w-sm">
          <h3 className="text-sm font-bold">Classroom Entry Failed</h3>
          <p className="text-xs text-white/50 mt-1">{error || "Could not retrieve access credentials."}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchToken}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold shadow-md transition-colors"
          >
            Retry Connection
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white/80 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      key={tokenData.token}
      token={tokenData.token}
      serverUrl={tokenData.wsUrl}
      connect={true}
      video={true}
      audio={true}
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
        setRaisedHands={setRaisedHands}
        setIsHandRaised={setIsHandRaised}
        setNetworkAlert={setNetworkAlert}
        breakStateRef={breakStateRef}
        setBreakState={setBreakState}
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
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Video size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-white font-bold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-xs">
                Edu-Meet Class
              </h2>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  isTeacher
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {isTeacher ? "Teacher" : "Student"}
              </span>
            </div>
            <p className="text-[10px] text-white/40 hidden sm:block">HD Interactive Lecture</p>
          </div>
        </div>

        {/* Center: Stage Mode Switcher (Camera Grid / Presentation Slides / Whiteboard) */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => {
              setStageMode("grid");
              if (isTeacher) {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "grid" });
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              stageMode === "grid"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">Camera</span>
          </button>

          <button
            onClick={() => {
              setStageMode("slides");
              if (isTeacher) {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all relative ${
              stageMode === "slides"
                ? "bg-blue-600 text-white shadow-sm"
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
              if (isTeacher) {
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "whiteboard" });
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              stageMode === "whiteboard"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <PenTool size={14} />
            <span className="hidden sm:inline">Board</span>
          </button>
        </div>

        {/* Right: Teacher Studio & Moderation Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isTeacher && raisedHands.size > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse">
              <Hand size={13} />
              <span>{raisedHands.size}</span>
              <button
                onClick={() => {
                  const room = (window as any).__lk_room;
                  safePublishData(room, { type: "LOWER_ALL_HANDS" });
                  setRaisedHands(new Set());
                }}
                className="ml-1 text-[10px] underline hover:text-white"
              >
                Lower
              </button>
            </div>
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
                    }).catch(() => {});
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
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  breakState?.isActive
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
          {/* Mode 1: Camera Grid Stage */}
          <div className={`h-full w-full ${stageMode === "grid" ? "block" : "hidden"}`}>
            <V2ClassVideoGrid
              isTeacher={isTeacher}
              classId={classId}
              raisedHands={raisedHands}
            />
          </div>

          {/* Mode 2: Interactive Slides Deck (NEW) */}
          <div className={`h-full w-full relative ${stageMode === "slides" ? "block" : "hidden"}`}>
            <PresentationDeck
              isTeacher={isTeacher}
              classId={classId}
              room={(window as any).__lk_room}
              myIdentity={effectiveIdentity}
              myName={name || "Participant"}
              initialFiles={sharedFiles}
              allowStudentDraw={allowStudentSlideDraw}
              onToggleStudentDraw={setAllowStudentSlideDraw}
            />
            {/* Draggable Camera PiP */}
            <FloatingCamPiP isTeacher={isTeacher} />
          </div>

          {/* Mode 3: Synchronized Whiteboard */}
          <div className={`h-full w-full relative bg-white ${stageMode === "whiteboard" ? "block" : "hidden"}`}>
            <Tldraw
              onMount={(editor) => {
                tldrawEditorRef.current = editor;
              }}
            />
            <FloatingCamPiP isTeacher={isTeacher} />
          </div>

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

        {/* ── DESKTOP COLLAPSIBLE SIDEBAR (CHAT & FILES) ── */}
        <aside className="w-80 shrink-0 hidden md:flex flex-col bg-[#111318] border-l border-white/10 z-20">
          <div className="flex items-center border-b border-white/10 shrink-0 px-2 pt-2">
            <button
              onClick={() => {
                setActiveSidebarTab("chat");
                setUnreadChatCount(0);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
                activeSidebarTab === "chat"
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
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-xl transition-colors border-b-2 ${
                activeSidebarTab === "files"
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
                    sender: name || "Anonymous",
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
                    }).catch(() => {});
                  }
                }}
              />
            ) : (
              <FilesContentPanel sharedFiles={sharedFiles} />
            )}
          </div>
        </aside>
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
              onSendMessage={(text) => {
                const room = (window as any).__lk_room;
                const newMsg: ChatMessage = {
                  id: Math.random().toString(36).slice(2, 9),
                  sender: name || "Anonymous",
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
                  }).catch(() => {});
                }
              }}
            />
          ) : (
            <FilesContentPanel sharedFiles={sharedFiles} />
          )}
        </div>
      </MobileSheet>

      {/* ── BOTTOM TOUCH-ENGINEERED CONTROL DOCK ── */}
      <V2BottomControlDock
        isTeacher={isTeacher}
        isHandRaised={isHandRaised}
        unreadChatCount={unreadChatCount}
        onToggleHand={() => {
          const room = (window as any).__lk_room;
          const next = !isHandRaised;
          setIsHandRaised(next);
          safePublishData(room, {
            type: "HAND_RAISE",
            identity: effectiveIdentity,
            name,
            raised: next,
          });
          setRaisedHands((prev) => {
            const copy = new Set(prev);
            if (next) copy.add(effectiveIdentity);
            else copy.delete(effectiveIdentity);
            return copy;
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
// VIDEO GRID COMPONENT WITH RESPONSIVE SPOTLIGHT
// ─────────────────────────────────────────────────────────────────────────────
function V2ClassVideoGrid({
  isTeacher,
  classId,
  raisedHands,
}: {
  isTeacher: boolean;
  classId?: string;
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

  // Screen Share Spotlight View
  if (screenTrack) {
    return (
      <div className="h-full w-full flex flex-col p-2 gap-2">
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
          <FocusLayout trackRef={screenTrack} style={{ height: "100%", width: "100%" }} />
          <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1.5 backdrop-blur-md">
            <Monitor size={13} />
            <span>Screen Presentation ({screenTrack.participant?.name || "Presenter"})</span>
          </div>
        </div>

        {/* Horizontal Filmstrip on Bottom */}
        <div className="h-24 sm:h-28 shrink-0 flex gap-2 overflow-x-auto pb-1 items-center px-1">
          {uniqueCameras.map((t, idx) => (
            <div
              key={t.participant?.identity || idx}
              className="w-36 sm:w-44 h-full shrink-0 relative rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-md"
            >
              <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Gallery Responsive Grid
  return (
    <div className="h-full w-full p-2 sm:p-4 overflow-hidden">
      {uniqueCameras.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-xs">Connecting audio and video...</p>
        </div>
      ) : (
        <div
          className={`h-full w-full grid gap-2 sm:gap-3 ${
            uniqueCameras.length === 1
              ? "grid-cols-1"
              : uniqueCameras.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : uniqueCameras.length <= 4
              ? "grid-cols-2"
              : "grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {uniqueCameras.map((t, i) => (
            <div
              key={t.participant?.identity || i}
              className="h-full w-full relative rounded-2xl overflow-hidden border border-white/10 bg-[#14161e] shadow-lg group"
            >
              <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[11px] text-white font-medium">
                {t.participant?.name || "Participant"}
              </div>
            </div>
          ))}
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
    <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-1 pointer-events-auto">
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
  isHandRaised,
  unreadChatCount,
  onToggleHand,
  onToggleChat,
  onLeave,
}: {
  isTeacher: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
  onToggleHand: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
}) {
  const { buttonProps: micProps, enabled: micOn } = useTrackToggle({ source: Track.Source.Microphone });
  const { buttonProps: camProps, enabled: camOn } = useTrackToggle({ source: Track.Source.Camera });
  const { buttonProps: screenProps, enabled: screenOn } = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <footer
      className="h-16 sm:h-20 shrink-0 bg-[#111318] border-t border-white/10 px-3 flex items-center justify-center gap-2 sm:gap-4 z-30"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {/* Microphone Toggle */}
      <button
        {...micProps}
        className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 ${
          micOn
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}
      >
        {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        <span>{micOn ? "Mute" : "Unmute"}</span>
      </button>

      {/* Camera Toggle */}
      <button
        {...camProps}
        className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 ${
          camOn
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}
      >
        {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        <span>{camOn ? "Camera" : "Cam Off"}</span>
      </button>

      {/* Screen Share (Desktop/Staff priority) */}
      <button
        {...screenProps}
        className={`hidden sm:flex flex-col items-center justify-center gap-1 min-w-[72px] h-14 rounded-2xl font-bold text-xs transition-transform active:scale-95 ${
          screenOn
            ? "bg-blue-600 text-white"
            : "bg-white/10 text-white hover:bg-white/15"
        }`}
      >
        {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
        <span>{screenOn ? "Stop Share" : "Share"}</span>
      </button>

      {/* Student Hand Raise Toggle */}
      {!isTeacher && (
        <button
          onClick={onToggleHand}
          className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 ${
            isHandRaised
              ? "bg-amber-500 text-black shadow-lg"
              : "bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          <Hand size={18} className={isHandRaised ? "animate-bounce" : ""} />
          <span>{isHandRaised ? "Lower" : "Hand"}</span>
        </button>
      )}

      {/* Chat Button (Mobile triggers bottom sheet, Desktop toggles) */}
      <button
        onClick={onToggleChat}
        className="flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl bg-white/10 text-white hover:bg-white/15 font-bold text-[10px] sm:text-xs relative transition-transform active:scale-95"
      >
        <MessageSquare size={18} />
        <span>Chat</span>
        {unreadChatCount > 0 && (
          <span className="absolute top-1 right-2 h-4 w-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Leave Button */}
      <button
        onClick={onLeave}
        className="flex flex-col items-center justify-center gap-1 min-w-[62px] sm:min-w-[78px] h-12 sm:h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] sm:text-xs transition-transform active:scale-95 shadow-lg"
      >
        <LogOut size={18} />
        <span>Leave</span>
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
              className={`p-2.5 rounded-2xl border text-xs ${
                m.role === "Teacher"
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

function FilesContentPanel({ sharedFiles }: { sharedFiles: SharedFile[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
      {sharedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/30 p-4">
          <FileText size={28} />
          <p className="text-xs">No attachments shared yet.</p>
        </div>
      ) : (
        sharedFiles.map((f, i) => (
          <a
            key={i}
            href={f.url}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/40 transition-colors group"
          >
            <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{f.name}</p>
              <p className="text-[10px] text-blue-400 flex items-center gap-1 mt-0.5">
                <FileDown size={11} /> Download
              </p>
            </div>
          </a>
        ))
      )}
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
  setRaisedHands,
  setIsHandRaised,
  setNetworkAlert,
  breakStateRef,
  setBreakState,
}: any) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;
    (window as any).__lk_room = room;

    const handleData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "STAGE_MODE_CHANGE" && data.mode) {
          setStageMode(data.mode);
        } else if (data.type === "CHAT_MESSAGE") {
          setChatMessages((prev: any) => [...prev, data]);
          if (activeTabRef.current !== "chat") {
            setUnreadChatCount((prev: number) => prev + 1);
          }
        } else if (data.type === "FILE_SHARED") {
          setSharedFiles((prev: any) => [...prev, { name: data.name, url: data.url }]);
        } else if (data.type === "MUTE_ALL" && !isTeacher) {
          const micPub = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
          if (micPub && !micPub.isMuted) {
            micPub.track?.mute();
          }
        } else if (data.type === "HAND_RAISE") {
          setRaisedHands((prev: Set<string>) => {
            const next = new Set(prev);
            if (data.raised) next.add(data.identity);
            else next.delete(data.identity);
            return next;
          });
        } else if (data.type === "LOWER_ALL_HANDS") {
          setRaisedHands(new Set());
          setIsHandRaised(false);
        } else if (data.type === "BREAK_STATE") {
          setBreakState(data.active !== undefined ? (data.active ? data : null) : (data.isActive ? data : null));
        }
      } catch {}
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [
    room,
    setStageMode,
    setChatMessages,
    activeTabRef,
    setUnreadChatCount,
    setRaisedHands,
    setIsHandRaised,
    setBreakState,
  ]);

  return null;
}
