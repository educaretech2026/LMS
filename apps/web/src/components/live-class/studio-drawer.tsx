"use client";

import { useEffect, useState, useRef } from "react";
import {
  StudioSettings,
  BitratePreset,
  BreakState,
  BreakMediaType,
  CHROMA_PRESET_BACKGROUNDS,
} from "./studio-types";
import {
  applySenderBitrate,
  AudioMeterManager,
  playTestChime,
} from "./studio-pipeline";
import {
  SlidersHorizontal,
  X,
  Camera,
  Volume2,
  Coffee,
  Crop,
  Sun,
  Palette,
  FlipHorizontal,
  Layers,
  Gauge,
  Mic,
  Monitor,
  RefreshCw,
  Play,
  RotateCcw,
  Sparkles,
  VolumeX,
} from "lucide-react";
import { Track } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";

interface StudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: any;
  settings: StudioSettings;
  onUpdateSettings: (newSettings: StudioSettings) => void;
  breakState: BreakState | null;
  onStartBreak: (state: BreakState) => void;
  onEndBreak: () => void;
  onExtendBreak: (mins: number) => void;
}

export function StudioDrawer({
  isOpen,
  onClose,
  room,
  settings,
  onUpdateSettings,
  breakState,
  onStartBreak,
  onEndBreak,
  onExtendBreak,
}: StudioDrawerProps) {
  const contextRoom = useRoomContext();
  const activeRoom = room || contextRoom || (typeof window !== "undefined" ? (window as any).__lk_room : null);

  const [activeTab, setActiveTab] = useState<"camera" | "audio" | "break">("camera");

  // Audio device enumeration & VU Meter (T4)
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [vuLevel, setVuLevel] = useState<number>(0);
  const audioMeterRef = useRef<AudioMeterManager | null>(null);

  // Break config inputs (T6)
  const [breakDuration, setBreakDuration] = useState<number>(5);
  const [breakTitle, setBreakTitle] = useState("Short Class Break");
  const [breakMessage, setBreakMessage] = useState("Admissions open for next academic cohort. Enroll today!");
  const [breakMediaType, setBreakMediaType] = useState<BreakMediaType>("BANNER");
  const [breakMediaUrl, setBreakMediaUrl] = useState(
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1280&q=80"
  );

  // Enumerate devices on mount
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicrophones(devices.filter((d) => d.kind === "audioinput"));
      setSpeakers(devices.filter((d) => d.kind === "audiooutput"));
    } catch (err) {
      console.warn("Could not enumerate audio devices:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDevices();
    }
  }, [isOpen]);

  // Start live VU meter on current mic track
  useEffect(() => {
    if (!isOpen || activeTab !== "audio" || !activeRoom) {
      audioMeterRef.current?.stop();
      return;
    }

    try {
      const pub = Array.from(activeRoom.localParticipant?.audioTrackPublications?.values() || []).find(
        (p: any) => p.source === Track.Source.Microphone
      ) as any;
      const track = pub?.track?.mediaStreamTrack;

      if (track) {
        const stream = new MediaStream([track]);
        const meter = new AudioMeterManager();
        meter.start(stream, (lvl) => setVuLevel(lvl));
        audioMeterRef.current = meter;
      }
    } catch (e) {
      console.warn("Could not bind VU meter:", e);
    }

    return () => {
      audioMeterRef.current?.stop();
    };
  }, [isOpen, activeTab, activeRoom, settings.selectedMicId]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof StudioSettings>(key: K, val: StudioSettings[K]) => {
    const next = { ...settings, [key]: val };
    onUpdateSettings(next);
  };

  const updateCrop = (updates: Partial<StudioSettings["crop"]>) => {
    updateSetting("crop", { ...settings.crop, ...updates });
  };

  const updateColor = (updates: Partial<StudioSettings["color"]>) => {
    updateSetting("color", { ...settings.color, ...updates });
  };

  const updateChroma = (updates: Partial<StudioSettings["chromaKey"]>) => {
    updateSetting("chromaKey", { ...settings.chromaKey, ...updates });
  };

  // Switch mic
  const handleSelectMic = async (deviceId: string) => {
    updateSetting("selectedMicId", deviceId);
    if (activeRoom && deviceId) {
      try {
        await activeRoom.switchActiveDevice("audioinput", deviceId);
      } catch (err) {
        console.warn("Failed to switch mic:", err);
      }
    }
  };

  // Switch speaker
  const handleSelectSpeaker = async (deviceId: string) => {
    updateSetting("selectedSpeakerId", deviceId);
    if (activeRoom && deviceId) {
      try {
        await activeRoom.switchActiveDevice("audiooutput", deviceId);
      } catch (err) {
        console.warn("Failed to switch speaker:", err);
      }
    }
  };

  // Bitrate Preset change (T2)
  const handleBitrateChange = async (preset: BitratePreset, customKbps?: number) => {
    const kbps = customKbps !== undefined ? customKbps : settings.customBitrateKbps;
    updateSetting("bitratePreset", preset);
    if (customKbps !== undefined) updateSetting("customBitrateKbps", customKbps);
    await applySenderBitrate(activeRoom, preset, kbps);
  };

  // Desktop Audio Screen Share (T5)
  const handleShareScreenWithAudio = async () => {
    if (!activeRoom || !activeRoom.localParticipant) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        await activeRoom.localParticipant.publishTrack(videoTrack, { source: Track.Source.ScreenShare });
      }
      if (audioTrack) {
        await activeRoom.localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShareAudio });
      }
    } catch (e) {
      console.warn("Desktop audio share cancelled or failed", e);
    }
  };

  // Handle Break Start (T6)
  const handleTriggerBreak = () => {
    const now = Date.now();
    const ends = now + breakDuration * 60 * 1000;
    const newState: BreakState = {
      isActive: true,
      durationMinutes: breakDuration,
      startedAt: now,
      endsAt: ends,
      mediaType: breakMediaType,
      mediaUrl: breakMediaUrl,
      title: breakTitle,
      message: breakMessage,
    };
    onStartBreak(newState);
  };

  return (
    <div className="absolute top-16 left-0 bottom-20 w-84 z-40 bg-[#111318]/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Live Studio Controls</h3>
            <p className="text-[10px] text-white/50">T1 – T8 Advanced Broadcasting</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2 shrink-0 bg-black/20">
        <button
          onClick={() => setActiveTab("camera")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
            activeTab === "camera"
              ? "border-blue-500 text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <Camera size={13} /> Camera
        </button>
        <button
          onClick={() => setActiveTab("audio")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
            activeTab === "audio"
              ? "border-blue-500 text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <Volume2 size={13} /> Audio & Bitrate
        </button>
        <button
          onClick={() => setActiveTab("break")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
            activeTab === "break"
              ? "border-blue-500 text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <Coffee size={13} /> Break & Ads
        </button>
      </div>

      {/* Tab Contents (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-white/80">
        {/* ========================================================= */}
        {/* TAB 1: CAMERA STUDIO (T1, T3, T7, T8)                    */}
        {/* ========================================================= */}
        {activeTab === "camera" && (
          <>
            {/* T8: Mirror Effect */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlipHorizontal size={14} className="text-blue-400" />
                  <span className="font-semibold text-white">Mirror Camera Stream</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.mirror}
                    onChange={(e) => updateSetting("mirror", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-[10px] text-white/40">
                Flips horizontally for presenter gestures or un-mirrored physical text reading.
              </p>
            </div>

            {/* T1: Crop & Pan/Zoom Adjustment */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crop size={14} className="text-amber-400" />
                  <span className="font-semibold text-white">Crop & Pan / Zoom</span>
                </div>
                <button
                  onClick={() =>
                    updateCrop({
                      zoom: 1.0,
                      panX: 0,
                      panY: 0,
                      aspectRatio: "16:9",
                    })
                  }
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              </div>

              {/* Aspect Ratio Buttons */}
              <div>
                <p className="text-[10px] text-white/60 mb-1">Aspect Ratio Preset</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["16:9", "4:3", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => updateCrop({ aspectRatio: ratio })}
                      className={`py-1 rounded text-[10px] font-bold transition-colors ${
                        settings.crop.aspectRatio === ratio
                          ? "bg-amber-500 text-black"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Zoom Multiplier</span>
                  <span className="font-mono text-amber-400 font-bold">{settings.crop.zoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.1"
                  value={settings.crop.zoom}
                  onChange={(e) => updateCrop({ zoom: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>

              {/* Pan X Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Horizontal Pan (X)</span>
                  <span className="font-mono text-white/70">{settings.crop.panX}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={settings.crop.panX}
                  onChange={(e) => updateCrop({ panX: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>

              {/* Pan Y Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Vertical Pan (Y)</span>
                  <span className="font-mono text-white/70">{settings.crop.panY}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={settings.crop.panY}
                  onChange={(e) => updateCrop({ panY: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* T3: Colour Adjustment */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun size={14} className="text-emerald-400" />
                  <span className="font-semibold text-white">Colour Grading</span>
                </div>
                <button
                  onClick={() =>
                    updateColor({
                      brightness: 100,
                      contrast: 100,
                      saturation: 100,
                      warmth: 0,
                      exposure: 0,
                    })
                  }
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Brightness</span>
                  <span className="font-mono text-emerald-400">{settings.color.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={settings.color.brightness}
                  onChange={(e) => updateColor({ brightness: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Contrast</span>
                  <span className="font-mono text-emerald-400">{settings.color.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={settings.color.contrast}
                  onChange={(e) => updateColor({ contrast: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Saturation</span>
                  <span className="font-mono text-emerald-400">{settings.color.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={settings.color.saturation}
                  onChange={(e) => updateColor({ saturation: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>

              {/* Warmth / Color Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Warmth</span>
                  <span className="font-mono text-emerald-400">{settings.color.warmth > 0 ? `+${settings.color.warmth}` : settings.color.warmth}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={settings.color.warmth}
                  onChange={(e) => updateColor({ warmth: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* T7: Green Screen / Ultra Key */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-purple-400" />
                  <span className="font-semibold text-white">Ultra Key (Green Screen)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.chromaKey.enabled}
                    onChange={(e) => updateChroma({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {settings.chromaKey.enabled && (
                <div className="space-y-3 pt-1 border-t border-white/10">
                  {/* Key Color Picker */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Key Screen Color</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateChroma({ keyColor: "#00FF00" })}
                        className="px-2 py-0.5 rounded bg-green-500/30 border border-green-500/50 text-green-300 text-[10px] font-bold"
                      >
                        Green
                      </button>
                      <button
                        onClick={() => updateChroma({ keyColor: "#0000FF" })}
                        className="px-2 py-0.5 rounded bg-blue-500/30 border border-blue-500/50 text-blue-300 text-[10px] font-bold"
                      >
                        Blue
                      </button>
                      <input
                        type="color"
                        value={settings.chromaKey.keyColor}
                        onChange={(e) => updateChroma({ keyColor: e.target.value })}
                        className="h-6 w-6 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>

                  {/* Similarity Threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/60">Key Sensitivity</span>
                      <span className="font-mono text-purple-400">{settings.chromaKey.threshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.5"
                      step="0.01"
                      value={settings.chromaKey.threshold}
                      onChange={(e) => updateChroma({ threshold: parseFloat(e.target.value) })}
                      className="w-full accent-purple-500 h-1 bg-white/20 rounded cursor-pointer"
                    />
                  </div>

                  {/* Virtual Background Presets */}
                  <div className="space-y-1.5">
                    <span className="text-white/60">Virtual Studio Backdrop</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {Object.entries(CHROMA_PRESET_BACKGROUNDS).map(([key, bg]) => (
                        <button
                          key={key}
                          onClick={() =>
                            updateChroma({
                              backgroundPreset: key as any,
                              backgroundUrl: bg.url,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-left text-[11px] font-medium transition-colors flex items-center justify-between ${
                            settings.chromaKey.backgroundUrl === bg.url
                              ? "bg-purple-600 text-white font-bold"
                              : "bg-white/10 text-white/70 hover:bg-white/20"
                          }`}
                        >
                          <span>{bg.label}</span>
                          {settings.chromaKey.backgroundUrl === bg.url && <Sparkles size={11} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: AUDIO & BITRATE (T2, T4, T5)                      */}
        {/* ========================================================= */}
        {activeTab === "audio" && (
          <>
            {/* T4: Audio Input & Live VU Meter */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={14} className="text-blue-400" />
                  <span className="font-semibold text-white">Microphone Input</span>
                </div>
                <button
                  onClick={refreshDevices}
                  className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>

              {/* Mic Selector */}
              <select
                value={settings.selectedMicId}
                onChange={(e) => handleSelectMic(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Default Microphone</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Microphone (${mic.deviceId.slice(0, 5)}...)`}
                  </option>
                ))}
              </select>

              {/* Live VU Meter Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-white/50">
                  <span>Input Level VU</span>
                  <span className="font-mono text-blue-400 font-bold">{vuLevel}%</span>
                </div>
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 flex">
                  <div
                    className={`h-full transition-all duration-75 ${
                      vuLevel > 75
                        ? "bg-red-500"
                        : vuLevel > 40
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${vuLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* T4: Audio Output & Speaker Test */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-emerald-400" />
                <span className="font-semibold text-white">Speaker Output</span>
              </div>

              {/* Speaker Selector */}
              <select
                value={settings.selectedSpeakerId}
                onChange={(e) => handleSelectSpeaker(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Default Speaker</option>
                {speakers.map((spk) => (
                  <option key={spk.deviceId} value={spk.deviceId}>
                    {spk.label || `Speaker (${spk.deviceId.slice(0, 5)}...)`}
                  </option>
                ))}
              </select>

              {/* Test Chime Button */}
              <button
                onClick={() => playTestChime(settings.selectedSpeakerId)}
                className="w-full py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Volume2 size={12} /> Play Speaker Test Tone
              </button>
            </div>

            {/* T2: Upstream Bitrate Control */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Gauge size={14} className="text-amber-400" />
                <span className="font-semibold text-white">Upstream Bitrate Controller</span>
              </div>
              <p className="text-[10px] text-white/50">
                Adjusts video bandwidth dynamically to avoid stuttering on slower uplinks.
              </p>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "saver", label: "Saver (250k)", kbps: 250 },
                  { id: "balanced", label: "Balanced (750k)", kbps: 750 },
                  { id: "high", label: "High (1.5M)", kbps: 1500 },
                  { id: "studio", label: "Studio (3.0M)", kbps: 3000 },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleBitrateChange(item.id as BitratePreset, item.kbps)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-center transition-colors ${
                      settings.bitratePreset === item.id
                        ? "bg-amber-500 text-black shadow-md"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Bitrate Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/60">Custom Limit</span>
                  <span className="font-mono text-amber-400">{settings.customBitrateKbps} kbps</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="4000"
                  step="50"
                  value={settings.customBitrateKbps}
                  onChange={(e) => handleBitrateChange("custom", parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-white/20 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* T5: Desktop / System Audio Sharing */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <Monitor size={14} className="text-indigo-400" />
                <span className="font-semibold text-white">Desktop / Tab Audio</span>
              </div>
              <p className="text-[10px] text-white/50">
                Stream computer audio (YouTube, presentation videos, background music) directly into the classroom.
              </p>
              <button
                onClick={handleShareScreenWithAudio}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md transition-transform hover:scale-[1.02]"
              >
                <Monitor size={13} /> Share Screen + System Audio
              </button>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 3: BREAK & ADS (T6)                                  */}
        {/* ========================================================= */}
        {activeTab === "break" && (
          <div className="space-y-3">
            {breakState?.isActive ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-center">
                <div className="h-10 w-10 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Coffee size={20} className="animate-pulse" />
                </div>
                <h4 className="font-bold text-white text-sm">Class Break in Progress</h4>
                <p className="text-[11px] text-amber-200/80">
                  Students currently see the intermission screen and promotional showcase.
                </p>

                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => onExtendBreak(2)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold"
                  >
                    +2 Min
                  </button>
                  <button
                    onClick={() => onExtendBreak(5)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold"
                  >
                    +5 Min
                  </button>
                  <button
                    onClick={onEndBreak}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                  >
                    End Break Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Coffee size={14} className="text-amber-400" />
                  <span className="font-semibold text-white">Start Class Break / Intermission</span>
                </div>

                {/* Duration Buttons */}
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60">Break Duration</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 5, 10, 15].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setBreakDuration(mins)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                          breakDuration === mins
                            ? "bg-amber-500 text-black shadow-md"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Media Type */}
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60">Sponsor / Intermission Content</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(["BANNER", "VIDEO", "ANNOUNCEMENT"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setBreakMediaType(type)}
                        className={`py-1 rounded text-[9px] font-bold transition-colors ${
                          breakMediaType === type
                            ? "bg-blue-600 text-white"
                            : "bg-white/10 text-white/60 hover:bg-white/20"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Media URL */}
                {breakMediaType !== "ANNOUNCEMENT" && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-white/60">
                      {breakMediaType === "BANNER" ? "Banner Image URL" : "Promo Video (MP4) URL"}
                    </span>
                    <input
                      type="text"
                      value={breakMediaUrl}
                      onChange={(e) => setBreakMediaUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60">Break Title</span>
                  <input
                    type="text"
                    value={breakTitle}
                    onChange={(e) => setBreakTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1">
                  <span className="text-[10px] text-white/60">Announcements / Sponsor Text</span>
                  <textarea
                    rows={2}
                    value={breakMessage}
                    onChange={(e) => setBreakMessage(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Start Button */}
                <button
                  onClick={handleTriggerBreak}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-transform hover:scale-[1.02]"
                >
                  <Coffee size={14} /> Start {breakDuration}-Minute Break
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

