"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  FileText,
  Plus,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  ExternalLink,
  BookOpen,
  Layers,
  GraduationCap,
  Calendar,
  AlertTriangle,
  FolderOpen,
  School,
  Building,
  Target
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { FileUploader } from "@/components/upload/file-uploader";

export function AssignmentsClient({ initialAssignments }: { initialAssignments: any[] }) {
  const { role } = useAuth();
  const isTeacherOrAdmin = role !== "STUDENT" && role !== "PUBLIC_LEARNER";

  const [assignments, setAssignments] = useState<any[]>(initialAssignments || []);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Live filter state
  const [filterBoard, setFilterBoard] = useState("ALL");
  const [filterStandard, setFilterStandard] = useState("ALL");
  const [filterBatch, setFilterBatch] = useState("ALL");
  const [filterSubject, setFilterSubject] = useState("ALL");
  const [filterTrack, setFilterTrack] = useState("ALL");
  const [activeTab, setActiveTab] = useState("ALL");

  // Live setup collections
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<any | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  // Live fetch all setup hierarchy data on mount
  useEffect(() => {
    Promise.all([
      fetchApi("/setup/boards").catch(() => []),
      fetchApi("/setup/standards").catch(() => []),
      fetchApi("/setup/batches").catch(() => []),
      fetchApi("/setup/subjects").catch(() => []),
      fetchApi("/setup/tracks").catch(() => [])
    ]).then(([b, st, ba, su, tr]: any[]) => {
      setBoards(b || []);
      setStandards(st || []);
      setBatches(ba || []);
      setSubjects(su || []);
      setTracks(tr || []);
    }).catch(console.error);
  }, []);

  const refresh = () => {
    fetchApi("/assignments")
      .then((data: any) => setAssignments(data || []))
      .catch(console.error);
  };

  // Derived filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.subject?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.chapter?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.topic?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.batch?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Board
      if (filterBoard !== "ALL") {
        const boardId = a.batch?.boardId || a.batch?.board?.id;
        if (boardId !== filterBoard) return false;
      }

      // Standard / Class
      if (filterStandard !== "ALL") {
        const standardId = a.batch?.standardId || a.batch?.standard?.id;
        if (standardId !== filterStandard) return false;
      }

      // Batch
      if (filterBatch !== "ALL" && a.batchId !== filterBatch) return false;

      // Subject
      if (filterSubject !== "ALL" && a.subjectId !== filterSubject) return false;

      // Track (live comparison by TargetTrack.id)
      if (filterTrack !== "ALL") {
        const trId = a.targetTrackId || a.targetTrack?.id || a.batch?.trackId || a.batch?.track?.id;
        if (trId !== filterTrack) return false;
      }

      // Tab Filtering
      const sub = a.submissions?.[0];
      const isPastDue = a.dueDate && new Date() > new Date(a.dueDate);

      if (!isTeacherOrAdmin) {
        if (activeTab === "PENDING") return !sub;
        if (activeTab === "SUBMITTED") return sub && sub.status !== "GRADED";
        if (activeTab === "GRADED") return sub?.status === "GRADED";
        if (activeTab === "OVERDUE") return !sub && isPastDue;
      } else {
        if (activeTab === "ACTIVE") return !isPastDue;
        if (activeTab === "PAST_DUE") return isPastDue;
      }

      return true;
    });
  }, [
    assignments,
    searchQuery,
    filterBoard,
    filterStandard,
    filterBatch,
    filterSubject,
    filterTrack,
    activeTab,
    isTeacherOrAdmin
  ]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = assignments.length;
    if (!isTeacherOrAdmin) {
      const submitted = assignments.filter((a) => a.submissions && a.submissions.length > 0).length;
      const graded = assignments.filter((a) => a.submissions?.[0]?.status === "GRADED").length;
      const pending = assignments.filter((a) => !a.submissions || a.submissions.length === 0).length;
      return { total, first: pending, firstLabel: "Pending", second: submitted, secondLabel: "Submitted", third: graded, thirdLabel: "Graded" };
    } else {
      const pastDue = assignments.filter((a) => a.dueDate && new Date() > new Date(a.dueDate)).length;
      const totalSubmissions = assignments.reduce((acc, a) => acc + (a._count?.submissions || 0), 0);
      return { total, first: total - pastDue, firstLabel: "Active", second: pastDue, secondLabel: "Past Due", third: totalSubmissions, thirdLabel: "Submissions" };
    }
  }, [assignments, isTeacherOrAdmin]);

  const hasActiveFilters =
    filterBoard !== "ALL" ||
    filterStandard !== "ALL" ||
    filterBatch !== "ALL" ||
    filterSubject !== "ALL" ||
    filterTrack !== "ALL" ||
    !!searchQuery;

  return (
    <DashboardLayout title="Assignments">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">Assignments</h1>
            <p className="text-sm text-text-secondary mt-1">
              {!isTeacherOrAdmin
                ? "View coursework deadlines, submit responses, and track teacher evaluations"
                : "Manage curriculum-aligned homework, review batch submissions, and grade student work"}
            </p>
          </div>
          {isTeacherOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-brand-blue/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              New Assignment
            </button>
          )}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-border-soft p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand-blue/10 rounded-xl text-brand-blue shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary">Total Assignments</p>
              <p className="text-2xl font-black text-text-primary mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border-soft p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-xl text-warning shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary">{stats.firstLabel}</p>
              <p className="text-2xl font-black text-text-primary mt-0.5">{stats.first}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border-soft p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand-blue/10 rounded-xl text-brand-blue shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary">{stats.secondLabel}</p>
              <p className="text-2xl font-black text-text-primary mt-0.5">{stats.second}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border-soft p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary">{stats.thirdLabel}</p>
              <p className="text-2xl font-black text-text-primary mt-0.5">{stats.third}</p>
            </div>
          </div>
        </div>

        {/* Filter Toolbar (Live-Fetched Data) */}
        <div className="bg-white rounded-2xl border border-border-soft p-4 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Tab switchers */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {!isTeacherOrAdmin ? (
                <>
                  <TabButton active={activeTab === "ALL"} onClick={() => setActiveTab("ALL")} label="All" count={assignments.length} />
                  <TabButton active={activeTab === "PENDING"} onClick={() => setActiveTab("PENDING")} label="Pending" count={assignments.filter(a => !a.submissions?.length).length} />
                  <TabButton active={activeTab === "SUBMITTED"} onClick={() => setActiveTab("SUBMITTED")} label="Submitted" count={assignments.filter(a => a.submissions?.length && a.submissions[0].status !== "GRADED").length} />
                  <TabButton active={activeTab === "GRADED"} onClick={() => setActiveTab("GRADED")} label="Graded" count={assignments.filter(a => a.submissions?.[0]?.status === "GRADED").length} />
                  <TabButton active={activeTab === "OVERDUE"} onClick={() => setActiveTab("OVERDUE")} label="Overdue" count={assignments.filter(a => !a.submissions?.length && a.dueDate && new Date() > new Date(a.dueDate)).length} />
                </>
              ) : (
                <>
                  <TabButton active={activeTab === "ALL"} onClick={() => setActiveTab("ALL")} label="All" count={assignments.length} />
                  <TabButton active={activeTab === "ACTIVE"} onClick={() => setActiveTab("ACTIVE")} label="Active" count={assignments.filter(a => !a.dueDate || new Date() <= new Date(a.dueDate)).length} />
                  <TabButton active={activeTab === "PAST_DUE"} onClick={() => setActiveTab("PAST_DUE")} label="Past Due" count={assignments.filter(a => a.dueDate && new Date() > new Date(a.dueDate)).length} />
                </>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assignments or topics..."
                className="w-full h-9.5 pl-9 pr-3 rounded-xl border border-border-soft bg-surface-2 text-xs text-text-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* e-Study Academic Hierarchy Dropdown Strip (Live-Fetched) */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border-soft text-xs">
            <div className="flex items-center gap-1.5 text-text-secondary font-semibold">
              <Filter className="h-3.5 w-3.5 text-text-muted" />
              <span>Hierarchy:</span>
            </div>

            {/* Live Board Filter */}
            <div className="relative">
              <select
                value={filterBoard}
                onChange={(e) => setFilterBoard(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-border-soft bg-surface-2 text-xs font-medium text-text-primary focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Boards</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>

            {/* Live Class/Standard Filter */}
            <div className="relative">
              <select
                value={filterStandard}
                onChange={(e) => setFilterStandard(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-border-soft bg-surface-2 text-xs font-medium text-text-primary focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Classes</option>
                {standards.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>

            {/* Live Batch Filter */}
            <div className="relative">
              <select
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-border-soft bg-surface-2 text-xs font-medium text-text-primary focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Batches</option>
                {batches.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>

            {/* Live Subject Filter */}
            <div className="relative">
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-border-soft bg-surface-2 text-xs font-medium text-text-primary focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>

            {/* Live Target Track Filter */}
            <div className="relative">
              <select
                value={filterTrack}
                onChange={(e) => setFilterTrack(e.target.value)}
                className="h-8 pl-3 pr-7 rounded-lg border border-border-soft bg-surface-2 text-xs font-medium text-text-primary focus:outline-none focus:bg-white"
              >
                <option value="ALL">All Tracks</option>
                {tracks.map((tr) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterBoard("ALL");
                  setFilterStandard("ALL");
                  setFilterBatch("ALL");
                  setFilterSubject("ALL");
                  setFilterTrack("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-brand-red hover:underline ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-border-soft shadow-sm">
              <FolderOpen className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-text-primary">No assignments found</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                No assignments match the selected hierarchy criteria or none have been assigned yet.
              </p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => {
              const sub = assignment.submissions?.[0];
              const isPastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
              const trackName = assignment.targetTrack?.name || assignment.batch?.track?.name;
              const boardName = assignment.batch?.board?.name;
              const standardName = assignment.batch?.standard?.name;

              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-2xl border border-border-soft p-5 hover:border-brand-blue/40 hover:shadow-lg transition-all flex flex-col group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-blue/5 to-transparent rounded-bl-full pointer-events-none" />

                  {/* Top Bar: Subject, Track, and Due Date */}
                  <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                        {assignment.subject?.name || "General"}
                      </span>
                      {trackName && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-surface-2 text-text-secondary border border-border-soft">
                          {trackName}
                        </span>
                      )}
                    </div>

                    {assignment.dueDate && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                          isPastDue
                            ? "bg-brand-red/10 text-brand-red border-brand-red/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {isPastDue ? "Expired" : "Due"} {new Date(assignment.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Title & Hierarchy Path */}
                  <div className="relative z-10 mb-2">
                    <h3 className="text-base font-bold text-text-primary group-hover:text-brand-blue transition-colors line-clamp-1">
                      {assignment.title}
                    </h3>
                    
                    {/* e-Study style academic hierarchy breadcrumb */}
                    <div className="text-[11px] font-medium text-text-muted mt-1 space-y-0.5">
                      {(boardName || standardName || assignment.batch?.name) && (
                        <p className="line-clamp-1 text-text-secondary font-semibold">
                          {boardName ? `${boardName} • ` : ""}{standardName ? `${standardName} • ` : ""}{assignment.batch?.name || "All Batches"}
                        </p>
                      )}
                      {(assignment.chapter?.name || assignment.topic?.name) && (
                        <p className="line-clamp-1 text-brand-blue">
                          {assignment.chapter?.name}{assignment.topic?.name ? ` › ${assignment.topic.name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary mb-4 line-clamp-2 min-h-[32px] relative z-10">
                    {assignment.description || "No description provided."}
                  </p>

                  {/* Attachments info */}
                  {assignment.attachments && assignment.attachments.length > 0 && (
                    <div className="text-[11px] text-text-muted mb-4 relative z-10 flex items-center gap-1.5 font-bold text-brand-blue">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{assignment.attachments.length} attached worksheet/resource{assignment.attachments.length > 1 ? "s" : ""}</span>
                    </div>
                  )}

                  {/* Footer Action & Status */}
                  <div className="mt-auto pt-4 border-t border-border-soft flex items-center justify-between gap-3 relative z-10">
                    {!isTeacherOrAdmin ? (
                      <div>
                        {sub?.status === "GRADED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-green/10 text-brand-green border border-brand-green/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Graded ({sub.grade ?? "—"})
                          </span>
                        ) : sub?.status === "LATE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-warning/10 text-warning border border-warning/20">
                            <AlertCircle className="h-3.5 w-3.5" /> Submitted (Late)
                          </span>
                        ) : sub ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                          </span>
                        ) : isPastDue ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-red/10 text-brand-red border border-brand-red/20">
                            <AlertTriangle className="h-3.5 w-3.5" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-2 text-text-secondary border border-border-soft">
                            Pending
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-brand-blue">
                        {assignment._count?.submissions || 0} Submissions
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {!isTeacherOrAdmin ? (
                        <button
                          onClick={() => setSelectedAssignment(assignment)}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-brand-blue text-white hover:bg-brand-blue-dark transition-all shadow-sm shadow-brand-blue/20"
                        >
                          {sub ? "View Submission" : "Submit Work"}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-surface-2 text-text-primary hover:bg-surface-3 transition-colors"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => setEditingAssignment(assignment)}
                            title="Edit Assignment"
                            className="p-1.5 rounded-lg text-text-muted hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingAssignment(assignment)}
                            title="Delete Assignment"
                            className="p-1.5 rounded-lg text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODALS */}
      {showCreateModal && (
        <CreateAssignmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refresh();
          }}
        />
      )}

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            setEditingAssignment(null);
            refresh();
          }}
        />
      )}

      {deletingAssignment && (
        <DeleteConfirmationModal
          assignment={deletingAssignment}
          onClose={() => setDeletingAssignment(null)}
          onSuccess={() => {
            setDeletingAssignment(null);
            refresh();
          }}
        />
      )}

      {selectedAssignment && !isTeacherOrAdmin && (
        <SubmitAssignmentModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onSuccess={() => {
            setSelectedAssignment(null);
            refresh();
          }}
        />
      )}

      {selectedAssignment && isTeacherOrAdmin && (
        <ViewSubmissionsModal
          assignmentId={selectedAssignment.id}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </DashboardLayout>
  );
}

// -----------------------------------------------------------------------------
// TAB BUTTON COMPONENT
// -----------------------------------------------------------------------------
function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
        active
          ? "bg-brand-blue text-white shadow-sm shadow-brand-blue/20"
          : "bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? "bg-white/20 text-white" : "bg-white text-text-muted"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: CREATE ASSIGNMENT MODAL (e-Study HIERARCHY CASCADE)
// -----------------------------------------------------------------------------
function CreateAssignmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  
  // e-Study Cascade Selection
  const [boardId, setBoardId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [syllabusId, setSyllabusId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [targetTrackId, setTargetTrackId] = useState("");

  const [attachments, setAttachments] = useState<any[]>([]);

  // Live Fetched Lists
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 1. Initial Load: Boards, All Subjects, Tracks
  useEffect(() => {
    fetchApi("/setup/boards").then((data: any) => setBoards(data || [])).catch(console.error);
    fetchApi("/setup/subjects").then((data: any) => setAllSubjects(data || [])).catch(console.error);
    fetchApi("/setup/tracks").then((data: any) => setTracks(data || [])).catch(console.error);
  }, []);

  // 2. Cascade: When Board changes -> fetch Standards for that Board
  useEffect(() => {
    if (!boardId) {
      setStandards([]);
      setStandardId("");
      return;
    }
    fetchApi(`/setup/standards?boardId=${boardId}`)
      .then((data: any) => setStandards(data || []))
      .catch(console.error);
    setStandardId("");
    setBatchId("");
    setSubjectId("");
    setSyllabusId("");
    setChapterId("");
    setTopicId("");
  }, [boardId]);

  // 3. Cascade: When Board & Standard selected -> fetch Batches and Syllabi
  useEffect(() => {
    if (!boardId || !standardId) {
      setBatches([]);
      setSyllabi([]);
      setBatchId("");
      setSubjectId("");
      setSyllabusId("");
      return;
    }

    // Live batches for this board and standard
    fetchApi(`/setup/batches?boardId=${boardId}&standardId=${standardId}`)
      .then((data: any) => setBatches(data || []))
      .catch(console.error);

    // Live syllabi (maps to subjects + chapters)
    fetchApi(`/setup/syllabi?boardId=${boardId}&standardId=${standardId}`)
      .then((data: any) => setSyllabi(data || []))
      .catch(console.error);

    setBatchId("");
    setSubjectId("");
    setSyllabusId("");
    setChapterId("");
    setTopicId("");
  }, [boardId, standardId]);

  // 4. Cascade: When Subject / Syllabus selected -> fetch Chapters
  useEffect(() => {
    if (!syllabusId && !subjectId) {
      setChapters([]);
      setChapterId("");
      return;
    }

    const query = syllabusId ? `syllabusId=${syllabusId}` : `subjectId=${subjectId}`;
    fetchApi(`/setup/chapters?${query}`)
      .then((data: any) => setChapters(data || []))
      .catch(console.error);

    setChapterId("");
    setTopicId("");
  }, [syllabusId, subjectId]);

  // 5. Cascade: When Chapter selected -> fetch Topics
  useEffect(() => {
    if (!chapterId) {
      setTopics([]);
      setTopicId("");
      return;
    }
    fetchApi(`/setup/topics?chapterId=${chapterId}`)
      .then((data: any) => setTopics(data || []))
      .catch(console.error);
    setTopicId("");
  }, [chapterId]);

  const handleUploadSuccess = (url: string) => {
    setAttachments([...attachments, { url, filename: `Worksheet Attachment ${attachments.length + 1}` }]);
  };

  const handleSave = async () => {
    if (!title.trim() || !batchId || !subjectId) {
      setError("Please provide a title, target batch, and subject.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi("/assignments", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          batchId,
          subjectId,
          chapterId: chapterId || null,
          topicId: topicId || null,
          targetTrackId: targetTrackId || null,
          attachments: attachments.length > 0 ? attachments : null
        })
      });
      onSuccess();
    } catch (e: any) {
      setError("Failed to create assignment");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">Create Assignment</h2>
            <p className="text-xs text-text-secondary">Structure coursework following the e-Study academic curriculum</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-brand-red bg-brand-red/10 p-3 rounded-xl border border-brand-red/20">{error}</p>}

          {step === 1 ? (
            <div className="space-y-4">
              {/* SECTION 1: ACADEMIC HIERARCHY (e-Study METHOD) */}
              <div className="bg-surface-2/60 p-4 rounded-2xl border border-border-soft space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-blue uppercase tracking-wider">
                  <School className="h-4 w-4" />
                  <span>1. Academic Scope</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Board *</label>
                    <select
                      value={boardId}
                      onChange={(e) => setBoardId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="">Select Board</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Class / Standard *</label>
                    <select
                      value={standardId}
                      onChange={(e) => setStandardId(e.target.value)}
                      disabled={!boardId}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                    >
                      <option value="">Select Class</option>
                      {standards.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Target Batch *</label>
                    <select
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      disabled={!standardId}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                    >
                      <option value="">Select Batch</option>
                      {batches.map((ba) => (
                        <option key={ba.id} value={ba.id}>{ba.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Subject *</label>
                    <select
                      value={subjectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjectId(val);
                        // If selected from syllabi, also save syllabusId
                        const match = syllabi.find((s) => s.subjectId === val || s.subject?.id === val);
                        setSyllabusId(match ? match.id : "");
                      }}
                      disabled={!standardId}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                    >
                      <option value="">Select Subject</option>
                      {syllabi.length > 0
                        ? syllabi.map((s) => (
                            <option key={s.id} value={s.subjectId || s.subject?.id}>
                              {s.subject?.name}
                            </option>
                          ))
                        : allSubjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: CURRICULUM LEVEL (CHAPTER, TOPIC & LIVE TRACK) */}
              <div className="bg-surface-2/60 p-4 rounded-2xl border border-border-soft space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-blue uppercase tracking-wider">
                  <Target className="h-4 w-4" />
                  <span>2. Curriculum Topic & Track Mapping</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Chapter (Optional)</label>
                    <select
                      value={chapterId}
                      onChange={(e) => setChapterId(e.target.value)}
                      disabled={!subjectId}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                    >
                      <option value="">No Chapter Selected</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">Topic (Syncs with Syllabus)</label>
                    <select
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                      disabled={!chapterId}
                      className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                    >
                      <option value="">No Topic Selected</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Target Track (Live)</label>
                  <select
                    value={targetTrackId}
                    onChange={(e) => setTargetTrackId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs font-medium focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="">All Tracks / Unrestricted</option>
                    {tracks.map((tr) => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION 3: DETAILS */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Kinematics Worksheet #1"
                    className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Description & Instructions</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add detailed assignment instructions, questions, or notes..."
                    rows={3}
                    className="w-full rounded-xl border border-border-soft bg-white p-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-2.5 text-xs font-bold text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 rounded-xl transition-colors"
                >
                  Manage Attachments ({attachments.length})
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Assignment"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploader
                type="FILE"
                onUploadSuccess={handleUploadSuccess}
                onUploadError={setError}
                onCancel={() => setStep(1)}
              />

              {attachments.length > 0 && (
                <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-brand-blue">Uploaded Files ({attachments.length})</p>
                  {attachments.map((a, i) => (
                    <div key={i} className="text-xs text-text-primary bg-white p-2.5 rounded-lg flex items-center justify-between border border-border-soft">
                      <div className="flex items-center gap-2 line-clamp-1">
                        <FileText className="h-4 w-4 text-brand-blue shrink-0" />
                        <span>{a.filename || `Attachment ${i + 1}`}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        className="text-text-muted hover:text-brand-red ml-2"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 text-xs font-bold text-text-secondary bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors"
                >
                  Back to Hierarchy & Details
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Assignment"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: EDIT ASSIGNMENT MODAL (e-Study CASCADE)
// -----------------------------------------------------------------------------
function EditAssignmentModal({ assignment, onClose, onSuccess }: { assignment: any; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(assignment.title || "");
  const [description, setDescription] = useState(assignment.description || "");
  const [dueDate, setDueDate] = useState(
    assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : ""
  );

  const initialBoardId = assignment.batch?.boardId || assignment.batch?.board?.id || "";
  const initialStandardId = assignment.batch?.standardId || assignment.batch?.standard?.id || "";

  const [boardId, setBoardId] = useState(initialBoardId);
  const [standardId, setStandardId] = useState(initialStandardId);
  const [batchId, setBatchId] = useState(assignment.batchId || "");
  const [subjectId, setSubjectId] = useState(assignment.subjectId || "");
  const [chapterId, setChapterId] = useState(assignment.chapterId || "");
  const [topicId, setTopicId] = useState(assignment.topicId || "");
  const [targetTrackId, setTargetTrackId] = useState(assignment.targetTrackId || "");
  const [attachments, setAttachments] = useState<any[]>(assignment.attachments || []);

  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi("/setup/boards").then((data: any) => setBoards(data || [])).catch(console.error);
    fetchApi("/setup/subjects").then((data: any) => setAllSubjects(data || [])).catch(console.error);
    fetchApi("/setup/tracks").then((data: any) => setTracks(data || [])).catch(console.error);

    if (initialBoardId) {
      fetchApi(`/setup/standards?boardId=${initialBoardId}`)
        .then((data: any) => setStandards(data || []))
        .catch(console.error);
    }
    if (initialBoardId && initialStandardId) {
      fetchApi(`/setup/batches?boardId=${initialBoardId}&standardId=${initialStandardId}`)
        .then((data: any) => setBatches(data || []))
        .catch(console.error);
      fetchApi(`/setup/syllabi?boardId=${initialBoardId}&standardId=${initialStandardId}`)
        .then((data: any) => setSyllabi(data || []))
        .catch(console.error);
    }
  }, [initialBoardId, initialStandardId]);

  useEffect(() => {
    if (subjectId) {
      fetchApi(`/setup/chapters?subjectId=${subjectId}`)
        .then((data: any) => setChapters(data || []))
        .catch(console.error);
    }
  }, [subjectId]);

  useEffect(() => {
    if (chapterId) {
      fetchApi(`/setup/topics?chapterId=${chapterId}`)
        .then((data: any) => setTopics(data || []))
        .catch(console.error);
    }
  }, [chapterId]);

  const handleUpdate = async () => {
    if (!title.trim() || !batchId || !subjectId) {
      setError("Title, batch, and subject are required.");
      return;
    }
    setSaving(true);
    try {
      await fetchApi(`/assignments/${assignment.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          batchId,
          subjectId,
          chapterId: chapterId || null,
          topicId: topicId || null,
          targetTrackId: targetTrackId || null,
          attachments: attachments.length > 0 ? attachments : null
        })
      });
      onSuccess();
    } catch (e: any) {
      setError("Failed to update assignment");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">Edit Assignment</h2>
            <p className="text-xs text-text-secondary">Update hierarchy mapping, content, or deadlines</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-brand-red bg-brand-red/10 p-3 rounded-xl border border-brand-red/20">{error}</p>}

          {/* Academic Scope */}
          <div className="bg-surface-2/60 p-4 rounded-2xl border border-border-soft space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-blue uppercase tracking-wider">
              <School className="h-4 w-4" />
              <span>1. Academic Scope</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Board</label>
                <select
                  value={boardId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setBoardId(bId);
                    if (bId) {
                      fetchApi(`/setup/standards?boardId=${bId}`).then((d: any) => setStandards(d || []));
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">Select Board</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Class / Standard</label>
                <select
                  value={standardId}
                  onChange={(e) => {
                    const stId = e.target.value;
                    setStandardId(stId);
                    if (boardId && stId) {
                      fetchApi(`/setup/batches?boardId=${boardId}&standardId=${stId}`).then((d: any) => setBatches(d || []));
                      fetchApi(`/setup/syllabi?boardId=${boardId}&standardId=${stId}`).then((d: any) => setSyllabi(d || []));
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">Select Class</option>
                  {standards.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Target Batch *</label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">Select Batch</option>
                  {batches.map((ba) => (
                    <option key={ba.id} value={ba.id}>{ba.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Subject *</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">Select Subject</option>
                  {syllabi.length > 0
                    ? syllabi.map((s) => (
                        <option key={s.id} value={s.subjectId || s.subject?.id}>
                          {s.subject?.name}
                        </option>
                      ))
                    : allSubjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                </select>
              </div>
            </div>
          </div>

          {/* Curriculum */}
          <div className="bg-surface-2/60 p-4 rounded-2xl border border-border-soft space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-blue uppercase tracking-wider">
              <Target className="h-4 w-4" />
              <span>2. Curriculum Topic & Track Mapping</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Chapter</label>
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">No Chapter</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Topic</label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
                >
                  <option value="">No Topic</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Target Track (Live)</label>
              <select
                value={targetTrackId}
                onChange={(e) => setTargetTrackId(e.target.value)}
                className="w-full h-9 rounded-xl border border-border-soft bg-white px-3 text-xs"
              >
                <option value="">All Tracks / Unrestricted</option>
                {tracks.map((tr) => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border-soft bg-white p-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-border-soft bg-white px-3 text-xs focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-text-secondary bg-surface-2 hover:bg-surface-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="w-full py-2.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: DELETE CONFIRMATION MODAL
// -----------------------------------------------------------------------------
function DeleteConfirmationModal({ assignment, onClose, onSuccess }: { assignment: any; onClose: () => void; onSuccess: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetchApi(`/assignments/${assignment.id}`, { method: "DELETE" });
      onSuccess();
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-3 bg-brand-red/10 text-brand-red rounded-xl w-fit">
          <Trash2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-text-primary">Delete Assignment?</h3>
          <p className="text-xs text-text-secondary mt-1">
            Are you sure you want to delete <span className="font-semibold text-text-primary">"{assignment.title}"</span>? All student submissions and evaluations linked to this assignment will be permanently deleted.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold rounded-xl bg-surface-2 text-text-secondary hover:bg-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-2 text-xs font-bold rounded-xl bg-brand-red text-white hover:bg-brand-red/90 flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: SUBMIT ASSIGNMENT MODAL
// -----------------------------------------------------------------------------
function SubmitAssignmentModal({ assignment, onClose, onSuccess }: { assignment: any; onClose: () => void; onSuccess: () => void }) {
  const existingSubmission = assignment.submissions?.[0];
  const [notes, setNotes] = useState(existingSubmission?.notes || "");
  const [attachments, setAttachments] = useState<any[]>(existingSubmission?.attachments || []);
  const [saving, setSaving] = useState(false);

  const isPastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);

  const handleUploadSuccess = (url: string) => {
    setAttachments([...attachments, { url, filename: `Submission File ${attachments.length + 1}` }]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await fetchApi(`/assignments/${assignment.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ notes, attachments })
      });
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">{assignment.title}</h2>
            <p className="text-xs text-text-secondary">
              {assignment.subject?.name} • {assignment.batch?.name}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-6">
          {/* Assignment Instructions & Attachments */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Instructions</h3>
              <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed bg-surface-2/50 p-3.5 rounded-xl border border-border-soft">
                {assignment.description || "No specific instructions provided."}
              </p>
            </div>

            {assignment.dueDate && (
              <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                <Calendar className="h-4 w-4 text-text-muted" />
                <span>Deadline: {new Date(assignment.dueDate).toLocaleString()}</span>
              </div>
            )}

            {isPastDue && !existingSubmission && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-2.5 text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>This assignment is past its due date. If submitted now, it will be marked as <strong>Late</strong>.</span>
              </div>
            )}

            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-text-secondary mb-2">Teacher Resources</h4>
                <div className="space-y-2">
                  {assignment.attachments.map((a: any, i: number) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border-soft bg-surface-2/40 hover:border-brand-blue hover:bg-white transition-all group"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                        <FileText className="h-4 w-4 text-brand-blue" />
                        <span className="line-clamp-1">{a.filename || `Attachment ${i + 1}`}</span>
                      </div>
                      <Download className="h-3.5 w-3.5 text-text-muted group-hover:text-brand-blue" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submission Area */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Your Work</h3>

            {existingSubmission && existingSubmission.status === "GRADED" ? (
              <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-green">Teacher Evaluation</p>
                  <span className="text-xs font-bold px-2 py-0.5 bg-brand-green text-white rounded-md">GRADED</span>
                </div>
                <p className="text-3xl font-black text-brand-green mt-1">{existingSubmission.grade}</p>
                {existingSubmission.feedback && (
                  <p className="text-xs text-text-secondary mt-2 italic bg-white/60 p-2.5 rounded-lg border border-brand-green/10">
                    "{existingSubmission.feedback}"
                  </p>
                )}
              </div>
            ) : existingSubmission ? (
              <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl p-3 text-xs text-brand-blue font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Submitted on {new Date(existingSubmission.updatedAt || existingSubmission.createdAt).toLocaleString()}</span>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Student Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add comments or notes for your teacher..."
                rows={3}
                disabled={existingSubmission?.status === "GRADED"}
                className="w-full rounded-xl border border-border-soft bg-white p-3 text-xs focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
              />
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Your Uploaded Files</p>
                {attachments.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-border-soft text-xs">
                    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold text-brand-blue hover:underline line-clamp-1">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{a.filename || `File ${i + 1}`}</span>
                    </a>
                    {existingSubmission?.status !== "GRADED" && (
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        className="text-text-muted hover:text-brand-red ml-2"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {existingSubmission?.status !== "GRADED" && (
              <div className="pt-2">
                <FileUploader
                  type="FILE"
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={console.error}
                  onCancel={() => {}}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || (attachments.length === 0 && !notes.trim())}
                  className="w-full mt-3 py-2.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : existingSubmission ? "Update Submission" : "Submit Assignment"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: VIEW SUBMISSIONS MODAL
// -----------------------------------------------------------------------------
function ViewSubmissionsModal({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const [assignment, setAssignment] = useState<any>(null);
  const [submissionFilter, setSubmissionFilter] = useState("ALL");
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);

  const loadData = () => {
    fetchApi(`/assignments/${assignmentId}`).then(setAssignment).catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const handleGrade = async (subId: string, grade: number, feedback: string) => {
    try {
      setGradingSubId(subId);
      await fetchApi(`/assignments/submissions/${subId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({ grade, feedback })
      });
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setGradingSubId(null);
    }
  };

  if (!assignment) return null;

  const submissions = assignment.submissions || [];
  const filteredSubmissions = submissions.filter((sub: any) => {
    if (submissionFilter === "GRADED") return sub.status === "GRADED";
    if (submissionFilter === "LATE") return sub.status === "LATE";
    if (submissionFilter === "PENDING_GRADE") return sub.status !== "GRADED";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">{assignment.title}</h2>
            <p className="text-xs text-text-secondary">
              {assignment.batch?.name} • {assignment.subject?.name} • {submissions.length} Total Submission{submissions.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-2.5 border-b border-border-soft bg-surface-2/40 flex items-center gap-2">
          <span className="text-[11px] font-bold text-text-secondary mr-2">Filter Submissions:</span>
          <button
            onClick={() => setSubmissionFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              submissionFilter === "ALL" ? "bg-brand-blue text-white" : "bg-white text-text-secondary border border-border-soft"
            }`}
          >
            All ({submissions.length})
          </button>
          <button
            onClick={() => setSubmissionFilter("PENDING_GRADE")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              submissionFilter === "PENDING_GRADE" ? "bg-brand-blue text-white" : "bg-white text-text-secondary border border-border-soft"
            }`}
          >
            Needs Grading ({submissions.filter((s: any) => s.status !== "GRADED").length})
          </button>
          <button
            onClick={() => setSubmissionFilter("LATE")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              submissionFilter === "LATE" ? "bg-brand-blue text-white" : "bg-white text-text-secondary border border-border-soft"
            }`}
          >
            Late ({submissions.filter((s: any) => s.status === "LATE").length})
          </button>
          <button
            onClick={() => setSubmissionFilter("GRADED")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              submissionFilter === "GRADED" ? "bg-brand-blue text-white" : "bg-white text-text-secondary border border-border-soft"
            }`}
          >
            Graded ({submissions.filter((s: any) => s.status === "GRADED").length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-text-muted mx-auto mb-2 opacity-50" />
              <p className="text-text-secondary text-xs font-semibold">No submissions found for this filter.</p>
            </div>
          ) : (
            filteredSubmissions.map((sub: any) => (
              <div key={sub.id} className="bg-white rounded-xl border border-border-soft p-5 flex flex-col md:flex-row gap-6 shadow-sm">
                
                {/* Student Info & Work */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-text-primary">
                        {sub.student?.user?.firstName} {sub.student?.user?.lastName}
                      </h3>
                      <p className="text-xs text-text-secondary">Admission No: {sub.student?.admissionNo || "—"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {sub.status === "LATE" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Late Submission
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted">
                        {new Date(sub.updatedAt || sub.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {sub.notes && (
                    <div className="bg-surface-2 p-3 rounded-xl border border-border-soft text-xs text-text-primary">
                      <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Student Note</p>
                      <p className="italic">"{sub.notes}"</p>
                    </div>
                  )}

                  {sub.attachments && sub.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {sub.attachments.map((a: any, i: number) => (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue/10 text-brand-blue text-xs font-bold rounded-lg hover:bg-brand-blue/20 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{a.filename || `File ${i + 1}`}</span>
                          <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grading Panel */}
                <div className="md:w-72 shrink-0 p-4 rounded-xl border border-border-soft bg-surface-2/40 flex flex-col justify-center gap-3">
                  <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Evaluation</h4>
                  
                  {sub.status === "GRADED" ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Marks:</span>
                        <span className="text-2xl font-black text-brand-green">{sub.grade}</span>
                      </div>
                      {sub.feedback && (
                        <p className="text-xs text-text-secondary bg-white p-2.5 rounded-lg border border-border-soft">
                          "{sub.feedback}"
                        </p>
                      )}
                      <button
                        onClick={() => {
                          sub.status = "SUBMITTED";
                          setAssignment({ ...assignment });
                        }}
                        className="text-[11px] font-bold text-brand-blue hover:underline mt-2 inline-block"
                      >
                        Re-evaluate
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleGrade(sub.id, Number(formData.get("grade")), formData.get("feedback") as string);
                      }}
                      className="space-y-2.5"
                    >
                      <div>
                        <input
                          type="number"
                          step="any"
                          name="grade"
                          placeholder="Marks (e.g. 20)"
                          required
                          defaultValue={sub.grade ?? ""}
                          className="w-full h-8 rounded-lg border border-border-soft bg-white px-2.5 text-xs font-semibold focus:ring-2 focus:ring-brand-blue/20"
                        />
                      </div>
                      <div>
                        <textarea
                          name="feedback"
                          placeholder="Feedback or remarks..."
                          rows={2}
                          defaultValue={sub.feedback ?? ""}
                          className="w-full rounded-lg border border-border-soft bg-white p-2 text-xs focus:ring-2 focus:ring-brand-blue/20"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={gradingSubId === sub.id}
                        className="w-full py-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        {gradingSubId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Grade"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
