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
  UserCheck, UserX, ChevronDown, Check, Search
} from "lucide-react";
import { StudioDrawer } from "./studio-drawer";
import { IntermissionStage } from "./intermission-stage";
import { StudioSettings, BreakState, DEFAULT_STUDIO_SETTINGS } from "./studio-types";
import { StudioVideoProcessor } from "./studio-pipeline";
import { PresentationDeck } from "./presentation-deck";
import { MobileSheet } from "./mobile-sheet";
import { PreJoinLobby } from "./pre-join-lobby";
import { SynchronizedWhiteboard } from "./synchronized-whiteboard";

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
  const isTeacher = ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN"].includes(normalizedRole);
  const isImmersed = !isTeacher && stageMode !== "grid";

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
          )}&name=${encodeURIComponent(confirmedDisplayName || name || "")}`
        );
      } else {
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

      setTokenData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load classroom security token");
    } finally {
      setLoading(false);
    }
  }, [classId, roomId, effectiveIdentity, confirmedDisplayName, name, normalizedRole]);

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

  // Google Meet–Style Pre-Join Welcome Screen
  if (!hasJoinedFromLobby) {
    return (
      <PreJoinLobby
        classTitle="Edu-Meet Interactive Virtual Classroom"
        subject="Live Cohort Session"
        teacherName="Educare Instructor"
        initialName={confirmedDisplayName || name || (isTeacher ? "Instructor" : "Student")}
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
              <h2 className="text-white font-bold text-xs sm:text-sm truncate max-w-[120px] sm:max-w-xs">
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

        {/* Center: Stage Switcher (Teacher Interactive) OR Mode Status Pill (Student Read-Only) */}
        {isTeacher ? (
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => {
                setStageMode("grid");
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "grid" });
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
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "slides" });
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
                const room = (window as any).__lk_room;
                safePublishData(room, { type: "STAGE_MODE_CHANGE", mode: "whiteboard" });
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
        ) : (
          /* Student Status Indicator */
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white/80 shadow-inner">
            {stageMode === "grid" && (
              <>
                <LayoutGrid size={13} className="text-emerald-400" />
                <span>Gallery View</span>
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
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                allowStudentWhiteboardDraw
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  raisedHandsList.length > 0
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
              title="Class Attendance & Attendee Roster"
            >
              <Users size={14} />
              <span className="hidden lg:inline">Attendance ({sessionAttendees.size})</span>
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

          {/* Stage Hand Raise Floating Badge for Teacher (Slides & Whiteboard) */}
          {isTeacher && stageMode !== "grid" && raisedHandsList.length > 0 && (
            <button
              onClick={() => setShowRaisedHandsPopover(true)}
              className="absolute top-16 left-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-lg backdrop-blur-md animate-pulse hover:bg-amber-500/30 transition-all pointer-events-auto"
            >
              <Hand size={14} />
              <span>{raisedHandsList.length} Hand{raisedHandsList.length > 1 ? "s" : ""} Raised</span>
            </button>
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
                      setShowRaisedHandsPopover(true);
                      setRecentHandRaiseAlert(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-200 text-[10px] font-bold border border-amber-500/40 cursor-pointer"
                  >
                    View
                  </button>
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
                      }).catch(() => {});
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
                  }).catch(() => {});
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
        />
      )}

      {/* ── BOTTOM TOUCH-ENGINEERED CONTROL DOCK ── */}
      <V2BottomControlDock
        isTeacher={isTeacher}
        isImmersed={isImmersed}
        isHandRaised={isHandRaised}
        unreadChatCount={unreadChatCount}
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
}: {
  isOpen: boolean;
  onClose: () => void;
  classId?: string;
  sessionAttendees: Map<string, SessionAttendee>;
}) {
  const [tab, setTab] = useState<"live" | "webinar">("live");
  const [search, setSearch] = useState("");
  const [webinarRegistrations, setWebinarRegistrations] = useState<any[]>([]);
  const [loadingWebinar, setLoadingWebinar] = useState(false);

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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === "live"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              Live Session Attendees ({attendeesArray.length})
            </button>
            {classId && (
              <button
                onClick={() => setTab("webinar")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  tab === "webinar"
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
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            a.role === "TEACHER" || a.role === "SUPER_ADMIN"
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
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.isOnline
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/10 text-white/40"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              a.isOnline ? "bg-emerald-400 animate-pulse" : "bg-white/30"
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
          {uniqueCameras.map((t, i) => {
            const id = t.participant?.identity || "";
            const isHandUp = raisedHands.has(id);
            return (
              <div
                key={id || i}
                className="h-full w-full relative rounded-2xl overflow-hidden border border-white/10 bg-[#14161e] shadow-lg group"
              >
                <ParticipantTile trackRef={t} style={{ width: "100%", height: "100%" }} />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[11px] text-white font-medium flex items-center gap-1.5">
                  <span>{t.participant?.name || "Participant"}</span>
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
  isImmersed,
  isHandRaised,
  unreadChatCount,
  onToggleHand,
  onToggleChat,
  onLeave,
}: {
  isTeacher: boolean;
  isImmersed: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
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
      <button
        {...micProps}
        onClick={handleToggleMic}
        className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer ${
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
        onClick={handleToggleCam}
        className={`flex flex-col items-center justify-center gap-1 min-w-[58px] sm:min-w-[72px] h-12 sm:h-14 rounded-2xl font-bold text-[10px] sm:text-xs transition-transform active:scale-95 cursor-pointer ${
          camOn
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}
      >
        {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        <span>{camOn ? "Camera" : "Cam Off"}</span>
      </button>

      {/* Screen Share (Teacher / Desktop priority) */}
      {isTeacher && (
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
      )}

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

      {/* Chat Button (Hidden during immersion mode to eliminate clutter) */}
      {!isImmersed && (
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
      )}

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
        } catch {}

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
            } catch {}
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
        } else if (data.type === "MUTE_ALL" && !isTeacher) {
          if (!isSenderHost) return;
          const micPub = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
          if (micPub && !micPub.isMuted) {
            micPub.track?.mute();
          }
        } else if (data.type === "HAND_RAISE") {
          const targetId = data.identity || participant?.identity;
          const targetName = data.name || participant?.name || "Student";
          if (!targetId) return;

          setRaisedHandsList((prev: HandRaiseEntry[]) => {
            if (data.raised) {
              const existing = prev.find((h) => h.identity === targetId);
              if (existing) return prev;
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
        }
      } catch {}
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
