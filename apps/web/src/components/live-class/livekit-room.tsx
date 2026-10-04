"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  ParticipantTile,
  ControlBar,
  GridLayout,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { fetchApi } from "@/lib/api";
import { Loader2, WifiOff, FileDown, Upload, MicOff, StopCircle, Video, FileText, MonitorUp } from "lucide-react";
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
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white bg-[#0b0c10]">
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
        stream.getTracks().forEach(t => t.stop());
      };
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
      className="h-full w-full relative flex flex-col bg-[#0b0c10]"
      style={{
         "--lk-bg": "#0b0c10",
      } as React.CSSProperties}
    >
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-[#171923]/95 backdrop-blur-xl border-b border-white/10 z-[60] flex items-center justify-between px-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-brand-blue rounded-lg shadow-lg shadow-brand-blue/30 flex items-center justify-center">
            <Video className="text-white h-4 w-4" />
          </div>
          <div>
            <span className="text-white font-bold tracking-wide block text-sm">Live Classroom</span>
            <span className="text-gray-400 text-xs">Educare LMS</span>
          </div>
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
      </div>

      <ClassroomLogic setSharedFiles={setSharedFiles} setShowWhiteboard={setShowWhiteboard} />
      
      <div className="flex-1 flex overflow-hidden pt-16">
         {/* Main Content Area */}
         <div className="flex-1 relative bg-[#0b0c10]">
            {/* Videos - we wrap in a div that is always mounted, but styled visually hidden if whiteboard is up */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${showWhiteboard ? 'opacity-0 pointer-events-none z-0' : 'opacity-100 z-10'}`}>
               <VideoGrid />
            </div>
            
            {/* Whiteboard */}
            <div className={`absolute inset-0 bg-white transition-opacity duration-300 ${showWhiteboard ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}>
               <Tldraw persistenceKey={`educare-whiteboard-${roomId}`} onMount={(editor) => {
                 if (role?.toUpperCase() === 'STUDENT') {
                   editor.updateInstanceState({ isReadonly: true });
                 }
               }} />
            </div>
         </div>

         {/* Right Sidebar - Shared Files */}
         <div className="w-80 bg-[#11131a] border-l border-white/10 flex flex-col z-20 shadow-2xl shrink-0 hidden sm:flex">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
               <h3 className="text-white font-bold text-sm flex items-center gap-2">
                 <FileText className="h-4 w-4 text-brand-blue" />
                 Shared Files
               </h3>
               <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full font-semibold">{sharedFiles.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
               {sharedFiles.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 opacity-60">
                   <FileText className="h-10 w-10 mb-2" />
                   <p className="text-xs">No files shared yet.</p>
                 </div>
               ) : sharedFiles.map((file: any, i: number) => (
                 <div key={i} className="bg-white/5 rounded-xl p-3 flex items-start gap-3 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="h-10 w-10 bg-brand-blue/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate" title={file.name}>{file.name}</p>
                      <a href={file.url} download target="_blank" rel="noreferrer" className="text-[10px] text-brand-blue hover:text-brand-blue-dark hover:underline mt-1.5 flex items-center gap-1">
                        <FileDown className="h-3 w-3" /> Download
                      </a>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
      
      {/* Bottom Control Bar - using default LiveKit ControlBar without breaking its CSS */}
      <div className="h-20 bg-[#171923] border-t border-white/10 flex items-center justify-center relative z-50">
         <ControlBar controls={{ camera: true, microphone: true, screenShare: true, chat: false, leave: true }} />
      </div>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// Wrapper for the video grid
function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100vh - 144px)' }}>
      <ParticipantTile />
    </GridLayout>
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
      const res: any = await fetchApi(`/study-materials/upload-url?type=FILE&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);
      const { uploadUrl, finalUrl } = res;
      
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      
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
    <div className="flex items-center gap-3">
      <button 
        onClick={() => {
          const newState = !showWhiteboard;
          setShowWhiteboard(newState);
          if (room) {
            const payload = JSON.stringify({ type: "WHITEBOARD_TOGGLE", state: newState });
            room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
          }
        }}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${showWhiteboard ? 'bg-brand-red text-white hover:bg-brand-red/90' : 'bg-white text-gray-800 hover:bg-gray-100'}`}
      >
        <MonitorUp className="h-4 w-4" />
        {showWhiteboard ? 'Close Board' : 'Whiteboard'}
      </button>

      <button 
        onClick={muteAll}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10"
      >
        <MicOff className="h-4 w-4 text-brand-red" />
        Mute All
      </button>

      <button 
        onClick={isRecording ? stopRecording : startRecording}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${isRecording ? 'bg-white text-brand-red hover:bg-red-50' : 'bg-brand-red text-white hover:bg-brand-red/90'}`}
      >
        {isRecording ? <StopCircle className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {isRecording ? 'Stop Recording' : 'Record'}
      </button>

      <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-brand-blue text-white hover:bg-brand-blue-dark transition-all cursor-pointer shadow-sm">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Uploading...' : 'Share File'}
        <input type="file" className="hidden" onChange={handleFileUpload} />
      </label>
    </div>
  );
}
