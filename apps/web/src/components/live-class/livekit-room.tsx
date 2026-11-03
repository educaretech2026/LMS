"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
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
  Trash2, Edit3, SlidersHorizontal, X,
} from "lucide-react";
import { StudioDrawer } from "./studio-drawer";
import { IntermissionStage } from "./intermission-stage";
import { StudioSettings, BreakState, DEFAULT_STUDIO_SETTINGS } from "./studio-types";
import { StudioVideoProcessor } from "./studio-pipeline";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

interface LiveKitRoomProps {
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

/**
 * Safely publishes data over LiveKit data channel without throwing or breaking PC state
 */
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
      console.warn("Payload exceeds single packet threshold (byteLength):", bytes.byteLength);
      return false;
    }

    room.localParticipant.publishData(bytes, options).catch((err: any) => {
      // Gracefully swallow disconnect/publisher closed errors
      const msg = String(err?.message || "");
      if (!msg.includes("closed") && !msg.includes("not establish")) {
        console.warn("safePublishData async warning:", msg);
      }
    });
    return true;
  } catch {
    return false;
  }
}

/* ── STUDIO PIPELINE MANAGER (T1, T3, T7, T8) ── */
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

  // Keep processor settings in sync in real time
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateSettings(settings);
    }
  }, [settings, processorRef]);

  // Attach or detach processor based on whether any effect is enabled
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

