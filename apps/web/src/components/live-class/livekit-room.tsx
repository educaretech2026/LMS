"use client";

import { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  ParticipantTile,
  GridLayout,
  useTrackToggle,
  useDisconnectButton,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { fetchApi } from "@/lib/api";
import {
  Loader2, WifiOff, FileDown, Upload, MicOff, StopCircle,
  Video, VideoOff, Mic, MonitorUp, MonitorOff, LogOut, FileText,
  Monitor, AlertCircle,
} from "lucide-react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { RoomEvent } from "livekit-client";

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

export function LiveKitClassRoom({ roomId, identity, name, role, onLeave }: LiveKitRoomProps) {
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const data = await fetchApi<TokenResponse>(
        `/live-class/token?roomId=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`
      );
      setTokenData(data);
    } catch (e: any) {
      setError(e.message || "Failed to connect to the classroom.");
    }
  }, [roomId, identity, name, role]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardEverOpened, setWhiteboardEverOpened] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<{ name: string; url: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0b0c10]">
        <WifiOff className="h-10 w-10 text-red-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button onClick={fetchToken} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-[#0b0c10]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <p className="text-xs text-white/50">Joining classroom...</p>
      </div>
    );
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as any);
      const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? { mimeType: "video/webm;codecs=vp9,opus" }
        : MediaRecorder.isTypeSupported("video/webm")
        ? { mimeType: "video/webm" }
        : {};
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `class-recording-${new Date().toISOString().split("T")[0]}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        chunksRef.current = [];
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
      };
      stream.getVideoTracks()[0].onended = () => recorder.stop();
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error("Recording failed", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
  };

  const isTeacher = role?.toUpperCase() !== "STUDENT";

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.wsUrl}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={onLeave}
      className="h-full w-full flex flex-col"
      style={{ background: "#0b0c10" }}
    >
      <ClassroomLogic setSharedFiles={setSharedFiles} setShowWhiteboard={setShowWhiteboard} setWhiteboardEverOpened={setWhiteboardEverOpened} />
      <RoomAudioRenderer />

      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between px-6 h-16 shrink-0"
        style={{ background: "#111318", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>
            <Video className="text-white h-4 w-4" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Live Classroom</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Educare LMS</p>
          </div>
        </div>

        {isTeacher && (
          <TeacherControls
            showWhiteboard={showWhiteboard}
            setShowWhiteboard={setShowWhiteboard}
            setWhiteboardEverOpened={setWhiteboardEverOpened}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
          />
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video + Whiteboard pane */}
        <div className="flex-1 relative overflow-hidden">
          {/* Video Grid — always mounted, hidden when whiteboard is showing */}
          <div
            className="absolute inset-0"
            style={{ display: showWhiteboard ? 'none' : 'block' }}
          >
            <ClassVideoGrid />
          </div>

          {/* Whiteboard — only mounted once opened, then kept alive with visibility */}
          {whiteboardEverOpened && (
            <div
              className="absolute inset-0 bg-white"
              style={{ 
                display: showWhiteboard ? 'block' : 'none',
                width: '100%',
                height: '100%',
              }}
            >
              <Whiteboard isTeacher={isTeacher} roomId={roomId} />
            </div>
          )}
        </div>

        {/* ── SHARED FILES SIDEBAR ── */}
        <div className="w-72 shrink-0 flex flex-col hidden sm:flex"
          style={{ background: "#111318", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              <span className="text-white text-sm font-semibold">Shared Files</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-blue-300"
              style={{ background: "rgba(59,130,246,0.15)" }}>
              {sharedFiles.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {sharedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center"
                style={{ color: "rgba(255,255,255,0.25)" }}>
                <FileText className="h-10 w-10" />
                <p className="text-xs">No files shared yet</p>
              </div>
            ) : (
              sharedFiles.map((file, i) => (
                <a key={i} href={file.url} download target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl group transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(59,130,246,0.15)" }}>
                    <FileText className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{file.name}</p>
                    <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "rgba(96,165,250,0.8)" }}>
                      <FileDown className="h-3 w-3" /> Download
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <CustomControlBar onLeave={onLeave} />
    </LiveKitRoom>
  );
}

/* ── VIDEO GRID ── */
function ClassVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  return (
    <GridLayout tracks={tracks} style={{ height: "100%", width: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/* ── CUSTOM BOTTOM CONTROL BAR ── */
function CustomControlBar({ onLeave }: { onLeave: () => void }) {
  const { buttonProps: micProps, enabled: micOn } = useTrackToggle({ source: Track.Source.Microphone });
  const { buttonProps: camProps, enabled: camOn } = useTrackToggle({ source: Track.Source.Camera });
  const { buttonProps: screenProps, enabled: screenOn } = useTrackToggle({ source: Track.Source.ScreenShare });
  const { buttonProps: leaveProps } = useDisconnectButton({});

  const btnBase: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "4px", padding: "8px 20px", borderRadius: "12px", cursor: "pointer",
    border: "none", transition: "background 0.15s, transform 0.1s",
    fontSize: "11px", fontWeight: 600, minWidth: "72px",
  };

  const activeBtn: React.CSSProperties = {
    ...btnBase, background: "rgba(255,255,255,0.12)", color: "#fff",
  };

  const mutedBtn: React.CSSProperties = {
    ...btnBase, background: "rgba(239,68,68,0.18)", color: "#f87171",
  };

  const leaveBtn: React.CSSProperties = {
    ...btnBase, background: "rgba(239,68,68,0.9)", color: "#fff",
  };

  return (
    <div className="h-20 flex items-center justify-center gap-3 shrink-0"
      style={{ background: "#111318", borderTop: "1px solid rgba(255,255,255,0.08)" }}>

      {/* Mic */}
      <button {...micProps} style={micOn ? activeBtn : mutedBtn}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
        {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        {micOn ? "Mute" : "Unmute"}
      </button>

      {/* Camera */}
      <button {...camProps} style={camOn ? activeBtn : mutedBtn}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
        {camOn ? <Video size={20} /> : <VideoOff size={20} />}
        {camOn ? "Camera On" : "Camera Off"}
      </button>

      {/* Screen Share */}
      <button {...screenProps} style={screenOn ? { ...btnBase, background: "rgba(59,130,246,0.25)", color: "#60a5fa" } : activeBtn}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
        {screenOn ? <MonitorOff size={20} /> : <Monitor size={20} />}
        {screenOn ? "Stop Share" : "Share Screen"}
      </button>

      {/* Spacer */}
      <div className="w-px h-10 mx-2" style={{ background: "rgba(255,255,255,0.1)" }} />

      {/* Leave */}
      <button {...leaveProps} onClick={onLeave} style={leaveBtn}
        onMouseEnter={e => { e.currentTarget.style.background = "rgb(220,38,38)"; e.currentTarget.style.transform = "scale(1.05)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.9)"; e.currentTarget.style.transform = "scale(1)"; }}>
        <LogOut size={20} />
        Leave
      </button>
    </div>
  );
}

/* ── CLASSROOM LOGIC (data channel listener) ── */
function ClassroomLogic({
  setSharedFiles,
  setShowWhiteboard,
  setWhiteboardEverOpened,
}: {
  setSharedFiles: React.Dispatch<React.SetStateAction<any[]>>;
  setShowWhiteboard: React.Dispatch<React.SetStateAction<boolean>>;
  setWhiteboardEverOpened: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "MUTE_ALL") {
          room.localParticipant.setMicrophoneEnabled(false);
        } else if (data.type === "MUTE_STUDENT" && data.targetId === room.localParticipant.identity) {
          room.localParticipant.setMicrophoneEnabled(false);
        } else if (data.type === "FILE_SHARED") {
          setSharedFiles((prev) => [...prev, { name: data.name, url: data.url }]);
        } else if (data.type === "WHITEBOARD_TOGGLE") {
          if (data.state) setWhiteboardEverOpened(true);
          setShowWhiteboard(data.state);
        }
      } catch (e) {
        console.error("Data parse error", e);
      }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, setSharedFiles, setShowWhiteboard, setWhiteboardEverOpened]);

  return null;
}

/* ── TEACHER CONTROLS (in header) ── */
function TeacherControls({ showWhiteboard, setShowWhiteboard, setWhiteboardEverOpened, isRecording, startRecording, stopRecording }: any) {
  const room = useRoomContext();
  const [uploading, setUploading] = useState(false);

  const muteAll = () => {
    if (!room) return;
    const payload = JSON.stringify({ type: "MUTE_ALL" });
    room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  const toggleWhiteboard = () => {
    const newState = !showWhiteboard;
    setShowWhiteboard(newState);
    if (newState) setWhiteboardEverOpened(true); // lazy mount on first open
    if (room) {
      const payload = JSON.stringify({ type: "WHITEBOARD_TOGGLE", state: newState });
      room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    }
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
      room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    } catch (err) {
      console.error("File upload failed", err);
      alert("Failed to share file.");
    } finally {
      setUploading(false);
    }
  };

  const hdrBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
    borderRadius: "10px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
    border: "none", transition: "opacity 0.15s",
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggleWhiteboard} style={{
        ...hdrBtn,
        background: showWhiteboard ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)",
        color: showWhiteboard ? "#f87171" : "#fff",
        border: `1px solid ${showWhiteboard ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)"}`,
      }}>
        {showWhiteboard ? <MonitorOff size={14} /> : <MonitorUp size={14} />}
        {showWhiteboard ? "Close Board" : "Whiteboard"}
      </button>

      <button onClick={muteAll} style={{
        ...hdrBtn, background: "rgba(255,255,255,0.08)", color: "#f87171",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <MicOff size={14} /> Mute All
      </button>

      <button onClick={isRecording ? stopRecording : startRecording} style={{
        ...hdrBtn,
        background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.85)",
        color: isRecording ? "#f87171" : "#fff",
        border: isRecording ? "1px solid rgba(239,68,68,0.4)" : "none",
      }}>
        {isRecording ? <StopCircle size={14} /> : <Video size={14} />}
        {isRecording ? "Stop Rec" : "Record"}
      </button>

      <label style={{
        ...hdrBtn, background: "rgba(59,130,246,0.85)", color: "#fff",
        cursor: "pointer",
      }}>
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Share File"}
        <input type="file" className="hidden" onChange={handleFileUpload} />
      </label>
    </div>
  );
}

/* ── WHITEBOARD (Memoized to prevent crashes on re-render) ── */
const Whiteboard = memo(function Whiteboard({ isTeacher, roomId }: { isTeacher: boolean, roomId: string }) {
  const handleMount = useCallback((editor: any) => {
    if (!isTeacher) {
      editor.updateInstanceState({ isReadonly: true });
    }
    // @ts-ignore
    setTimeout(() => { try { editor.updateViewportScreenBounds(); } catch(e) {} }, 100);
  }, [isTeacher]);

  return <Tldraw onMount={handleMount} />;
});
