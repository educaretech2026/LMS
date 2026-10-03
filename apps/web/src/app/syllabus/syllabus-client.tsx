"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { BookOpenCheck, ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2 } from "lucide-react";

export function SyllabusClient({ initialBatches, initialBoards = [], initialTracks = [] }: { initialBatches: any[], initialBoards?: any[], initialTracks?: any[] }) {
  const { role } = useAuth();
  const [batches] = useState<any[]>(Array.isArray(initialBatches) ? initialBatches : []);
  const [boards] = useState<any[]>(Array.isArray(initialBoards) ? initialBoards : []);
  const [tracks] = useState<any[]>(Array.isArray(initialTracks) ? initialTracks : []);
  
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [selectedStandard, setSelectedStandard] = useState<string>("");
  const [standards, setStandards] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [syllabusTree, setSyllabusTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedBoard) {
      setStandards([]);
      setSelectedStandard("");
      setSelectedBatch("");
      return;
    }
    fetchApi(`/setup/standards?boardId=${selectedBoard}`)
      .then((data: any) => {
        setStandards(Array.isArray(data) ? data : []);
        setSelectedStandard("");
        setSelectedBatch("");
      })
      .catch(console.error);
  }, [selectedBoard]);

  useEffect(() => {
    if (!selectedBatch) return;
    
    setLoading(true);
    fetchApi(`/syllabus/progress/${selectedBatch}`)
      .then((data: any) => {
        setSyllabusTree(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBatch]);

  const toggleSubject = (id: string) => setExpandedSubjects(p => ({ ...p, [id]: !p[id] }));
  const toggleChapter = (id: string) => setExpandedChapters(p => ({ ...p, [id]: !p[id] }));

  const updateTopicStatus = async (topicId: string, status: string) => {
    try {
      await fetchApi('/syllabus/progress/topic', {
        method: 'POST',
        body: JSON.stringify({ batchId: selectedBatch, topicId, status })
      });
      // Optimistic update
      setSyllabusTree(tree => tree.map(subj => ({
        ...subj,
        chapters: subj.chapters.map((chap: any) => {
          const hasTopic = chap.topics.some((t: any) => t.id === topicId);
          if (!hasTopic) return chap;
          
          const newTopics = chap.topics.map((t: any) => t.id === topicId ? { ...t, status } : t);
          const completedCount = newTopics.filter((t: any) => t.status === 'COMPLETED').length;
          const startedCount = newTopics.filter((t: any) => t.status !== 'NOT_STARTED').length;
          
          let newChapStatus = 'NOT_STARTED';
          if (completedCount === newTopics.length && newTopics.length > 0) newChapStatus = 'COMPLETED';
          else if (startedCount > 0) newChapStatus = 'IN_PROGRESS';
          
          return { ...chap, topics: newTopics, status: newChapStatus };
        })
      })));
    } catch (e) {
      console.error(e);
    }
  };

  const updateChapterStatus = async (chapterId: string, status: string) => {
    try {
      await fetchApi('/syllabus/progress/chapter', {
        method: 'POST',
        body: JSON.stringify({ batchId: selectedBatch, chapterId, status })
      });
      // Optimistic update
      setSyllabusTree(tree => tree.map(subj => ({
        ...subj,
        chapters: subj.chapters.map((chap: any) => {
          if (chap.id !== chapterId) return chap;
          if (status === 'COMPLETED' || status === 'NOT_STARTED') {
             return {
               ...chap,
               status,
               topics: chap.topics.map((t: any) => ({ ...t, status }))
             };
          }
          return { ...chap, status };
        })
      })));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTree = selectedSubject 
    ? syllabusTree.filter(subj => subj.subjectId === selectedSubject) 
    : syllabusTree;

  // Calculate Progress
  let totalTopics = 0;
  let completedTopics = 0;
  filteredTree.forEach(subj => {
    subj.chapters.forEach((chap: any) => {
      chap.topics.forEach((t: any) => {
        totalTopics++;
        if (t.status === 'COMPLETED') completedTopics++;
      });
    });
  });

  const percentage = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100);

  return (
    <DashboardLayout title="Syllabus Tracking">
      <div className="flex flex-col h-full bg-surface">
        
        {/* Header Section */}
        <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <BookOpenCheck className="h-6 w-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Syllabus Tracker</h1>
              <p className="text-xs text-text-muted mt-1">Track academic progress and completion status</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedBoard}
              onChange={e => setSelectedBoard(e.target.value)}
              className="h-10 rounded-lg border border-border-soft bg-surface-2 px-4 text-sm font-medium text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="">Select Board...</option>
              {boards.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={selectedStandard}
              onChange={e => {
                setSelectedStandard(e.target.value);
                setSelectedBatch("");
              }}
              disabled={!selectedBoard}
              className="h-10 rounded-lg border border-border-soft bg-surface-2 px-4 text-sm font-medium text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
            >
              <option value="">Select Class...</option>
              {standards.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={selectedTrack}
              onChange={e => {
                setSelectedTrack(e.target.value);
                setSelectedBatch("");
              }}
              className="h-10 rounded-lg border border-border-soft bg-surface-2 px-4 text-sm font-medium text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="">All Tracks...</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              disabled={!selectedStandard}
              className="h-10 rounded-lg border border-border-soft bg-surface-2 px-4 text-sm font-medium text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
            >
              <option value="">Select Batch...</option>
              {batches
                .filter(b => b.standardId === selectedStandard)
                .filter(b => !selectedTrack || b.trackId === selectedTrack)
                .map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {syllabusTree.length > 0 && (
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="h-10 rounded-lg border border-border-soft bg-brand-blue/5 text-brand-blue px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                <option value="">All Subjects</option>
                {syllabusTree.map(subj => (
                  <option key={subj.subjectId} value={subj.subjectId}>{subj.subjectName}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="px-6 lg:px-8 py-8 space-y-6 flex-1 overflow-y-auto">
          {/* Progress Dashboard */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6 flex items-center gap-8">
            <div className="relative h-24 w-24 shrink-0 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-surface-2" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="40" className="stroke-brand-blue transition-all duration-1000 ease-out" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * percentage) / 100} />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-text-primary">{percentage}%</span>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary mb-1">Overall Completion</h2>
              <p className="text-sm text-text-secondary">{completedTopics} out of {totalTopics} topics completed</p>
            </div>
          </div>

          {/* Tree View */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
            </div>
          ) : syllabusTree.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border-soft p-12 text-center">
              <div className="h-16 w-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpenCheck className="h-8 w-8 text-text-muted" />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">No Syllabus Found</h3>
              <p className="text-sm text-text-secondary max-w-sm mx-auto">This batch has no syllabus mapped to its board and class level. Go to System Setup to map the syllabus.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTree.map(subject => (
                <div key={subject.subjectId} className="bg-white rounded-2xl border border-border-soft overflow-hidden shadow-sm">
                  
                  {/* Subject Header */}
                  <div 
                    onClick={() => toggleSubject(subject.subjectId)}
                    className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-surface-2 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-3">
                      {expandedSubjects[subject.subjectId] ? (
                        <ChevronDown className="h-5 w-5 text-text-muted group-hover:text-text-primary transition-colors" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-text-primary transition-colors" />
                      )}
                      <h3 className="text-sm font-bold text-text-primary">{subject.subjectName}</h3>
                    </div>
                  </div>

                  {/* Chapters */}
                  {expandedSubjects[subject.subjectId] && (
                    <div className="border-t border-border-soft bg-surface-2/50 divide-y divide-border-soft">
                      {subject.chapters.length === 0 && (
                        <div className="px-14 py-4 text-xs font-medium text-text-muted">No chapters found for this subject.</div>
                      )}
                      {subject.chapters.map((chapter: any) => (
                        <div key={chapter.id} className="flex flex-col">
                          
                          {/* Chapter Header */}
                          <div className="flex items-center justify-between px-6 py-3 pl-14 hover:bg-surface transition-colors group">
                            <div 
                              className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                              onClick={() => toggleChapter(chapter.id)}
                            >
                              {expandedChapters[chapter.id] ? (
                                <ChevronDown className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
                              )}
                              <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">{chapter.name}</span>
                            </div>
                            
                            {/* Chapter Status Toggle (if no topics, or override) */}
                            {role !== 'STUDENT' && chapter.topics.length === 0 ? (
                              <select 
                                value={chapter.status}
                                onChange={e => updateChapterStatus(chapter.id, e.target.value)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-md border focus:outline-none ${
                                  chapter.status === 'COMPLETED' ? 'bg-success/10 border-success/20 text-success' :
                                  chapter.status === 'IN_PROGRESS' ? 'bg-warning/10 border-warning/20 text-warning' :
                                  'bg-surface-3 border-border-soft text-text-muted'
                                }`}
                              >
                                <option value="NOT_STARTED">Not Started</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${
                                chapter.status === 'COMPLETED' ? 'bg-success/10 border-success/20 text-success' :
                                chapter.status === 'IN_PROGRESS' ? 'bg-warning/10 border-warning/20 text-warning' :
                                'bg-surface-3 border-border-soft text-text-muted'
                              }`}>
                                {chapter.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3" />}
                                {chapter.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>

                          {/* Topics */}
                          {expandedChapters[chapter.id] && (
                            <div className="bg-white border-t border-border-soft divide-y divide-border-soft/50">
                              {chapter.topics.map((topic: any) => (
                                <div key={topic.id} className="flex items-center justify-between px-6 py-3 pl-24 hover:bg-surface-2/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-border-soft"></div>
                                    <span className="text-xs font-medium text-text-secondary">{topic.name}</span>
                                  </div>
                                  
                                  {role !== 'STUDENT' ? (
                                    <select 
                                      value={topic.status}
                                      onChange={e => updateTopicStatus(topic.id, e.target.value)}
                                      className={`text-[10px] font-bold px-2 py-1 rounded-md border focus:outline-none cursor-pointer ${
                                        topic.status === 'COMPLETED' ? 'bg-success/10 border-success/20 text-success' :
                                        topic.status === 'IN_PROGRESS' ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue' :
                                        'bg-surface border-border-soft text-text-muted hover:bg-surface-3'
                                      }`}
                                    >
                                      <option value="NOT_STARTED">Not Started</option>
                                      <option value="IN_PROGRESS">In Progress</option>
                                      <option value="COMPLETED">Completed</option>
                                    </select>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${
                                      topic.status === 'COMPLETED' ? 'bg-success/10 border-success/20 text-success' :
                                      topic.status === 'IN_PROGRESS' ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue' :
                                      'bg-surface-3 border-border-soft text-text-muted'
                                    }`}>
                                      {topic.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3" />}
                                      {topic.status.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
