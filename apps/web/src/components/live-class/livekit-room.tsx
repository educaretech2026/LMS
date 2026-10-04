"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  TrackLoop,
  ParticipantTile,
  ControlBar,
  GridLayout,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { fetchApi } from "@/lib/api";
import { Loader2, WifiOff, FileDown, Upload, MicOff, StopCircle, Video, Play, Maximize, FileText, MonitorUp } from "lucide-react";
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
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

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<{name: string, url: string}[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
        <WifiOff className="h-10 w-10 text-red-400" />
        <p className="text-sm text-white/70">{error}</p>
        <button
          onClick={fetchToken}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white">
        <Loader2 className="h-7 w-7 animate-spin text-brand-blue" />
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
      
      // Let browser choose the best supported format
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? { mimeType: 'video/webm;codecs=vp9,opus' } 
        : MediaRecorder.isTypeSupported('video/webm')
        ? { mimeType: 'video/webm' }
        : MediaRecorder.isTypeSupported('video/mp4')
        ? { mimeType: 'video/mp4' }
        : {};
        
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `class-recording-${new Date().toISOString().split('T')[0]}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        chunksRef.current = [];
        setIsRecording(false);
        // Ensure tracks are stopped
        stream.getTracks().forEach(t => t.stop());
      };
      // If user stops sharing screen natively
      stream.getVideoTracks()[0].onended = () => {
        recorder.stop();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error("Recording failed to start", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
  };

  return (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={tokenData.wsUrl}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={onLeave}
      className="h-full w-full relative flex flex-col sm:flex-row"
      style={{ "--lk-bg": "#0f0f1a" } as React.CSSProperties}
    >
      <ClassroomLogic setSharedFiles={setSharedFiles} setShowWhiteboard={setShowWhiteboard} />
      
      <div className={`flex-1 transition-all flex flex-col ${showWhiteboard ? 'w-full sm:w-1/3 border-r border-white/10' : 'w-full'}`}>
        <VideoConference />
        <RoomAudioRenderer />
        
        {/* Shared Files Banner */}
        {sharedFiles.length > 0 && (
          <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 max-w-xs">
            {sharedFiles.map((file, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl flex items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-4 w-4 text-brand-blue shrink-0" />
                  <p className="text-white text-xs truncate font-medium">{file.name}</p>
                </div>
                <a href={file.url} download target="_blank" rel="noreferrer" className="shrink-0 h-7 w-7 rounded-full bg-brand-blue flex items-center justify-center hover:bg-brand-blue-dark transition-colors">
                  <FileDown className="h-3.5 w-3.5 text-white" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className={`w-full sm:w-2/3 h-[50vh] sm:h-full bg-white relative ${showWhiteboard ? 'block' : 'hidden'}`}>
        <Tldraw onMount={(editor) => {
          if (role?.toUpperCase() === 'STUDENT') {
            editor.updateInstanceState({ isReadonly: true });
          }
        }} />
      </div>

      {/* Custom Control overlay for Teacher */}
      {role?.toUpperCase() !== 'STUDENT' && (
        <TeacherControls 
          showWhiteboard={showWhiteboard} 
          setShowWhiteboard={setShowWhiteboard} 
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
        />
      )}
    </LiveKitRoom>
  );
}

// Logic component that uses Room context
function ClassroomLogic({ setSharedFiles, setShowWhiteboard }: { setSharedFiles: React.Dispatch<React.SetStateAction<any[]>>, setShowWhiteboard: React.Dispatch<React.SetStateAction<boolean>> }) {
  const room = useRoomContext();
  
  useEffect(() => {
    if (!room) return;
    
    const handleData = (payload: Uint8Array, participant?: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "MUTE_ALL") {
          room.localParticipant.setMicrophoneEnabled(false);
        } else if (data.type === "MUTE_STUDENT" && data.targetId === room.localParticipant.identity) {
          room.localParticipant.setMicrophoneEnabled(false);
        } else if (data.type === "FILE_SHARED") {
          setSharedFiles(prev => [...prev, { name: data.name, url: data.url }]);
        } else if (data.type === "WHITEBOARD_TOGGLE") {
          setShowWhiteboard(data.state);
        }
      } catch (e) {
        console.error("Failed to parse data message", e);
      }
    };
    
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, setSharedFiles, setShowWhiteboard]);

  return null;
}

function TeacherControls({ showWhiteboard, setShowWhiteboard, isRecording, startRecording, stopRecording }: any) {
  const room = useRoomContext();
  const [uploading, setUploading] = useState(false);
  
  const muteAll = () => {
    if (!room) return;
    const payload = JSON.stringify({ type: "MUTE_ALL" });
    room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    
    setUploading(true);
    try {
      // 1. Get presigned url
      const res: any = await fetchApi(`/study-materials/upload-url?type=FILE&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);
      const { uploadUrl, finalUrl } = res;
      
      // 2. Upload to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      
      // 3. Broadcast to room
      const payload = JSON.stringify({ type: "FILE_SHARED", name: file.name, url: finalUrl });
      room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      
    } catch (err) {
      console.error("File upload failed", err);
      alert("Failed to share file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[60] flex flex-col gap-2">
      <button 
        onClick={() => {
          const newState = !showWhiteboard;
          setShowWhiteboard(newState);
          if (room) {
            const payload = JSON.stringify({ type: "WHITEBOARD_TOGGLE", state: newState });
            room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
          }
        }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${showWhiteboard ? 'bg-brand-red text-white hover:bg-brand-red/90' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
      >
        <MonitorUp className="h-4 w-4" />
        {showWhiteboard ? 'Close Board' : 'Whiteboard'}
      </button>

      <button 
        onClick={muteAll}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg bg-gray-800 text-white hover:bg-gray-700 transition-all border border-gray-700"
      >
        <MicOff className="h-4 w-4 text-brand-red" />
        Mute All
      </button>

      <button 
        onClick={isRecording ? stopRecording : startRecording}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${isRecording ? 'bg-white text-brand-red hover:bg-red-50' : 'bg-brand-red text-white hover:bg-brand-red/90'}`}
      >
        {isRecording ? <StopCircle className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {isRecording ? 'Stop Recording' : 'Record Class'}
      </button>

      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-all cursor-pointer">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading...' : 'Share File'}
        <input type="file" className="hidden" onChange={handleFileUpload} />
      </label>
    </div>
  );
}
