export type AspectRatioPreset = "16:9" | "4:3" | "1:1" | "custom";

export interface CropSettings {
  enabled: boolean;
  zoom: number; // 1.0 to 3.0
  panX: number; // -50 to 50 (%)
  panY: number; // -50 to 50 (%)
  aspectRatio: AspectRatioPreset;
}

export interface ColorSettings {
  brightness: number; // 50% to 150% (default 100)
  contrast: number; // 50% to 150% (default 100)
  saturation: number; // 0% to 200% (default 100)
  warmth: number; // -50 to 50 (default 0)
  exposure: number; // -50 to 50 (default 0)
}

export interface ChromaKeySettings {
  enabled: boolean;
  keyColor: string; // hex, default "#00FF00"
  threshold: number; // 0.05 to 0.5, default 0.25
  smoothness: number; // 0.01 to 0.3, default 0.1
  backgroundPreset: "lecture_hall" | "library" | "dark_studio" | "custom";
  backgroundUrl: string;
}

export type BitratePreset = "saver" | "balanced" | "high" | "studio" | "custom";

export interface StudioSettings {
  crop: CropSettings;
  color: ColorSettings;
  mirror: boolean;
  chromaKey: ChromaKeySettings;
  bitratePreset: BitratePreset;
  customBitrateKbps: number;
  selectedMicId: string;
  selectedSpeakerId: string;
}

export type BreakMediaType = "BANNER" | "VIDEO" | "ANNOUNCEMENT";

export interface BreakState {
  isActive: boolean;
  durationMinutes: number;
  startedAt: number;
  endsAt: number;
  mediaType: BreakMediaType;
  mediaUrl: string;
  title: string;
  message: string;
}

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  crop: {
    enabled: false,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    aspectRatio: "16:9",
  },
  color: {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 0,
    exposure: 0,
  },
  mirror: false,
  chromaKey: {
    enabled: false,
    keyColor: "#00FF00",
    threshold: 0.25,
    smoothness: 0.1,
    backgroundPreset: "lecture_hall",
    backgroundUrl: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1280&q=80",
  },
  bitratePreset: "balanced",
  customBitrateKbps: 750,
  selectedMicId: "",
  selectedSpeakerId: "",
};

export const CHROMA_PRESET_BACKGROUNDS: Record<string, { label: string; url: string }> = {
  lecture_hall: {
    label: "University Amphitheater",
    url: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1280&q=80",
  },
  library: {
    label: "Modern Academic Library",
    url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1280&q=80",
  },
  dark_studio: {
    label: "Executive Dark Studio",
    url: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1280&q=80",
  },
};

