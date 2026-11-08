"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  BookOpen, Plus, Search, Filter, ChevronRight, ChevronDown,
  FileText, Video, Link as LinkIcon, Download, X, Play,
  ExternalLink, Loader2, GraduationCap, LayoutList, Trash2,
  Pencil, Check, CheckSquare, Square, Building2, Users, Layers
} from "lucide-react";
import Link from "next/link";
import { FileUploader } from "@/components/upload/file-uploader";
import { fetchApi } from "@/lib/api";
import { CurriculumBrowser } from "./curriculum-browser";
import { VideoPlayerModal, isVideoUrl, getYouTubeId, VideoItem } from "@/components/media/video-player-modal";

export interface Material {
  id: string;
  title: string;
  type: "PDF" | "VIDEO" | "LINK" | "DOCUMENT" | "FILE";
  url?: string;
  thumbnailUrl?: string;
  academicYear?: { name: string };
  syllabus?: { 
    id?: string;
    board?: { id?: string; name: string };
    standard?: { id?: string; name: string };
    subject?: { id?: string; name: string };
  };
  chapter?: { id?: string; name: string };
  topic?: { id?: string; name: string };
  uploader?: { id?: string; firstName: string; lastName: string; email: string };
  targetTrack?: string;
  targetTrackId?: string;
  centreId?: string;
  centre?: { id: string; name: string; code?: string };
  boards?: { boardId: string; board?: { id: string; name: string } }[];
  standards?: { standardId: string; standard?: { id: string; name: string } }[];
  centres?: { centreId: string; centre?: { id: string; name: string; code?: string } }[];
  batches?: { batchId: string; batch?: { id: string; name: string } }[];
  createdAt: string;
}

