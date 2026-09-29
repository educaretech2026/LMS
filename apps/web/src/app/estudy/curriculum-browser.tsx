"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, ChevronDown, ChevronRight, Video, FileText, Link as LinkIcon,
  Download, Play, ExternalLink, BookMarked, Brain, ClipboardList, Loader2,
  GraduationCap, AlertCircle, X, Star, Zap, BarChart2, Trash2
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopicMaterial {
  id: string;
  title: string;
  type: "PDF" | "VIDEO" | "LINK" | "DOCUMENT";
  url?: string;
  thumbnailUrl?: string;
  uploader?: { firstName: string; lastName: string };
  createdAt: string;
}

interface TopicExam {
  id: string;
  title: string;
  type: "MCQ_EXAM" | "MOCK_TEST";
  mcqQuestions: { id: string }[];
}

interface Topic {
  id: string;
  name: string;
  difficulty?: string;
  examImportance?: string;
  materials?: TopicMaterial[];
  exams?: TopicExam[];
  loadingContent?: boolean;
}

interface Chapter {
  id: string;
  name: string;
  topics?: Topic[];
  isExpanded?: boolean;
  isLoadingTopics?: boolean;
}

// ─── Content type metadata ────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { key: "VIDEO",    label: "Videos",         icon: Video,        color: "bg-blue-50 text-blue-600 border-blue-200",   pill: "bg-blue-600" },
  { key: "PDF",      label: "Notes",          icon: FileText,     color: "bg-red-50 text-red-600 border-red-200",      pill: "bg-red-600" },
  { key: "DOCUMENT", label: "Lecture Notes",  icon: BookMarked,   color: "bg-amber-50 text-amber-600 border-amber-200",pill: "bg-amber-500" },
  { key: "LINK",     label: "Resources",      icon: LinkIcon,     color: "bg-purple-50 text-purple-600 border-purple-200", pill: "bg-purple-600" },
  { key: "MOCK_TEST",label: "Practice Papers",icon: ClipboardList,color: "bg-green-50 text-green-600 border-green-200",pill: "bg-green-600" },
  { key: "MCQ_EXAM", label: "Quizzes",        icon: Brain,        color: "bg-indigo-50 text-indigo-600 border-indigo-200", pill: "bg-indigo-600" },
];

// ─── Difficulty / Importance badge ───────────────────────────────────────────