export function LiveKitClassRoom({ roomId, identity, name, role, onLeave }: LiveKitRoomProps) {
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate a persistent, session-unique identity for this tab/client to prevent LiveKit duplicate identity kicks
  const sessionSuffix = useRef(Math.random().toString(36).slice(2, 7)).current;
  const effectiveIdentity = useMemo(() => {
    const raw = (identity || "user").trim();
    return `${raw}_${sessionSuffix}`;
  }, [identity, sessionSuffix]);

  const fetchToken = useCallback(async () => {
    try {
      const data = await fetchApi<TokenResponse>(
        `/live-class/token?roomId=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(effectiveIdentity)}&name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`
      );
      setTokenData(data);
    } catch (e: any) {
      setError(e.message || "Failed to connect to the classroom.");
    }
  }, [roomId, effectiveIdentity, name, role]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const showWhiteboardRef = useRef(false);
  useEffect(() => {
    showWhiteboardRef.current = showWhiteboard;
  }, [showWhiteboard]);

  const [whiteboardEverOpened, setWhiteboardEverOpened] = useState(false);
  const [allowStudentDraw, setAllowStudentDraw] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatMessagesRef = useRef<ChatMessage[]>(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const activeTabRef = useRef<"chat" | "files">(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [networkAlert, setNetworkAlert] = useState<string | null>(null);
  const [isUnexpectedDisconnect, setIsUnexpectedDisconnect] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Studio & Intermission State (T1 - T8)
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioSettings, setStudioSettings] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [breakState, setBreakState] = useState<BreakState | null>(null);
  const breakStateRef = useRef<BreakState | null>(null);
  useEffect(() => {
    breakStateRef.current = breakState;
  }, [breakState]);
  const studioProcessorRef = useRef<StudioVideoProcessor | null>(null);
  const recordingMicStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      recordingMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingMicStreamRef.current = null;
    };
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingAudioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tldrawEditorRef = useRef<any>(null);

  const isTeacher = role?.toUpperCase() !== "STUDENT" && role?.toUpperCase() !== "PUBLIC_LEARNER";

  // Re-calculate viewport screen bounds whenever whiteboard is displayed
  useEffect(() => {
    if (showWhiteboard) {
      const timer = setTimeout(() => {
        if (tldrawEditorRef.current) {
          try {
            tldrawEditorRef.current.updateViewportScreenBounds();
            window.dispatchEvent(new Event("resize"));
          } catch {}
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [showWhiteboard]);

  // High-performance Room Configuration
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
      maxRetries: 10,
    }),
    []
  );

  // High-fidelity Multi-source In-Browser Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as any);

      let finalAudioTrack: MediaStreamTrack | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          recordingAudioCtxRef.current = audioCtx;
          const dest = audioCtx.createMediaStreamDestination();
          let hasAudioSource = false;

          if (stream.getAudioTracks().length > 0) {
            const displaySrc = audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
            displaySrc.connect(dest);
            hasAudioSource = true;
          }

          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recordingMicStreamRef.current = micStream;
            if (micStream.getAudioTracks().length > 0) {
              const micSrc = audioCtx.createMediaStreamSource(micStream);
              micSrc.connect(dest);
              hasAudioSource = true;
            }
          } catch {}

          if (hasAudioSource && dest.stream.getAudioTracks().length > 0) {
            finalAudioTrack = dest.stream.getAudioTracks()[0];
          }
        }
      } catch (err) {
        console.warn("AudioContext mixing fallback", err);
      }

      const tracksToRecord = [
        ...stream.getVideoTracks(),
        ...(finalAudioTrack ? [finalAudioTrack] : stream.getAudioTracks()),
      ];
      const combinedStream = new MediaStream(tracksToRecord);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `educare-class-${new Date().toISOString().slice(0, 10)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        chunksRef.current = [];
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        recordingMicStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordingMicStreamRef.current = null;
        if (recordingAudioCtxRef.current?.state !== "closed") {
          recordingAudioCtxRef.current?.close();
        }
      };

      stream.getVideoTracks()[0].onended = () => recorder.stop();
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error("Recording initialization failed", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0b0c10]">
        <WifiOff className="h-10 w-10 text-red-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button
          onClick={fetchToken}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#0b0c10]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <p className="text-xs text-white/50">Establishing secure classroom session...</p>
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
        console.log("LiveKit disconnected with reason:", reason);
        if (reason === DisconnectReason.CLIENT_INITIATED) {
          onLeave();
        } else {
          // Unexpected disconnect (network reset, sctp interruption) - do NOT kick out, show reconnect prompt!
          setIsUnexpectedDisconnect(true);
        }
      }}
      className="h-full w-full flex flex-col relative"
      style={{ background: "#0b0c10" }}
    >
      <ClassroomLogic
        isTeacher={isTeacher}
        myIdentity={effectiveIdentity}
        setSharedFiles={setSharedFiles}
        setChatMessages={setChatMessages}
        chatMessagesRef={chatMessagesRef}
        setActiveTab={setActiveTab}
        activeTabRef={activeTabRef}
        setUnreadChatCount={setUnreadChatCount}
        showWhiteboardRef={showWhiteboardRef}
        setShowWhiteboard={setShowWhiteboard}
        setWhiteboardEverOpened={setWhiteboardEverOpened}
        allowStudentDraw={allowStudentDraw}
        setAllowStudentDraw={setAllowStudentDraw}
        setRaisedHands={setRaisedHands}
        setIsHandRaised={setIsHandRaised}
        setNetworkAlert={setNetworkAlert}
        tldrawEditorRef={tldrawEditorRef}
        breakStateRef={breakStateRef}
        setBreakState={setBreakState}
      />
      <StudioPipelineManager
        isTeacher={isTeacher}
        settings={studioSettings}
        processorRef={studioProcessorRef}
      />
      <RoomAudioRenderer />

      {/* Autoplay Audio Recovery Button */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
        <StartAudio
          label="🔊 Click here to enable classroom audio"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-full shadow-lg text-xs cursor-pointer transition-transform hover:scale-105"
        />
      </div>

      {/* Network Alert Notification */}
      {networkAlert && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs shadow-lg backdrop-blur-md">
          <AlertCircle size={14} className="animate-pulse" />
          <span>{networkAlert}</span>
        </div>
      )}

      {/* Unexpected Disconnection Guard Overlay */}
      {isUnexpectedDisconnect && (
        <div className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center gap-4 p-6 text-center backdrop-blur-md">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
            <AlertCircle size={28} />
          </div>
          <div className="max-w-md">
            <h3 className="text-white text-lg font-bold">Classroom Connection Interrupted</h3>
            <p className="text-white/60 text-xs mt-1">
              Your connection to the live classroom was momentarily lost. We can restore your session without leaving.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={async () => {
                if (isReconnecting) return;
                setIsReconnecting(true);
                try {
                  await fetchToken();
                  setIsUnexpectedDisconnect(false);
                } finally {
                  setIsReconnecting(false);
                }
              }}
              disabled={isReconnecting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <RefreshCw size={14} className={isReconnecting ? "animate-spin" : ""} />
              {isReconnecting ? "Reconnecting..." : "Reconnect Now"}
            </button>
            <button
              onClick={onLeave}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors"
            >
              Exit Class
            </button>
          </div>
        </div>
      )}

      {/* ── TOP HEADER ── */}
      <div
        className="flex items-center justify-between px-6 h-16 shrink-0 z-20"
        style={{ background: "#111318", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
          >
            <Video className="text-white h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-sm leading-tight">Edu-Meet Classroom</p>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: isTeacher ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)",
                  color: isTeacher ? "#60a5fa" : "#34d399",
                  border: `1px solid ${isTeacher ? "rgba(59,130,246,0.3)" : "rgba(16,185,129,0.3)"}`,
                }}
              >
                {isTeacher ? "Teacher Mode" : "Student"}
              </span>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Optimized Low-Latency Streaming
            </p>
          </div>
        </div>

        {/* Raised Hands Notice for Teacher */}
        {isTeacher && raisedHands.size > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
            <Hand size={14} />
            <span>{raisedHands.size} Student{raisedHands.size > 1 ? "s" : ""} Raised Hand</span>
            <button
              onClick={() => {
                const payload = JSON.stringify({ type: "LOWER_ALL_HANDS" });
                const room = (window as any).__lk_room;
                safePublishData(room, payload);
                setRaisedHands(new Set());
              }}
              className="ml-2 underline text-[11px] hover:text-white"
            >
              Lower All
            </button>
          </div>
        )}

        {isTeacher && (
          <TeacherControls
            showWhiteboard={showWhiteboard}
            setShowWhiteboard={setShowWhiteboard}
            setWhiteboardEverOpened={setWhiteboardEverOpened}
            allowStudentDraw={allowStudentDraw}
            setAllowStudentDraw={setAllowStudentDraw}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            tldrawEditorRef={tldrawEditorRef}
            isStudioOpen={isStudioOpen}
            setIsStudioOpen={setIsStudioOpen}
          />
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Stage & Whiteboard Canvas */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[#0b0c10]">
          {/* Main Video Stage (hidden when whiteboard is full screen) */}
          <div className="flex-1 relative overflow-hidden" style={{ display: showWhiteboard ? "none" : "block" }}>
            <ClassVideoGrid
              isTeacher={isTeacher}
              raisedHands={raisedHands}
              onMuteParticipant={(targetId) => {
                const room = (window as any).__lk_room;
                safePublishData(room, JSON.stringify({ type: "MUTE_STUDENT", targetId }));
              }}
            />
          </div>

          {/* Interactive Whiteboard with Floating Teacher Video */}
          {whiteboardEverOpened && (
            <div
              className="absolute inset-0 bg-white z-10"
              style={{
                display: showWhiteboard ? "block" : "none",
                width: "100%",
                height: "100%",
              }}
            >
              <Whiteboard
                isTeacher={isTeacher}
                roomId={roomId}
                editorRef={tldrawEditorRef}
                allowStudentDraw={allowStudentDraw}
              />

              {/* Floating Picture-in-Picture Mini Video Dock */}
              <FloatingVideoDock />
            </div>
          )}

          {/* ── BREAK / INTERMISSION STAGE OVERLAY (T6) ── */}
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

          {/* ── TEACHER LIVE STUDIO DRAWER (T1 – T8) ── */}
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

        {/* ── RIGHT COLLAPSIBLE SIDEBAR (CHAT & SHARED FILES) ── */}
        <div
          className={`w-80 shrink-0 flex flex-col ${
            isMobileChatOpen
              ? "flex fixed inset-y-0 right-0 z-50 shadow-2xl bg-[#111318]"
              : "hidden md:flex"
          }`}
          style={{ background: "#111318", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Tab Navigation */}
          <div
            className="flex items-center border-b shrink-0 px-2 pt-2"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => {
                setActiveTab("chat");
                setUnreadChatCount(0);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === "chat"
                  ? "border-blue-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white"
              }`}
            >
              <MessageSquare size={14} />
              <span>Live Chat</span>
              {unreadChatCount > 0 && activeTab !== "chat" && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                activeTab === "files"
                  ? "border-blue-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white"
              }`}
            >
              <FileText size={14} />
              <span>Files</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                {sharedFiles.length}
              </span>
            </button>

            {isMobileChatOpen && (
              <button
                onClick={() => setIsMobileChatOpen(false)}
                className="md:hidden p-2 text-white/50 hover:text-white ml-1"
                title="Close chat"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Tab Content: Live Chat */}
          {activeTab === "chat" && (
            <LiveChatPanel
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
                const payload = JSON.stringify({ type: "CHAT_MESSAGE", ...newMsg });
                safePublishData(room, payload);
                setChatMessages((prev) => [...prev, newMsg]);
              }}
            />
          )}

          {/* Tab Content: Shared Files */}
          {activeTab === "files" && (
            <SharedFilesPanel sharedFiles={sharedFiles} />
          )}
        </div>
      </div>

      {/* ── BOTTOM CONTROL BAR ── */}
      <CustomControlBar
        isTeacher={isTeacher}
        isHandRaised={isHandRaised}
        unreadChatCount={unreadChatCount}
        isMobileChatOpen={isMobileChatOpen}
        onToggleChat={() => {
          setIsMobileChatOpen(!isMobileChatOpen);
          if (!isMobileChatOpen) setUnreadChatCount(0);
        }}
        onToggleHand={() => {
          const room = (window as any).__lk_room;
          const nextState = !isHandRaised;
          setIsHandRaised(nextState);
          const payload = JSON.stringify({
            type: "HAND_RAISE",
            identity: effectiveIdentity,
            name,
            raised: nextState,
          });
          safePublishData(room, payload);
          setRaisedHands((prev) => {
            const next = new Set(prev);
            if (nextState) next.add(effectiveIdentity);
            else next.delete(effectiveIdentity);
            return next;
          });
        }}
        onLeave={onLeave}
      />
    </LiveKitRoom>
  );
}

/* ── CLASS VIDEO GRID WITH STAGE SPOTLIGHT ── */
function ClassVideoGrid({
  isTeacher,
  raisedHands,
  onMuteParticipant,
}: {
  isTeacher: boolean;
  raisedHands: Set<string>;
  onMuteParticipant: (identity: string) => void;
}) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare && t.participant);
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera && t.participant);

  // Deduplicate camera tracks per participant: prioritize real published tracks over placeholders
  const uniqueCameraTracks = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    for (const t of cameraTracks) {
      const id = t.participant?.identity;
      if (!id) continue;
      const prev = map.get(id);
      if (!prev || (!prev.publication && t.publication)) {
        map.set(id, t);
      }
    }
    return Array.from(map.values());
  }, [cameraTracks]);

  if (screenTrack) {
    return (
      <div className="h-full w-full flex flex-col p-2 gap-2">
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl">
          <FocusLayout trackRef={screenTrack} style={{ height: "100%", width: "100%" }} />
          <div className="absolute top-3 left-3 bg-blue-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5 backdrop-blur-md">
            <Monitor size={13} />
            <span>Screen Presentation ({screenTrack.participant?.name || "Presenter"})</span>
          </div>
        </div>

        <div className="h-28 shrink-0 flex gap-2 overflow-x-auto pb-1 items-center px-1">
          {uniqueCameraTracks.map((track, i) => (
            <div
              key={track.participant?.identity || `cam-${i}`}
              className="w-44 h-full shrink-0 relative rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-md"
            >
              <ParticipantTile trackRef={track} style={{ width: "100%", height: "100%" }} />
              <TileOverlay
                trackRef={track}
                isTeacher={isTeacher}
                isHandRaised={Boolean(track.participant?.identity && raisedHands.has(track.participant.identity))}
                onMuteParticipant={onMuteParticipant}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-3 overflow-hidden">
      {uniqueCameraTracks.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-xs">Connecting audio and video...</p>
        </div>
      ) : (
        <div
          className="h-full w-full grid gap-3"
          style={{
            gridTemplateColumns:
              uniqueCameraTracks.length === 1
                ? "1fr"
                : uniqueCameraTracks.length === 2
                ? "repeat(2, 1fr)"
                : uniqueCameraTracks.length <= 4
                ? "repeat(2, 1fr)"
                : "repeat(auto-fit, minmax(280px, 1fr))",
            gridAutoRows: uniqueCameraTracks.length <= 2 ? "1fr" : "minmax(0, 1fr)",
          }}
        >
          {uniqueCameraTracks.map((track, i) => (
            <div
              key={track.participant?.identity || `cam-grid-${i}`}
              className="h-full w-full relative rounded-2xl overflow-hidden border border-white/10 bg-[#161820] shadow-lg group"
            >
              <ParticipantTile trackRef={track} style={{ width: "100%", height: "100%" }} />
              <TileOverlay
                trackRef={track}
                isTeacher={isTeacher}
                isHandRaised={Boolean(track.participant?.identity && raisedHands.has(track.participant.identity))}
                onMuteParticipant={onMuteParticipant}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TileOverlay({
  trackRef,
  isTeacher,
  isHandRaised,
  onMuteParticipant,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  isTeacher: boolean;
  isHandRaised: boolean;
  onMuteParticipant: (identity: string) => void;
}) {
  const participant = trackRef?.participant;
  const isSpeaking = useIsSpeaking(participant);

  if (!participant) return null;

  let roleLabel = "Student";
  try {
    if (participant.metadata) {
      const meta = JSON.parse(participant.metadata);
      if (meta.role) {
        roleLabel = ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"].includes(meta.role.toUpperCase())
          ? "Teacher"
          : "Student";
      }
    }
  } catch {}

  const isSelf = participant.isLocal;

  return (
    <ParticipantContext.Provider value={participant}>
      {/* Speaking Active Glow Border */}
      {isSpeaking && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-2xl pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10 transition-all" />
      )}

      {/* Top Left: Connection Quality Indicator */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md">
        <ConnectionQualityIndicator participant={participant} />
      </div>

      {/* Top Right: Hand Raised Alert */}
      {isHandRaised && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[11px] font-bold shadow-lg animate-bounce">
          <Hand size={12} />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Bottom Information Bar */}
      <div className="absolute bottom-2 inset-x-2 z-10 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs font-semibold truncate">
            {participant.name || participant.identity}
            {isSelf && " (You)"}
          </p>
          <span
            className="text-[10px] font-bold px-1.5 py-0.2 rounded"
            style={{
              background: roleLabel === "Teacher" ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.1)",
              color: roleLabel === "Teacher" ? "#93c5fd" : "rgba(255,255,255,0.6)",
            }}
          >
            {roleLabel}
          </span>
          {/* Live Mic Status Indicator */}
          <span className="flex items-center" title={participant.isMicrophoneEnabled ? "Microphone active" : "Microphone muted"}>
            {participant.isMicrophoneEnabled ? (
              <Mic size={12} className="text-emerald-400" />
            ) : (
              <MicOff size={12} className="text-red-400/80" />
            )}
          </span>
        </div>

        {/* Teacher Moderation Action: Mute Student */}
        {isTeacher && !isSelf && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMuteParticipant(participant.identity);
            }}
            title="Mute this student"
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors"
          >
            <MicOff size={12} />
          </button>
        )}
      </div>
    </ParticipantContext.Provider>
  );
}

/* ── FLOATING VIDEO DOCK IN WHITEBOARD MODE ── */
function FloatingVideoDock() {
  const [minimized, setMinimized] = useState(false);
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);

  const validTracks = tracks.filter((t) => t.participant);
  if (validTracks.length === 0) return null;

  // Prioritize showing instructor/teacher or remote presenter in whiteboard mode
  const targetTrack =
    validTracks.find((t) => {
      try {
        const meta = JSON.parse(t.participant?.metadata || "{}");
        return ["SUPER_ADMIN", "CENTRE_ADMIN", "TEACHER"].includes(meta.role?.toUpperCase());
      } catch {
        return false;
      }
    }) ||
    validTracks.find((t) => !t.participant?.isLocal) ||
    validTracks[0];

  if (!targetTrack || !targetTrack.participant) return null;

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1 pointer-events-auto">
      <div
        className="rounded-xl overflow-hidden border border-white/20 bg-[#111318]/90 shadow-2xl backdrop-blur-md transition-all duration-200"
        style={{ width: minimized ? "160px" : "240px" }}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10 text-white/70 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5">
            <Video size={12} className="text-blue-400" />
            Class Camera
          </span>
          <button
            onClick={() => setMinimized(!minimized)}
            className="hover:text-white transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>

        {!minimized && (
          <div className="h-36 relative overflow-hidden bg-black">
            <ParticipantTile trackRef={targetTrack} style={{ width: "100%", height: "100%" }} />
            <div className="absolute bottom-1.5 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-medium">
              {targetTrack.participant.name || "Instructor"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── LIVE CHAT SIDEBAR PANEL ── */
function LiveChatPanel({
  messages,
  onSendMessage,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/30">
            <MessageSquare size={32} />
            <p className="text-xs">No chat messages yet.</p>
            <p className="text-[11px] text-white/20">Ask questions or share thoughts here.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex flex-col p-2.5 rounded-xl border"
              style={{
                background: msg.role === "Teacher" ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)",
                borderColor: msg.role === "Teacher" ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white/90">{msg.sender}</span>
                  <span
                    className="text-[9px] font-bold px-1 rounded"
                    style={{
                      background: msg.role === "Teacher" ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.1)",
                      color: msg.role === "Teacher" ? "#93c5fd" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {msg.role}
                  </span>
                </div>
                <span className="text-[10px] text-white/40">{msg.timestamp}</span>
              </div>
              <p className="text-xs text-white/85 break-words">{msg.text}</p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2 bg-[#0e1015]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message or question..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/* ── SHARED FILES PANEL ── */
function SharedFilesPanel({ sharedFiles }: { sharedFiles: SharedFile[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
      {sharedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center text-white/30">
          <FileText className="h-10 w-10" />
          <p className="text-xs">No files shared yet in this session.</p>
        </div>
      ) : (
        sharedFiles.map((file, i) => (
          <a
            key={i}
            href={file.url}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl group transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(59,130,246,0.15)" }}
            >
              <FileText className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{file.name}</p>
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "rgba(96,165,250,0.8)" }}>
                <FileDown className="h-3 w-3" /> Download File
              </p>
            </div>
          </a>
        ))
      )}
    </div>
  );
}

/* ── CLASSROOM LOGIC & SYNCHRONIZATION ── */
function ClassroomLogic({
  isTeacher,
  myIdentity,
  setSharedFiles,
  setChatMessages,
  chatMessagesRef,
  setActiveTab,
  activeTabRef,
  setUnreadChatCount,
  showWhiteboardRef,
  setShowWhiteboard,
  setWhiteboardEverOpened,
  allowStudentDraw,
  setAllowStudentDraw,
  setRaisedHands,
  setIsHandRaised,
  setNetworkAlert,
  tldrawEditorRef,
  breakStateRef,
  setBreakState,
}: {
  isTeacher: boolean;
  myIdentity: string;
  setSharedFiles: React.Dispatch<React.SetStateAction<SharedFile[]>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatMessagesRef: React.MutableRefObject<ChatMessage[]>;
  setActiveTab: React.Dispatch<React.SetStateAction<"chat" | "files">>;
  activeTabRef: React.MutableRefObject<"chat" | "files">;
  setUnreadChatCount: React.Dispatch<React.SetStateAction<number>>;
  showWhiteboardRef: React.MutableRefObject<boolean>;
  setShowWhiteboard: React.Dispatch<React.SetStateAction<boolean>>;
  setWhiteboardEverOpened: React.Dispatch<React.SetStateAction<boolean>>;
  allowStudentDraw: boolean;
  setAllowStudentDraw: React.Dispatch<React.SetStateAction<boolean>>;
  setRaisedHands: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsHandRaised: React.Dispatch<React.SetStateAction<boolean>>;
  setNetworkAlert: React.Dispatch<React.SetStateAction<string | null>>;
  tldrawEditorRef: React.MutableRefObject<any>;
  breakStateRef: React.MutableRefObject<BreakState | null>;
  setBreakState: React.Dispatch<React.SetStateAction<BreakState | null>>;
}) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;
    (window as any).__lk_room = room;

    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "MUTE_ALL" && !isTeacher) {
          room.localParticipant.setMicrophoneEnabled(false).catch((err: any) => {
            console.warn("Could not mute microphone on MUTE_ALL:", err);
          });
          setNetworkAlert("Your microphone was muted by the teacher.");
          setTimeout(() => setNetworkAlert(null), 3500);
        } else if (data.type === "MUTE_STUDENT" && data.targetId === myIdentity) {
          room.localParticipant.setMicrophoneEnabled(false).catch((err: any) => {
            console.warn("Could not mute microphone on MUTE_STUDENT:", err);
          });
          setNetworkAlert("Your microphone was muted by the teacher.");
          setTimeout(() => setNetworkAlert(null), 3500);
        } else if (data.type === "FILE_SHARED") {
          setSharedFiles((prev) => [...prev, { name: data.name, url: data.url }]);
        } else if (data.type === "WHITEBOARD_TOGGLE") {
          if (data.state) setWhiteboardEverOpened(true);
          setShowWhiteboard(Boolean(data.state));
        } else if (data.type === "WHITEBOARD_PERMISSION") {
          setAllowStudentDraw(Boolean(data.allowStudentDraw));
        } else if (data.type === "WHITEBOARD_DELTA") {
          // Efficient differential delta syncing
          const editor = tldrawEditorRef.current;
          if (editor && data.changes) {
            try {
              editor.store.mergeRemoteChanges(() => {
                if (data.changes.added && Object.keys(data.changes.added).length > 0) {
                  editor.store.put(Object.values(data.changes.added));
                }
                if (data.changes.updated && Object.keys(data.changes.updated).length > 0) {
                  const toRecords = Object.values(data.changes.updated)
                    .map((u: any) => (Array.isArray(u) ? u[1] : u))
                    .filter(Boolean);
                  if (toRecords.length > 0) {
                    editor.store.put(toRecords);
                  }
                }
                if (data.changes.removed && Object.keys(data.changes.removed).length > 0) {
                  editor.store.remove(Object.keys(data.changes.removed));
                }
              });
            } catch (err) {
              console.error("Error applying remote whiteboard delta", err);
            }
          } else {
            // Queue pending delta if Tldraw is still initializing
            if (!(window as any).__lk_pending_whiteboard_deltas) {
              (window as any).__lk_pending_whiteboard_deltas = [];
            }
            (window as any).__lk_pending_whiteboard_deltas.push(data.changes);
          }
        } else if (data.type === "WHITEBOARD_CLEAR") {
          const editor = tldrawEditorRef.current;
          if (editor) {
            try {
              editor.store.mergeRemoteChanges(() => {
                const shapeIds = editor.store
                  .allRecords()
                  .filter((r: any) => r.typeName === "shape")
                  .map((r: any) => r.id);
                if (shapeIds.length > 0) {
                  editor.store.remove(shapeIds);
                }
              });
            } catch (err) {
              console.error("Error clearing whiteboard remotely", err);
            }
          }
        } else if (data.type === "REQUEST_WHITEBOARD_STATE" && isTeacher) {
          // 1. Send active break state to late-joining attendee
          if (breakStateRef.current?.isActive) {
            safePublishData(room, { type: "BREAK_STATE", ...breakStateRef.current });
          }

          // 2. Send recent chat history to late-joining attendee
          if (chatMessagesRef.current && chatMessagesRef.current.length > 0) {
            safePublishData(room, {
              type: "CHAT_HISTORY",
              messages: chatMessagesRef.current.slice(-50),
            });
          }

          // 3. Send active whiteboard state safely paced to prevent buffer overflow
          const editor = tldrawEditorRef.current;
          if (editor) {
            if (showWhiteboardRef.current) {
              const toggleMsg = JSON.stringify({ type: "WHITEBOARD_TOGGLE", state: true });
              safePublishData(room, toggleMsg);
            }

            const shapes = editor.store
              .allRecords()
              .filter((r: any) => r.typeName === "shape" || r.typeName === "asset" || r.typeName === "binding");

            const CHUNK_SIZE = 12;
            let chunkIdx = 0;
            for (let i = 0; i < shapes.length; i += CHUNK_SIZE) {
              const chunk = shapes.slice(i, i + CHUNK_SIZE);
              const delay = chunkIdx * 30; // 30ms pacing prevents socket buffer saturation
              chunkIdx++;
              setTimeout(() => {
                if (room.state === "connected") {
                  safePublishData(room, {
                    type: "WHITEBOARD_BATCH",
                    records: chunk,
                  });
                }
              }, delay);
            }
          }
        } else if (data.type === "WHITEBOARD_BATCH") {
          const editor = tldrawEditorRef.current;
          if (editor && Array.isArray(data.records)) {
            try {
              editor.store.mergeRemoteChanges(() => {
                editor.store.put(data.records);
              });
            } catch (err) {
              console.error("Error applying batch records", err);
            }
          }
        } else if (data.type === "CHAT_MESSAGE") {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          if (activeTabRef.current !== "chat") {
            setUnreadChatCount((prev) => prev + 1);
          }
        } else if (data.type === "CHAT_HISTORY" && Array.isArray(data.messages)) {
          setChatMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = data.messages.filter((m: ChatMessage) => m && m.id && !existingIds.has(m.id));
            if (newItems.length === 0) return prev;
            return [...prev, ...newItems].sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
          });
        } else if (data.type === "HAND_RAISE") {
          setRaisedHands((prev) => {
            const next = new Set(prev);
            if (data.raised) next.add(data.identity);
            else next.delete(data.identity);
            return next;
          });
        } else if (data.type === "LOWER_ALL_HANDS") {
          setRaisedHands(new Set());
          setIsHandRaised(false);
        } else if (data.type === "BREAK_STATE") {
          if (data.isActive) {
            setBreakState(data);
          } else {
            setBreakState(null);
          }
        }
      } catch (e) {
        console.error("Data parse error", e);
      }
    };

    const handleReconnecting = () => {
      setNetworkAlert("Network interrupted. Reconnecting to classroom...");
    };

    const handleReconnected = () => {
      setNetworkAlert("Connection restored successfully.");
      setTimeout(() => setNetworkAlert(null), 3000);
    };

    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);

    // If joining as student, request current room state (whiteboard, chat, breaks) after joining
    if (!isTeacher) {
      setTimeout(() => {
        safePublishData(room, JSON.stringify({ type: "REQUEST_WHITEBOARD_STATE" }));
      }, 1200);
    }

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      if (room.state !== "connected") {
        delete (window as any).__lk_room;
      }
    };
  }, [
    room,
    isTeacher,
    myIdentity,
    setSharedFiles,
    setChatMessages,
    chatMessagesRef,
    setActiveTab,
    activeTabRef,
    setShowWhiteboard,
    setWhiteboardEverOpened,
    setAllowStudentDraw,
    setRaisedHands,
    setIsHandRaised,
    setNetworkAlert,
    setUnreadChatCount,
    breakStateRef,
    setBreakState,
  ]);

  return null;
}

/* ── TEACHER CONTROLS ── */
function TeacherControls({
  showWhiteboard,
  setShowWhiteboard,
  setWhiteboardEverOpened,
  allowStudentDraw,
  setAllowStudentDraw,
  isRecording,
  startRecording,
  stopRecording,
  tldrawEditorRef,
  isStudioOpen,
  setIsStudioOpen,
}: any) {
  const room = useRoomContext();
  const [uploading, setUploading] = useState(false);

  const muteAll = () => {
    safePublishData(room, JSON.stringify({ type: "MUTE_ALL" }));
  };

  const toggleWhiteboard = () => {
    const newState = !showWhiteboard;
    setShowWhiteboard(newState);
    if (newState) setWhiteboardEverOpened(true);
    safePublishData(room, JSON.stringify({ type: "WHITEBOARD_TOGGLE", state: newState }));
  };

  const toggleStudentDraw = () => {
    const nextVal = !allowStudentDraw;
    setAllowStudentDraw(nextVal);
    safePublishData(room, JSON.stringify({ type: "WHITEBOARD_PERMISSION", allowStudentDraw: nextVal }));
  };

  const clearWhiteboard = () => {
    if (!confirm("Are you sure you want to clear the whiteboard for all participants?")) return;
    const editor = tldrawEditorRef.current;
    if (editor) {
      try {
        editor.store.mergeRemoteChanges(() => {
          const shapeIds = editor.store
            .allRecords()
            .filter((r: any) => r.typeName === "shape")
            .map((r: any) => r.id);
          if (shapeIds.length > 0) editor.store.remove(shapeIds);
        });
      } catch {}
    }
    safePublishData(room, JSON.stringify({ type: "WHITEBOARD_CLEAR" }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    setUploading(true);
    try {
      const res: any = await fetchApi(
        `/study-materials/upload-url?type=FILE&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      const { uploadUrl, finalUrl } = res;
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const payload = JSON.stringify({ type: "FILE_SHARED", name: file.name, url: finalUrl });
      safePublishData(room, payload);
    } catch (err) {
      console.error("File upload failed", err);
      alert("Failed to share file.");
    } finally {
      setUploading(false);
    }
  };

  const hdrBtn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s ease",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Studio Controls (T1 - T8) */}
      <button
        onClick={() => setIsStudioOpen(!isStudioOpen)}
        title="Toggle Studio Broadcasting Tools (Crop, Bitrate, Colors, Audio, Green Screen)"
        style={{
          ...hdrBtn,
          background: isStudioOpen ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.1)",
          color: isStudioOpen ? "#60a5fa" : "#fff",
          border: `1px solid ${isStudioOpen ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <SlidersHorizontal size={14} />
        Studio Tools
      </button>

      {/* Whiteboard Toggle */}
      <button
        onClick={toggleWhiteboard}
        style={{
          ...hdrBtn,
          background: showWhiteboard ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)",
          color: showWhiteboard ? "#f87171" : "#fff",
          border: `1px solid ${showWhiteboard ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        {showWhiteboard ? <MonitorOff size={14} /> : <MonitorUp size={14} />}
        {showWhiteboard ? "Close Board" : "Whiteboard"}
      </button>

      {/* Whiteboard Utility Controls (when open) */}
      {showWhiteboard && (
        <>
          <button
            onClick={toggleStudentDraw}
            title={allowStudentDraw ? "Students can draw (Click to lock)" : "Students view only (Click to allow drawing)"}
            style={{
              ...hdrBtn,
              background: allowStudentDraw ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)",
              color: allowStudentDraw ? "#34d399" : "rgba(255,255,255,0.7)",
              border: `1px solid ${allowStudentDraw ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <Edit3 size={13} />
            {allowStudentDraw ? "Students Drawing: ON" : "Allow Student Draw"}
          </button>

          <button
            onClick={clearWhiteboard}
            title="Clear canvas for everyone"
            style={{
              ...hdrBtn,
              background: "rgba(239,68,68,0.12)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <Trash2 size={13} />
            Clear Board
          </button>
        </>
      )}

      {/* Mute All */}
      <button
        onClick={muteAll}
        style={{
          ...hdrBtn,
          background: "rgba(255,255,255,0.08)",
          color: "#f87171",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <MicOff size={14} /> Mute All
      </button>

      {/* Record */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={{
          ...hdrBtn,
          background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.85)",
          color: isRecording ? "#f87171" : "#fff",
          border: isRecording ? "1px solid rgba(239,68,68,0.4)" : "none",
        }}
      >
        {isRecording ? <StopCircle size={14} /> : <Video size={14} />}
        {isRecording ? "Stop Rec" : "Record"}
      </button>

      {/* Share File */}
      <label
        style={{
          ...hdrBtn,
          background: "rgba(59,130,246,0.85)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Share File"}
        <input type="file" className="hidden" onChange={handleFileUpload} />
      </label>
    </div>
  );
}

/* ── CUSTOM BOTTOM CONTROL BAR ── */
function CustomControlBar({
  isTeacher,
  isHandRaised,
  unreadChatCount,
  isMobileChatOpen,
  onToggleChat,
  onToggleHand,
  onLeave,
}: {
  isTeacher: boolean;
  isHandRaised: boolean;
  unreadChatCount: number;
  isMobileChatOpen: boolean;
  onToggleChat: () => void;
  onToggleHand: () => void;
  onLeave: () => void;
}) {
  const { buttonProps: micProps, enabled: micOn } = useTrackToggle({ source: Track.Source.Microphone });
  const { buttonProps: camProps, enabled: camOn } = useTrackToggle({ source: Track.Source.Camera });
  const { buttonProps: screenProps, enabled: screenOn } = useTrackToggle({ source: Track.Source.ScreenShare });
  const { buttonProps: leaveProps } = useDisconnectButton({});

  const btnBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "8px 20px",
    borderRadius: "12px",
    cursor: "pointer",
    border: "none",
    transition: "background 0.15s, transform 0.1s",
    fontSize: "11px",
    fontWeight: 600,
    minWidth: "76px",
  };

  const activeBtn: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  };

  const mutedBtn: React.CSSProperties = {
    ...btnBase,
    background: "rgba(239,68,68,0.18)",
    color: "#f87171",
  };

  const leaveBtn: React.CSSProperties = {
    ...btnBase,
    background: "rgba(239,68,68,0.9)",
    color: "#fff",
  };

  return (
    <div
      className="h-20 flex items-center justify-center gap-3 shrink-0 z-20 px-2"
      style={{ background: "#111318", borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Microphone Toggle */}
      <button
        {...micProps}
        style={micOn ? activeBtn : mutedBtn}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        {micOn ? "Mute" : "Unmute"}
      </button>

      {/* Camera Toggle */}
      <button
        {...camProps}
        style={camOn ? activeBtn : mutedBtn}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        {camOn ? "Camera On" : "Camera Off"}
      </button>

      {/* Screen Share */}
      <button
        {...screenProps}
        style={
          screenOn
            ? { ...btnBase, background: "rgba(59,130,246,0.25)", color: "#60a5fa" }
            : activeBtn
        }
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {screenOn ? <MonitorOff size={20} /> : <Monitor size={20} />}
        {screenOn ? "Stop Share" : "Share Screen"}
      </button>

      {/* Mobile Chat Toggle Button */}
      <button
        onClick={onToggleChat}
        className="flex md:hidden flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl transition-all relative"
        style={isMobileChatOpen ? { ...btnBase, background: "rgba(59,130,246,0.25)", color: "#60a5fa" } : activeBtn}
      >
        <MessageSquare size={20} />
        <span className="text-[10px]">Chat</span>
        {unreadChatCount > 0 && !isMobileChatOpen && (
          <span className="absolute top-1 right-2 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Student Hand Raise Toggle */}
      {!isTeacher && (
        <button
          onClick={onToggleHand}
          style={
            isHandRaised
              ? { ...btnBase, background: "rgba(245,158,11,0.25)", color: "#f59e0b" }
              : activeBtn
          }
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <Hand size={20} />
          {isHandRaised ? "Lower Hand" : "Raise Hand"}
        </button>
      )}

      {/* Divider */}
      <div className="w-px h-10 mx-2" style={{ background: "rgba(255,255,255,0.1)" }} />

      {/* Leave Classroom */}
      <button
        {...leaveProps}
        onClick={(e) => {
          leaveProps.onClick?.(e);
          onLeave();
        }}
        style={leaveBtn}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgb(220,38,38)";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(239,68,68,0.9)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <LogOut size={20} />
        Leave
      </button>
    </div>
  );
}

/* ── SYNCHRONIZED INTERACTIVE WHITEBOARD ── */
const Whiteboard = memo(function Whiteboard({
  isTeacher,
  roomId,
  editorRef,
  allowStudentDraw,
}: {
  isTeacher: boolean;
  roomId: string;
  editorRef: React.MutableRefObject<any>;
  allowStudentDraw: boolean;
}) {
  const room = useRoomContext();
  const unsubRef = useRef<(() => void) | null>(null);
  const flushIntervalRef = useRef<any>(null);
  const pendingDeltasQueue = useRef<{ added: any; updated: any; removed: any }>({
    added: {},
    updated: {},
    removed: {},
  });

  // Filter helper: ONLY synchronize persistent document records (ignore pointer, cursor, camera, presence)
  const isDocRecord = (r: any) => {
    const type = r?.typeName;
    return type === "shape" || type === "asset" || type === "binding";
  };

  // Safe flush routine
  const flushPendingDeltas = useCallback(() => {
    try {
      if (!room || room.state !== "connected" || !room.localParticipant) {
        return;
      }

      const q = pendingDeltasQueue.current;
      const addedKeys = Object.keys(q.added);
      const updatedKeys = Object.keys(q.updated);
      const removedKeys = Object.keys(q.removed);

      if (addedKeys.length === 0 && updatedKeys.length === 0 && removedKeys.length === 0) {
        return;
      }

      // Snapshot and reset current queue
      const batch = { ...q };
      pendingDeltasQueue.current = { added: {}, updated: {}, removed: {} };

      // Helper to chunk records so we never exceed SCTP packet size
      const CHUNK_SIZE = 12;
      const chunks: { added: any; updated: any; removed: any }[] = [];

      let curChunk: { added: any; updated: any; removed: any } = { added: {}, updated: {}, removed: {} };
      let curCount = 0;

      for (const k of addedKeys) {
        curChunk.added[k] = batch.added[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      for (const k of updatedKeys) {
        curChunk.updated[k] = batch.updated[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      for (const k of removedKeys) {
        curChunk.removed[k] = batch.removed[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      if (curCount > 0) {
        chunks.push(curChunk);
      }

      // Transmit each chunk safely
      for (const ch of chunks) {
        const payload = JSON.stringify({
          type: "WHITEBOARD_DELTA",
          changes: ch,
        });
        const success = safePublishData(room, payload, { reliable: true });
        if (!success) {
          // If backpressure occurs, drop transient frame to protect connection from publisher crash
          console.warn("Whiteboard backpressure encountered; dropped transient delta to prevent connection drop");
          break;
        }
      }
    } catch (err) {
      console.warn("Whiteboard delta flush error", err);
    }
  }, [room]);

  // Periodic flush interval (every 80ms)
  useEffect(() => {
    flushIntervalRef.current = setInterval(flushPendingDeltas, 80);
    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
      }
      flushPendingDeltas();
    };
  }, [flushPendingDeltas]);

  const handleMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;

      // Clean up any stale listener from prior mount
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      const canDraw = isTeacher || allowStudentDraw;
      editor.updateInstanceState({ isReadonly: !canDraw });

      // Flush any queued deltas that arrived while Tldraw was mounting
      const pending = (window as any).__lk_pending_whiteboard_deltas;
      if (Array.isArray(pending) && pending.length > 0) {
        try {
          editor.store.mergeRemoteChanges(() => {
            for (const p of pending) {
              if (p?.added && Object.keys(p.added).length > 0) {
                editor.store.put(Object.values(p.added));
              }
              if (p?.updated && Object.keys(p.updated).length > 0) {
                const toRecords = Object.values(p.updated).map((u: any) =>
                  Array.isArray(u) ? u[1] : u
                );
                editor.store.put(toRecords);
              }
              if (p?.removed && Object.keys(p.removed).length > 0) {
                editor.store.remove(Object.keys(p.removed));
              }
            }
          });
        } catch (err) {
          console.warn("Error flushing pending deltas on mount", err);
        }
        (window as any).__lk_pending_whiteboard_deltas = [];
      }

      // Attach lightweight differential delta listener
      unsubRef.current = editor.store.listen(
        (entry: any) => {
          if (entry.source !== "user") return;
          const canUserDraw = isTeacher || allowStudentDraw;
          if (!canUserDraw) return;

          const { added, updated, removed } = entry.changes;

          // Only queue persistent document records (shape, asset, binding)
          if (added) {
            for (const [id, r] of Object.entries(added)) {
              if (isDocRecord(r)) pendingDeltasQueue.current.added[id] = r;
            }
          }
          if (updated) {
            for (const [id, r] of Object.entries(updated)) {
              const rec = Array.isArray(r) ? r[1] : r;
              if (isDocRecord(rec)) pendingDeltasQueue.current.updated[id] = r;
            }
          }
          if (removed) {
            for (const [id, r] of Object.entries(removed)) {
              if (isDocRecord(r)) pendingDeltasQueue.current.removed[id] = r;
            }
          }

          // Cap queue size to prevent buffer bloat
          const total =
            Object.keys(pendingDeltasQueue.current.added).length +
            Object.keys(pendingDeltasQueue.current.updated).length +
            Object.keys(pendingDeltasQueue.current.removed).length;
          if (total > 60) {
            pendingDeltasQueue.current.updated = {};
          }
        },
        { scope: "document", source: "user" }
      );

      setTimeout(() => {
        try {
          editor.updateViewportScreenBounds();
        } catch {}
      }, 100);
    },
    [isTeacher, allowStudentDraw, editorRef]
  );

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  // Update readonly state dynamically when allowStudentDraw changes
  useEffect(() => {
    if (editorRef.current) {
      const canDraw = isTeacher || allowStudentDraw;
      editorRef.current.updateInstanceState({ isReadonly: !canDraw });
    }
  }, [isTeacher, allowStudentDraw, editorRef]);

  return <Tldraw onMount={handleMount} />;
});