export function EStudyClient({ initialMaterials }: { initialMaterials: Material[] }) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [search, setSearch] = useState("");
  const { role } = useAuth();

  // Students always see Curriculum Browser; others can switch
  const isStudent = role === "STUDENT";
  const [activeTab, setActiveTab] = useState<"curriculum" | "repository">(
    isStudent ? "curriculum" : "curriculum"
  );

  // Hierarchy Data
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);

  // Selected Filters
  const [filterBoard, setFilterBoard] = useState("All Boards");
  const [filterClass, setFilterClass] = useState("All Classes");
  const [filterSubject, setFilterSubject] = useState("All Subjects");
  const [filterType, setFilterType] = useState("All Types");
  const [filterTrack, setFilterTrack] = useState("All Tracks");
  const [sortBy, setSortBy] = useState("Date Added (Newest First)");
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  useEffect(() => {
    if (isStudent) return; // Students don't need the flat list data
    fetchApi('/setup/boards').then((data: any) => setBoards(data)).catch(console.error);
    fetchApi('/setup/standards').then((data: any) => setStandards(data)).catch(console.error);
    fetchApi('/setup/subjects').then((data: any) => setSubjectsList(data)).catch(console.error);
    fetchApi('/study-materials').then((data: any) => setMaterials(data)).catch(console.error);
  }, [isStudent]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;
    try {
      await fetchApi(`/study-materials/${id}`, { method: 'DELETE' });
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete material.");
    }
  };

  const filtered = materials.filter(m => {
    const subjName = m.syllabus?.subject?.name || "";
    const className = m.syllabus?.standard?.name || "";
    const boardName = m.syllabus?.board?.name || "";

    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                        subjName.toLowerCase().includes(search.toLowerCase());
    
    const matchBoard = filterBoard === "All Boards" ||
      boardName === filterBoard ||
      (Array.isArray(m.boards) && m.boards.some(b => b.board?.name === filterBoard));

    const matchClass = filterClass === "All Classes" ||
      className === filterClass ||
      (Array.isArray(m.standards) && m.standards.some(s => s.standard?.name === filterClass));

    const matchSubject = filterSubject === "All Subjects" || subjName === filterSubject;
    const matchType = filterType === "All Types" || m.type === filterType;
    const matchTrack = filterTrack === "All Tracks" || m.targetTrack === filterTrack;
    return matchSearch && matchBoard && matchClass && matchSubject && matchType && matchTrack;
  });

  const sortedMaterials = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "Date Added (Oldest First)":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "Title (A-Z)":
        return a.title.localeCompare(b.title);
      case "Title (Z-A)":
        return b.title.localeCompare(a.title);
      case "Date Added (Newest First)":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case "PDF": 
      case "DOCUMENT":
      case "FILE": return <FileText className="h-4 w-4 text-brand-red" />;
      case "VIDEO": return <Video className="h-4 w-4 text-brand-blue" />;
      case "LINK": return <LinkIcon className="h-4 w-4 text-warning" />;
      default: return <BookOpen className="h-4 w-4 text-text-secondary" />;
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "PDF": return "bg-brand-red/10 text-brand-red border-brand-red/20";
      case "Video": return "bg-brand-blue/10 text-brand-blue border-brand-blue/20";
      case "Link": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-surface-2 text-text-secondary border-border-soft";
    }
  };

  return (
    <DashboardLayout title="eStudy">
      <div className="flex flex-col h-full bg-surface">

        {/* Header */}
        <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">eStudy</h1>
              <p className="text-xs text-text-muted mt-0.5">
                {isStudent ? "Browse your curriculum and study materials" : "Manage curriculum-aligned study content"}
              </p>
            </div>
          </div>
          {!isStudent && activeTab === "repository" && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Material
            </button>
          )}
        </div>

        {/* Tab bar — only for non-students */}
        {!isStudent && (
          <div className="bg-white border-b border-border-soft px-6 lg:px-8 flex items-center gap-1">
            {([
              { key: "curriculum" as const, label: "Curriculum Browser", icon: GraduationCap },
              { key: "repository" as const, label: "Material Repository", icon: LayoutList },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 lg:px-8 pb-8 pt-6 flex-1 overflow-y-auto">

          {/* ── Curriculum Browser ── */}
          {activeTab === "curriculum" && <CurriculumBrowser />}

          {/* ── Material Repository (non-students only) ── */}
          {activeTab === "repository" && !isStudent && (
            <div className="space-y-6">

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6 text-sm font-bold text-text-primary">
                  <Filter className="h-4 w-4 text-brand-blue" /> Filter Materials
                </div>
                <div className="flex mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by Title, Subject or Class..."
                      className="w-full h-10 rounded-l-lg border border-r-0 border-border-soft bg-surface-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                  <button className="h-10 px-6 rounded-r-lg bg-brand-blue-dark text-white text-sm font-semibold hover:bg-brand-blue transition-colors">
                    Search
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: "Track", state: filterTrack, set: setFilterTrack, options: ["All Tracks", "TUITION", "ENTRANCE"] },
                    { label: "Board", state: filterBoard, set: setFilterBoard, options: ["All Boards", ...boards.map(b => b.name)] },
                    { label: "Class", state: filterClass, set: setFilterClass, options: ["All Classes", ...standards.map(s => s.name)] },
                    { label: "Subject", state: filterSubject, set: setFilterSubject, options: ["All Subjects", ...subjectsList.map(s => s.name)] },
                    { label: "Type", state: filterType, set: setFilterType, options: ["All Types", "PDF", "VIDEO", "LINK", "DOCUMENT"] },
                    { label: "Sort By", state: sortBy, set: setSortBy, options: ["Date Added (Newest First)", "Date Added (Oldest First)", "Title (A-Z)", "Title (Z-A)"] },
                  ].map((f) => (
                    <div key={f.label} className="relative">
                      <select
                        value={f.state}
                        onChange={(e) => f.set(e.target.value)}
                        className="w-full h-10 appearance-none rounded-xl border border-border-soft bg-white px-3 pr-8 text-[13px] font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                      >
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-border-soft shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between bg-surface-2/50">
                  <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <FileText className="h-4 w-4 text-brand-blue" /> Material Repository
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-soft bg-white">
                        <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Title</th>
                        <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Type</th>
                        <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Subject & Class</th>
                        <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Date Added</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {sortedMaterials.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-sm text-text-muted">
                            No materials match your filters.
                          </td>
                        </tr>
                      ) : (
                        sortedMaterials.map((m) => (
                          <tr key={m.id} className="hover:bg-surface-2/30 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${m.type === 'VIDEO' ? 'bg-brand-blue/10' : 'bg-surface-2'}`}>
                                  {getIconForType(m.type)}
                                </div>
                                <div>
                                  <p className="font-bold text-text-primary">{m.title}</p>
                                  <p className="text-[11px] text-text-muted mt-0.5">
                                    {m.uploader ? `Uploaded by ${m.uploader.firstName} ${m.uploader.lastName}` : "System Admin"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${m.type === 'VIDEO' ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-border-soft bg-surface-2 text-text-secondary'}`}>
                                {m.type}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-xs font-bold text-brand-blue">{m.syllabus?.subject?.name || "N/A"}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {m.boards && m.boards.length > 0 ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {m.boards.map(b => b.board?.name).filter(Boolean).join(", ")}
                                  </span>
                                ) : m.syllabus?.board?.name ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {m.syllabus.board.name}
                                  </span>
                                ) : null}

                                {m.standards && m.standards.length > 0 ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    {m.standards.map(s => s.standard?.name).filter(Boolean).join(", ")}
                                  </span>
                                ) : m.syllabus?.standard?.name ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {m.syllabus.standard.name}
                                  </span>
                                ) : null}

                                {m.centres && m.centres.length > 0 ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {m.centres.map(c => c.centre?.name).filter(Boolean).join(", ")}
                                  </span>
                                ) : m.centre?.name ? (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {m.centre.name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    All Centres
                                  </span>
                                )}

                                {m.batches && m.batches.length > 0 && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    {m.batches.map(b => b.batch?.name).filter(Boolean).join(", ")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-xs font-medium text-text-primary" suppressHydrationWarning>{new Date(m.createdAt).toLocaleDateString()}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {(() => {
                                  const isVideo = m.type === "VIDEO" || isVideoUrl(m.url) || Boolean(getYouTubeId(m.url));
                                  return (
                                    <button
                                      onClick={() => {
                                        if (!m.url && !m.id) return;
                                        if (isVideo) {
                                          setPlayingVideo({
                                            id: m.id,
                                            url: m.url || "",
                                            title: m.title,
                                            subject: m.syllabus?.subject?.name,
                                          });
                                        } else {
                                          window.open(m.url, '_blank');
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 text-brand-blue hover:text-brand-blue-dark text-xs font-bold transition-colors mr-1"
                                    >
                                      {isVideo ? <><Play className="h-3.5 w-3.5" /> Play</> : m.type === "LINK" ? <><ExternalLink className="h-3.5 w-3.5" /> Open</> : <><Download className="h-3.5 w-3.5" /> Download</>}
                                    </button>
                                  );
                                })()}
                                {!isStudent && (
                                  <>
                                    <button
                                      onClick={() => setEditingMaterial(m)}
                                      className="p-1.5 text-text-muted hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                      title="Edit material assignments"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(m.id)}
                                      className="p-1.5 text-text-muted hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                      title="Delete material"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Add Material Modal */}
      {showModal && (
        <AddMaterialModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchApi('/study-materials').then((data: any) => setMaterials(data)).catch(console.error);
            setShowModal(false);
          }}
        />
      )}

      {/* Edit Material Modal */}
      {editingMaterial && (
        <EditMaterialModal
          material={editingMaterial}
          onClose={() => setEditingMaterial(null)}
          onSuccess={(updated) => {
            setMaterials(prev => prev.map(m => m.id === updated.id ? updated : m));
            setEditingMaterial(null);
          }}
        />
      )}

      {/* On-Page Video Player */}
      {playingVideo && (
        <VideoPlayerModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </DashboardLayout>
  );
}

function AddMaterialModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"PDF" | "VIDEO" | "DOCUMENT" | "LINK" | "YOUTUBE_VIDEO">("PDF");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // Live Master Data State
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [centresList, setCentresList] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [tracksList, setTracksList] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  // Multi-Target Assignment State (100% Live DB driven)
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  // Subject Matter
  const [subject, setSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [targetTrack, setTargetTrack] = useState("");

  // Fetch initial live data strictly from DB
  useEffect(() => {
    fetchApi('/setup/boards').then((data: any) => setBoards(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/standards').then((data: any) => setStandards(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/centres').then((data: any) => setCentresList(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/batches').then((data: any) => setBatchesList(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/tracks').then((data: any) => setTracksList(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/subjects').then((res: any) => {
      const arr = Array.isArray(res) ? res : [];
      setSubjectsList(arr);
      setAvailableSubjects(arr);
      if (arr.length > 0) setSubject(arr[0].id);
    }).catch(console.error);
  }, []);

  // Update available subjects dynamically when boards or standards change
  useEffect(() => {
    if (selectedBoards.length > 0 && selectedStandards.length > 0) {
      fetchApi(`/setup/syllabi?boardId=${selectedBoards[0]}&standardId=${selectedStandards[0]}`)
        .then((data: any) => {
          if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map((s: any) => ({
              id: s.subject?.id || s.subjectId,
              name: s.subject?.name || 'Unnamed Subject',
              syllabusId: s.id,
            }));
            setAvailableSubjects(mapped);
            if (!mapped.some((s: any) => s.id === subject)) {
              setSubject(mapped[0]?.id || "");
            }
          } else {
            setAvailableSubjects(subjectsList);
          }
        })
        .catch(() => setAvailableSubjects(subjectsList));
    } else {
      setAvailableSubjects(subjectsList);
    }
  }, [selectedBoards, selectedStandards, subjectsList]);

  // Fetch chapters when subject, board, or standard change
  useEffect(() => {
    if (subject) {
      const params = new URLSearchParams();
      params.set('subjectId', subject);
      if (selectedBoards.length > 0) params.set('boardId', selectedBoards[0]);
      if (selectedStandards.length > 0) params.set('standardId', selectedStandards[0]);

      fetchApi(`/setup/chapters?${params.toString()}`)
        .then((data: any) => setChapters(Array.isArray(data) ? data : []))
        .catch(console.error);
      setSelectedChapter("");
      setSelectedTopic("");
    } else {
      setChapters([]);
    }
  }, [subject, selectedBoards, selectedStandards]);

  // Fetch topics when chapter changes
  useEffect(() => {
    if (selectedChapter) {
      fetchApi(`/setup/topics?chapterId=${selectedChapter}`).then((data: any) => setTopics(Array.isArray(data) ? data : [])).catch(console.error);
      setSelectedTopic("");
    } else {
      setTopics([]);
    }
  }, [selectedChapter]);

  // Dynamically filter live batches based on chosen centres and standards
  const visibleBatches = useMemo(() => {
    return batchesList.filter((b: any) => {
      const matchCentre = selectedCentres.length === 0 || selectedCentres.includes(b.centreId);
      const matchStandard = selectedStandards.length === 0 || selectedStandards.includes(b.standardId);
      const matchBoard = selectedBoards.length === 0 || selectedBoards.includes(b.boardId);
      return matchCentre && matchStandard && matchBoard;
    });
  }, [batchesList, selectedCentres, selectedStandards, selectedBoards]);

  const toggleItem = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  };

  const handleUploadSuccess = async (url: string, videoId?: string, overrideType?: string) => {
    setSaving(true);
    let finalThumbnailUrl: string | undefined;

    if (thumbnailFile) {
      try {
        const { uploadUrl, finalUrl } = await fetchApi<any>(
          `/study-materials/upload-url?type=FILE&filename=${encodeURIComponent(thumbnailFile.name)}&contentType=${encodeURIComponent(thumbnailFile.type)}`
        );
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", thumbnailFile.type);
        await new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else reject(new Error("Failed to upload thumbnail"));
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(thumbnailFile);
        });
        finalThumbnailUrl = finalUrl;
      } catch (err) {
        console.error("Thumbnail upload failed", err);
      }
    }

    const finalType = overrideType || (type === "YOUTUBE_VIDEO" ? "VIDEO" : type);
    const finalUrl = url;

    const selectedChapterObj = chapters.find(c => c.id === selectedChapter);
    const resolvedSyllabusId = selectedChapterObj?.syllabusId || undefined;

    try {
      await fetchApi('/study-materials', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type: finalType,
          url: finalUrl,
          thumbnailUrl: finalThumbnailUrl,
          syllabusId: resolvedSyllabusId,
          boardId: selectedBoards[0] || undefined,
          standardId: selectedStandards[0] || undefined,
          subjectId: subject || undefined,
          chapterId: selectedChapter || undefined,
          topicId: selectedTopic || undefined,
          targetTrackId: targetTrack || undefined,
          boardIds: selectedBoards,
          standardIds: selectedStandards,
          centreIds: selectedCentres,
          batchIds: selectedBatches,
        })
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error saving material to database");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0 bg-surface-2/40">
          <div>
            <h2 className="text-base font-bold text-text-primary">Add Study Material</h2>
            <p className="text-xs text-text-muted">Target multiple boards, classes, centres and batches</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white border border-border-soft flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-surface">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {step === 1 ? (
            <>
              {/* Material Title */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">Material Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Thermodynamics Chapter Notes"
                  className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  autoFocus
                />
              </div>

              {/* Material Type */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">Material Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { value: "PDF", label: "PDF Document" },
                    { value: "VIDEO", label: "Upload Video" },
                    { value: "YOUTUBE_VIDEO", label: "YouTube Class" },
                    { value: "LINK", label: "Resource Link" }
                  ].map(t => (
                    <label key={t.value} className={`flex items-center justify-center py-2.5 px-2 rounded-xl border cursor-pointer text-xs font-bold transition-all ${type === t.value ? 'border-brand-blue bg-brand-blue/10 text-brand-blue shadow-xs' : 'border-border-soft bg-white text-text-secondary hover:bg-surface-2'}`}>
                      <input type="radio" name="materialType" checked={type === t.value} onChange={() => setType(t.value as any)} className="hidden" />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Multi-Target Assignment Matrix (Live DB Data) */}
              <div className="p-4 rounded-2xl border border-border-soft bg-white space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-border-soft/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-blue" />
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Multi-Target Assignment (Live DB)</h3>
                  </div>
                  <span className="text-[11px] text-text-muted">Select multiple cohorts</span>
                </div>

                {/* 1. Centres Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                      Target Centres
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCentres.length === centresList.length) setSelectedCentres([]);
                        else setSelectedCentres(centresList.map(c => c.id));
                      }}
                      className="text-[11px] font-semibold text-brand-blue hover:underline"
                    >
                      {selectedCentres.length === centresList.length ? "Clear All" : "All Centres"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {centresList.map((c: any) => {
                      const active = selectedCentres.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleItem(selectedCentres, setSelectedCentres, c.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{c.name}</span>
                          {c.code && <span className={`text-[10px] px-1 py-0.2 rounded ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>{c.code}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Boards Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      Target Boards
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBoards.length === boards.length) setSelectedBoards([]);
                        else setSelectedBoards(boards.map(b => b.id));
                      }}
                      className="text-[11px] font-semibold text-brand-blue hover:underline"
                    >
                      {selectedBoards.length === boards.length ? "Clear All" : "All Boards"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {boards.map((b: any) => {
                      const active = selectedBoards.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleItem(selectedBoards, setSelectedBoards, b.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-blue-600 text-white border-blue-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Standards / Classes Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                      Target Classes / Standards
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStandards.length === standards.length) setSelectedStandards([]);
                        else setSelectedStandards(standards.map(s => s.id));
                      }}
                      className="text-[11px] font-semibold text-brand-blue hover:underline"
                    >
                      {selectedStandards.length === standards.length ? "Clear All" : "All Classes"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {standards.map((s: any) => {
                      const active = selectedStandards.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleItem(selectedStandards, setSelectedStandards, s.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Batches Cascading Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-purple-500" />
                      Target Batches (Optional)
                    </label>
                    {visibleBatches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBatches.length === visibleBatches.length) setSelectedBatches([]);
                          else setSelectedBatches(visibleBatches.map(b => b.id));
                        }}
                        className="text-[11px] font-semibold text-brand-blue hover:underline"
                      >
                        {selectedBatches.length === visibleBatches.length ? "Deselect Batches" : "Select All Batches"}
                      </button>
                    )}
                  </div>
                  {visibleBatches.length === 0 ? (
                    <p className="text-xs text-text-muted italic bg-surface-2 p-2.5 rounded-xl">
                      No specific batches found for current selection. Will automatically apply to all batches in selected classes.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                      {visibleBatches.map((b: any) => {
                        const active = selectedBatches.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => toggleItem(selectedBatches, setSelectedBatches, b.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${active ? "bg-purple-600 text-white border-purple-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                          >
                            {active && <Check className="h-3 w-3" />}
                            <span>{b.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedBatches.length === 0 && (
                    <p className="text-[11px] text-text-muted mt-1">
                      (No batches checked: applies to <strong>All Batches</strong> in the selected classes and centres)
                    </p>
                  )}
                </div>

                {/* Target Track */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Target Track</label>
                  <select
                    value={targetTrack}
                    onChange={(e) => setTargetTrack(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border-soft bg-surface-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="">All Tracks (Both Tuition & Entrance)</option>
                    {tracksList.map((tr: any) => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Matter */}
              <div className="p-4 rounded-2xl border border-border-soft bg-brand-blue/5 space-y-4">
                <h4 className="text-xs font-bold text-brand-blue uppercase tracking-wider">Subject & Curriculum</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-brand-blue/70 mb-1.5">Subject *</label>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 rounded-lg border border-border-soft bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/25">
                      {availableSubjects.length === 0 ? <option value="">No subjects found</option> : availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-brand-blue/70 mb-1.5">Chapter *</label>
                    <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} className="w-full h-9 rounded-lg border border-border-soft bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/25" required>
                      <option value="" disabled>Select Chapter</option>
                      {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-brand-blue/70 mb-1.5">Topic *</label>
                    <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="w-full h-9 rounded-lg border border-border-soft bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/25" required>
                      <option value="" disabled>Select Topic</option>
                      {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!title.trim()) {
                    setError("Title is required");
                    return;
                  }
                  if (!selectedChapter) {
                    setError("Chapter is required");
                    return;
                  }
                  if (!selectedTopic) {
                    setError("Topic is required");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                className="w-full py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl mt-2 transition-colors shadow-sm"
              >
                Next: Upload File / Link
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-secondary">Uploading: <strong className="text-text-primary">{title}</strong></span>
                <button onClick={() => setStep(1)} className="text-[10px] text-brand-blue font-bold hover:underline">Edit details</button>
              </div>

              {(type === 'VIDEO' || type === 'YOUTUBE_VIDEO') && (
                <div className="space-y-2 mb-4 p-4 border border-border-soft rounded-xl bg-surface-2">
                  <label className="block text-xs font-bold text-text-secondary">Custom Thumbnail (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    className="text-xs text-text-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-blue/10 file:text-brand-blue hover:file:bg-brand-blue/20"
                  />
                  {thumbnailFile && <p className="text-[10px] text-success mt-1">Selected: {thumbnailFile.name}</p>}
                </div>
              )}

              {type === 'LINK' || type === 'YOUTUBE_VIDEO' ? (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">{type === 'YOUTUBE_VIDEO' ? 'YouTube URL *' : 'Resource URL *'}</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full h-10 rounded-lg border border-border-soft bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (type === 'YOUTUBE_VIDEO') {
                        handleUploadSuccess(url, undefined, "VIDEO");
                      } else {
                        handleUploadSuccess(url, undefined, "LINK");
                      }
                    }}
                    className="w-full py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl transition-colors shadow-sm"
                    disabled={saving || !url}
                  >
                    {saving ? "Saving..." : "Submit Link"}
                  </button>
                </div>
              ) : (
                saving ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
                    <p className="text-xs font-bold text-text-secondary">Saving to database...</p>
                  </div>
                ) : (
                  <FileUploader
                    type={type === "VIDEO" ? "VIDEO" : "FILE"}
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={setError}
                    onCancel={onClose}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditMaterialModal({
  material,
  onClose,
  onSuccess
}: {
  material: Material;
  onClose: () => void;
  onSuccess: (updated: Material) => void;
}) {
  const [title, setTitle] = useState(material.title || "");
  const [type, setType] = useState<string>(material.type || "PDF");
  const [url, setUrl] = useState(material.url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Master Data
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [centresList, setCentresList] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [tracksList, setTracksList] = useState<any[]>([]);
  const [targetTrack, setTargetTrack] = useState(material.targetTrackId || "");

  // Multi-Target Assignments (Live DB)
  const [selectedBoards, setSelectedBoards] = useState<string[]>(() => {
    return material.boards?.map(b => b.boardId) || (material.syllabus?.board?.id ? [material.syllabus.board.id] : []);
  });
  const [selectedStandards, setSelectedStandards] = useState<string[]>(() => {
    return material.standards?.map(s => s.standardId) || (material.syllabus?.standard?.id ? [material.syllabus.standard.id] : []);
  });
  const [selectedCentres, setSelectedCentres] = useState<string[]>(() => {
    return material.centres?.map(c => c.centreId) || (material.centreId ? [material.centreId] : []);
  });
  const [selectedBatches, setSelectedBatches] = useState<string[]>(() => {
    return material.batches?.map(b => b.batchId) || [];
  });

  // Fetch full live material details and master options from DB
  useEffect(() => {
    fetchApi(`/study-materials/${material.id}`)
      .then((liveMat: any) => {
        if (liveMat) {
          if (liveMat.title) setTitle(liveMat.title);
          if (liveMat.type) setType(liveMat.type);
          if (liveMat.url) setUrl(liveMat.url);
          if (liveMat.targetTrackId) setTargetTrack(liveMat.targetTrackId);
          if (Array.isArray(liveMat.boards) && liveMat.boards.length > 0) {
            setSelectedBoards(liveMat.boards.map((b: any) => b.boardId || b.id));
          }
          if (Array.isArray(liveMat.standards) && liveMat.standards.length > 0) {
            setSelectedStandards(liveMat.standards.map((s: any) => s.standardId || s.id));
          }
          if (Array.isArray(liveMat.centres) && liveMat.centres.length > 0) {
            setSelectedCentres(liveMat.centres.map((c: any) => c.centreId || c.id));
          }
          if (Array.isArray(liveMat.batches) && liveMat.batches.length > 0) {
            setSelectedBatches(liveMat.batches.map((b: any) => b.batchId || b.id));
          }
        }
      })
      .catch(console.error);

    fetchApi('/setup/boards').then((data: any) => setBoards(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/standards').then((data: any) => setStandards(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/centres').then((data: any) => setCentresList(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/batches').then((data: any) => setBatchesList(Array.isArray(data) ? data : [])).catch(console.error);
    fetchApi('/setup/tracks').then((data: any) => setTracksList(Array.isArray(data) ? data : [])).catch(console.error);
  }, [material.id]);

  const visibleBatches = useMemo(() => {
    return batchesList.filter((b: any) => {
      const matchCentre = selectedCentres.length === 0 || selectedCentres.includes(b.centreId);
      const matchStandard = selectedStandards.length === 0 || selectedStandards.includes(b.standardId);
      const matchBoard = selectedBoards.length === 0 || selectedBoards.includes(b.boardId);
      return matchCentre && matchStandard && matchBoard;
    });
  }, [batchesList, selectedCentres, selectedStandards, selectedBoards]);

  const toggleItem = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const updated = await fetchApi<Material>(`/study-materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          type,
          url,
          targetTrackId: targetTrack || null,
          boardIds: selectedBoards,
          standardIds: selectedStandards,
          centreIds: selectedCentres,
          batchIds: selectedBatches,
        }),
      });
      onSuccess(updated);
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to update study material");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0 bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-blue/10 flex items-center justify-center text-brand-blue">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Edit Study Material</h2>
              <p className="text-xs text-text-muted">Modify material details and live target cohort assignments</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white border border-border-soft flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-surface">
          {error && (
            <p className="text-xs text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Material Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>

          {/* Type & URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Material Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value="PDF">PDF Document</option>
                <option value="VIDEO">Video Lecture</option>
                <option value="LINK">Resource Link</option>
                <option value="DOCUMENT">Document</option>
                <option value="FILE">Generic File</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Resource Link / URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          {/* Multi-Target Assignment Matrix (Live DB Data) */}
          <div className="p-4 rounded-2xl border border-border-soft bg-white space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border-soft/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-blue" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Cohort Assignments (Live DB)</h3>
              </div>
              <span className="text-[11px] text-text-muted">Add or remove target groups</span>
            </div>

            {/* 1. Centres Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                  Target Centres
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCentres.length === centresList.length) setSelectedCentres([]);
                    else setSelectedCentres(centresList.map(c => c.id));
                  }}
                  className="text-[11px] font-semibold text-brand-blue hover:underline"
                >
                  {selectedCentres.length === centresList.length ? "Clear All" : "All Centres"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {centresList.map((c: any) => {
                  const active = selectedCentres.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleItem(selectedCentres, setSelectedCentres, c.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      <span>{c.name}</span>
                      {c.code && <span className={`text-[10px] px-1 py-0.2 rounded ${active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>{c.code}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Boards Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Target Boards
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBoards.length === boards.length) setSelectedBoards([]);
                    else setSelectedBoards(boards.map(b => b.id));
                  }}
                  className="text-[11px] font-semibold text-brand-blue hover:underline"
                >
                  {selectedBoards.length === boards.length ? "Clear All" : "All Boards"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {boards.map((b: any) => {
                  const active = selectedBoards.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleItem(selectedBoards, setSelectedBoards, b.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-blue-600 text-white border-blue-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Standards / Classes Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                  Target Classes / Standards
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStandards.length === standards.length) setSelectedStandards([]);
                    else setSelectedStandards(standards.map(s => s.id));
                  }}
                  className="text-[11px] font-semibold text-brand-blue hover:underline"
                >
                  {selectedStandards.length === standards.length ? "Clear All" : "All Classes"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {standards.map((s: any) => {
                  const active = selectedStandards.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleItem(selectedStandards, setSelectedStandards, s.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                    >
                      {active && <Check className="h-3 w-3" />}
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Batches Cascading Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-purple-500" />
                  Target Batches
                </label>
                {visibleBatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBatches.length === visibleBatches.length) setSelectedBatches([]);
                      else setSelectedBatches(visibleBatches.map(b => b.id));
                    }}
                    className="text-[11px] font-semibold text-brand-blue hover:underline"
                  >
                    {selectedBatches.length === visibleBatches.length ? "Deselect Batches" : "Select All Batches"}
                  </button>
                )}
              </div>
              {visibleBatches.length === 0 ? (
                <p className="text-xs text-text-muted italic bg-surface-2 p-2.5 rounded-xl">
                  No specific batches match currently selected classes/centres. Material will apply to all batches in selected classes.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                  {visibleBatches.map((b: any) => {
                    const active = selectedBatches.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleItem(selectedBatches, setSelectedBatches, b.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${active ? "bg-purple-600 text-white border-purple-600 shadow-xs" : "bg-surface-2 border-border-soft text-text-secondary hover:bg-white"}`}
                      >
                        {active && <Check className="h-3 w-3" />}
                        <span>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Track */}
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Target Track</label>
              <select
                value={targetTrack}
                onChange={(e) => setTargetTrack(e.target.value)}
                className="w-full h-9 rounded-xl border border-border-soft bg-surface-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value="">All Tracks (Both Tuition & Entrance)</option>
                {tracksList.map((tr: any) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border-soft flex items-center justify-end gap-3 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-soft text-xs font-bold text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold transition-all shadow-sm shadow-brand-blue/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