function DifficultyBadge({ value }: { value?: string }) {
  if (!value) return null;
  const map: Record<string, string> = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    hard: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${map[value.toLowerCase()] ?? "bg-gray-100 text-gray-500"}`}>
      {value}
    </span>
  );
}

function ImportanceBadge({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Star className="h-2.5 w-2.5" /> {value}
    </span>
  );
}

// ─── Content Drawer ───────────────────────────────────────────────────────────

function getYouTubeId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
  return match ? match[1] : null;
}

function ContentDrawer({
  topic, contentType, materials, exams, onClose,
}: {
  topic: Topic;
  contentType: typeof CONTENT_TYPES[0];
  materials: TopicMaterial[];
  exams: TopicExam[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { role } = useAuth();
  
  const [localMaterials, setLocalMaterials] = useState(materials);
  
  const isExamType = contentType.key === "MCQ_EXAM" || contentType.key === "MOCK_TEST";
  const items = isExamType
    ? exams.filter(e => e.type === contentType.key)
    : localMaterials.filter(m => m.type === contentType.key);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;
    try {
      await fetchApi(`/study-materials/${id}`, { method: 'DELETE' });
      setLocalMaterials(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete material.");
    }
  };

  const handleOpen = (item: TopicMaterial | TopicExam) => {
    if (isExamType) {
      router.push(`/estudy/quiz/${(item as TopicExam).id}`);
    } else {
      const m = item as TopicMaterial;
      if (!m.url) return;
      window.open(m.url, "_blank");
    }
  };

  const Icon = contentType.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b border-gray-100 ${contentType.color.split(" ").map(c => c.startsWith("bg-") ? c : "").join(" ")}`} style={{ background: "white" }}>
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${contentType.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{topic.name}</p>
              <h3 className="text-sm font-bold text-gray-800">{contentType.label}</h3>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {items.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-medium">No {contentType.label.toLowerCase()} yet</p>
            </div>
          ) : (
            items.map((item) => {
              const isExam = isExamType;
              const exam = item as TopicExam;
              const mat = item as TopicMaterial;
              const ytId = !isExam && (mat.type === 'LINK' || mat.type === 'VIDEO') && mat.url ? getYouTubeId(mat.url) : null;
              
              return (
                <div key={item.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {(!isExam && mat.thumbnailUrl) || ytId ? (
                      <div className="h-9 w-16 shrink-0 rounded overflow-hidden relative bg-black flex items-center justify-center">
                        <img src={(!isExam && mat.thumbnailUrl) ? mat.thumbnailUrl : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} className="object-cover w-full h-full opacity-80" alt="Thumbnail" />
                        <Play className="h-4 w-4 text-white absolute" />
                      </div>
                    ) : (
                      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${contentType.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                      {isExam ? (
                        <p className="text-[11px] text-gray-400 mt-0.5">{exam.mcqQuestions.length} questions</p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {mat.uploader ? `by ${mat.uploader.firstName} ${mat.uploader.lastName}` : "Study Material"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleOpen(item)}
                      className={`ml-3 shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${contentType.color} hover:opacity-80`}
                    >
                      {isExam ? <><Zap className="h-3 w-3" /> Start</> :
                       mat.type === "VIDEO" ? <><Play className="h-3 w-3" /> Play</> :
                       mat.type === "LINK" ? <><ExternalLink className="h-3 w-3" /> Open</> :
                       <><Download className="h-3 w-3" /> Download</>}
                    </button>
                    {!isExam && role !== 'STUDENT' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="ml-2 shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete material"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: Topic }) {
  const [drawer, setDrawer] = useState<typeof CONTENT_TYPES[0] | null>(null);

  const materials = topic.materials ?? [];
  const exams = topic.exams ?? [];

  const getCount = (key: string) => {
    if (key === "MCQ_EXAM" || key === "MOCK_TEST") return exams.filter(e => e.type === key).length;
    return materials.filter(m => m.type === key).length;
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
        {/* Topic header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-800 leading-snug">{topic.name}</h4>
            {(topic.difficulty || topic.examImportance) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <DifficultyBadge value={topic.difficulty} />
                <ImportanceBadge value={topic.examImportance} />
              </div>
            )}
          </div>
          {topic.loadingContent && <Loader2 className="h-4 w-4 animate-spin text-gray-300 shrink-0 mt-0.5" />}
        </div>

        {/* Content pills */}
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map(ct => {
            const count = getCount(ct.key);
            if (count === 0) return null;
            const Icon = ct.icon;
            return (
              <button
                key={ct.key}
                onClick={() => setDrawer(ct)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all hover:scale-105 active:scale-95 ${ct.color}`}
              >
                <Icon className="h-3 w-3" />
                {ct.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white ${ct.pill}`}>{count}</span>
              </button>
            );
          })}
          {CONTENT_TYPES.every(ct => getCount(ct.key) === 0) && (
            <span className="text-[11px] text-gray-300 italic">No content uploaded yet</span>
          )}
        </div>
      </div>

      {/* Drawer */}
      {drawer && (
        <ContentDrawer
          topic={topic}
          contentType={drawer}
          materials={materials}
          exams={exams}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}

// ─── Chapter Accordion ────────────────────────────────────────────────────────

function ChapterRow({
  chapter, syllabusId, onToggle,
}: {
  chapter: Chapter;
  syllabusId: string;
  onToggle: (ch: Chapter) => void;
}) {
  const isOpen = chapter.isExpanded;
  const topics = chapter.topics ?? [];

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      {/* Chapter header */}
      <button
        onClick={() => onToggle(chapter)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4 text-brand-blue" />
          </div>
          <span className="text-sm font-bold text-gray-800 group-hover:text-brand-blue transition-colors">{chapter.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {chapter.isLoadingTopics && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {isOpen
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Topics */}
      {isOpen && (
        <div className="border-t border-gray-50 p-4 space-y-3 bg-gray-50/50">
          {topics.length === 0 && !chapter.isLoadingTopics ? (
            <p className="text-xs text-gray-400 text-center py-4">No topics defined for this chapter yet.</p>
          ) : (
            topics.map(topic => <TopicCard key={topic.id} topic={topic} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main CurriculumBrowser ───────────────────────────────────────────────────

export function CurriculumBrowser() {
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);

  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedStandard, setSelectedStandard] = useState("");
  const [selectedSyllabus, setSelectedSyllabus] = useState<any>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Load boards + standards
  useEffect(() => {
    fetchApi("/setup/boards").then((d: any) => setBoards(d)).catch(console.error);
    fetchApi("/setup/standards").then((d: any) => setStandards(d)).catch(console.error);
  }, []);

  // Load syllabi when board+standard selected
  useEffect(() => {
    if (!selectedBoard || !selectedStandard) { setSyllabi([]); setSelectedSyllabus(null); setChapters([]); return; }
    fetchApi(`/setup/syllabi?boardId=${selectedBoard}&standardId=${selectedStandard}`)
      .then((data: any) => setSyllabi(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [selectedBoard, selectedStandard]);

  // Load chapters when syllabus selected
  useEffect(() => {
    if (!selectedSyllabus) { setChapters([]); return; }
    setLoadingChapters(true);
    fetchApi(`/setup/chapters?syllabusId=${selectedSyllabus.id}`)
      .then((data: any) => {
        setChapters((Array.isArray(data) ? data : []).map((ch: any) => ({ ...ch, isExpanded: false, topics: undefined })));
      })
      .catch(console.error)
      .finally(() => setLoadingChapters(false));
  }, [selectedSyllabus]);

  // Lazy-load topics + content on chapter expand
  const handleToggleChapter = useCallback(async (chapter: Chapter) => {
    const isOpening = !chapter.isExpanded;

    // Toggle expansion immediately
    setChapters(prev => prev.map(ch =>
      ch.id === chapter.id ? { ...ch, isExpanded: isOpening, isLoadingTopics: isOpening && !ch.topics } : ch
    ));

    if (!isOpening || chapter.topics !== undefined) return;

    try {
      // Fetch topics
      const topics: Topic[] = await fetchApi(`/setup/topics?chapterId=${chapter.id}`);

      // Fetch materials + exams for each topic in parallel
      const topicsWithContent = await Promise.all(
        topics.map(async (topic) => {
          const [materials, exams] = await Promise.all([
            fetchApi(`/study-materials/by-topic/${topic.id}`).catch(() => []) as Promise<TopicMaterial[]>,
            fetchApi(`/exams/by-topic/${topic.id}`).catch(() => []) as Promise<TopicExam[]>,
          ]);
          return { ...topic, materials, exams, loadingContent: false };
        })
      );

      setChapters(prev => prev.map(ch =>
        ch.id === chapter.id ? { ...ch, topics: topicsWithContent, isLoadingTopics: false } : ch
      ));
    } catch (e) {
      console.error(e);
      setChapters(prev => prev.map(ch =>
        ch.id === chapter.id ? { ...ch, isLoadingTopics: false, topics: [] } : ch
      ));
    }
  }, []);

  const subjectsForSyllabus = syllabi.map((s: any) => ({
    id: s.id,
    name: s.subject?.name ?? "Unknown Subject",
    syllabus: s,
  }));

  return (
    <div className="space-y-6">
      {/* Selection bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="h-5 w-5 text-brand-blue" />
          <h2 className="text-sm font-bold text-gray-800">Select Your Class & Subject</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Board */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Board</label>
            <select
              value={selectedBoard}
              onChange={e => { setSelectedBoard(e.target.value); setSelectedStandard(""); setSelectedSyllabus(null); }}
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-colors"
            >
              <option value="">Select Board</option>
              {boards.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Class</label>
            <select
              value={selectedStandard}
              onChange={e => { setSelectedStandard(e.target.value); setSelectedSyllabus(null); }}
              disabled={!selectedBoard}
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-colors disabled:opacity-40"
            >
              <option value="">Select Class</option>
              {standards.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Subject</label>
            <select
              value={selectedSyllabus?.id ?? ""}
              onChange={e => setSelectedSyllabus(syllabi.find((s: any) => s.id === e.target.value) ?? null)}
              disabled={!selectedStandard || subjectsForSyllabus.length === 0}
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-colors disabled:opacity-40"
            >
              <option value="">Select Subject</option>
              {subjectsForSyllabus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Chapters */}
      {selectedSyllabus && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-brand-blue" />
              <h3 className="text-sm font-bold text-gray-700">
                {selectedSyllabus?.subject?.name} — Chapters
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-medium">{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</span>
          </div>

          {loadingChapters ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading chapters...</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-300">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm font-medium text-gray-400">No chapters found for this subject.</p>
              <p className="text-xs text-gray-300">Add chapters in the Syllabus builder first.</p>
            </div>
          ) : (
            chapters.map(chapter => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                syllabusId={selectedSyllabus.id}
                onToggle={handleToggleChapter}
              />
            ))
          )}
        </div>
      )}

      {!selectedSyllabus && (
        <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
          <BookOpen className="h-14 w-14" />
          <p className="text-base font-semibold text-gray-400">Select a subject to explore content</p>
          <p className="text-sm text-gray-300">Choose your board, class, and subject above</p>
        </div>
      )}
    </div>
  );
}
