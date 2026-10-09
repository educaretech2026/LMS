"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FileText, Plus, ChevronDown, CheckCircle, Clock, Upload, X, Loader2, Download } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { FileUploader } from "@/components/upload/file-uploader";

export function AssignmentsClient({ initialAssignments }: { initialAssignments: any[] }) {
  const { role } = useAuth();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  const refresh = () => fetchApi('/assignments').then((data: any) => setAssignments(data)).catch(console.error);

  return (
    <DashboardLayout title="Assignments">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Assignments</h1>
            <p className="text-sm text-text-secondary mt-1">
              {role === 'STUDENT' ? 'View and submit your assignments' : 'Create and manage assignments for your batches'}
            </p>
          </div>
          {role !== 'STUDENT' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-brand-blue/20">
              <Plus className="h-4 w-4" />
              New Assignment
            </button>
          )}
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-border-soft">
              <FileText className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary font-medium">No assignments found</p>
            </div>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} onClick={() => setSelectedAssignment(assignment)} className="bg-white rounded-2xl border border-border-soft p-5 hover:border-brand-blue/30 hover:shadow-md cursor-pointer transition-all flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-brand-blue/5 to-transparent rounded-bl-full -mr-4 -mt-4 opacity-50 transition-transform group-hover:scale-110"></div>
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="p-2.5 bg-surface-2 rounded-xl text-brand-blue">
                    <FileText className="h-5 w-5" />
                  </div>
                  {assignment.dueDate && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
                      <Clock className="h-3 w-3" />
                      Due {new Date(assignment.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1 relative z-10">
                  <h3 className="text-lg font-bold text-text-primary line-clamp-1">{assignment.title}</h3>
                  {assignment.batch?.track && assignment.batch.track !== "BOTH" && (
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                      {assignment.batch.track}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mb-4 line-clamp-2 min-h-[32px] relative z-10">{assignment.description || "No description provided."}</p>
                
                <div className="mt-auto pt-4 border-t border-border-soft flex items-center justify-between text-xs font-medium text-text-secondary relative z-10">
                  <span>{assignment.subject?.name || 'General'} • {assignment.batch?.name || 'All Batches'}</span>
                  {role !== 'STUDENT' ? (
                    <span className="text-brand-blue">{assignment._count?.submissions || 0} Submissions</span>
                  ) : (
                    assignment.submissions?.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-brand-green"><CheckCircle className="h-3.5 w-3.5" /> Submitted</span>
                    ) : (
                      <span className="text-warning">Pending</span>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && <CreateAssignmentModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); refresh(); }} />}
      {selectedAssignment && role === 'STUDENT' && <SubmitAssignmentModal assignment={selectedAssignment} onClose={() => setSelectedAssignment(null)} onSuccess={() => { setSelectedAssignment(null); refresh(); }} />}
      {selectedAssignment && role !== 'STUDENT' && <ViewSubmissionsModal assignmentId={selectedAssignment.id} onClose={() => setSelectedAssignment(null)} />}
    </DashboardLayout>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: CREATE ASSIGNMENT MODAL
// -----------------------------------------------------------------------------
function CreateAssignmentModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [targetTrack, setTargetTrack] = useState<"TUITION" | "ENTRANCE" | "BOTH" | "">("");
  
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    fetchApi('/setup/batches').then((data: any) => setBatches(data)).catch(console.error);
    fetchApi('/setup/subjects').then((data: any) => setSubjects(data)).catch(console.error);
  }, []);

  const [step, setStep] = useState<1 | 2>(1);
  const [attachments, setAttachments] = useState<any[]>([]);

  const handleUploadSuccess = (url: string) => {
    setAttachments([...attachments, { url, filename: "Attachment" }]);
    // We stay on step 2 so they can upload more or finish
  };

  const handleSave = async () => {
    if (!title || !batchId || !subjectId || !targetTrack) {
      setError("Title, batch, subject, and target track are required");
      return;
    }
    setSaving(true);
    try {
      await fetchApi('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title, description, dueDate, batchId, subjectId, targetTrack, attachments: attachments.length > 0 ? attachments : null
        })
      });
      onSuccess();
    } catch (e: any) {
      setError("Failed to create assignment");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-text-primary">Create Assignment</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-surface space-y-4">
          {error && <p className="text-xs text-brand-red bg-brand-red/10 p-3 rounded-lg border border-brand-red/20">{error}</p>}
          
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-white px-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-border-soft bg-white p-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Batch *</label>
                  <select value={batchId} onChange={e => setBatchId(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-white px-3 text-sm focus:ring-2 focus:ring-brand-blue/20" required>
                    <option value="" disabled>Select Batch</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Subject *</label>
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-white px-3 text-sm focus:ring-2 focus:ring-brand-blue/20" required>
                    <option value="" disabled>Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Due Date</label>
                  <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-white px-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Target Audience <span className="text-brand-red">*</span></label>
                  <div className="relative">
                    <select 
                      value={targetTrack} 
                      onChange={(e) => setTargetTrack(e.target.value as any)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                      required
                    >
                      <option value="" disabled>Select Target Audience</option>
                      <option value="BOTH">Both</option>
                      <option value="TUITION">Tuition</option>
                      <option value="ENTRANCE">Entrance</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setStep(2)} className="w-full py-2.5 text-sm font-bold text-brand-blue bg-brand-blue/10 rounded-lg">Add Attachments</button>
                <button onClick={handleSave} disabled={saving} className="w-full py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-lg flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Assignment"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploader type="FILE" onUploadSuccess={handleUploadSuccess} onUploadError={setError} onCancel={() => setStep(1)} />
              {attachments.length > 0 && (
                <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-brand-blue mb-2">Attachments ({attachments.length})</p>
                  <div className="flex flex-col gap-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="text-xs text-text-primary bg-white p-2 rounded flex items-center gap-2 border border-border-soft">
                        <FileText className="h-4 w-4 text-brand-blue" />
                        Attachment {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleSave} disabled={saving} className="w-full py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-lg flex items-center justify-center gap-2 mt-4">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Assignment"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: SUBMIT ASSIGNMENT MODAL
// -----------------------------------------------------------------------------
function SubmitAssignmentModal({ assignment, onClose, onSuccess }: { assignment: any, onClose: () => void, onSuccess: () => void }) {
  const existingSubmission = assignment.submissions?.[0];
  const [notes, setNotes] = useState(existingSubmission?.notes || "");
  const [attachments, setAttachments] = useState<any[]>(existingSubmission?.attachments || []);
  const [saving, setSaving] = useState(false);

  const handleUploadSuccess = (url: string) => {
    setAttachments([...attachments, { url, filename: "Submission" }]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await fetchApi(`/assignments/${assignment.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ notes, attachments })
      });
      
      // Update syllabus progress
      if (assignment.topicId && assignment.batchId) {
        try {
          await fetchApi(`/syllabus/student-progress/event`, {
            method: 'POST',
            body: JSON.stringify({
              batchId: assignment.batchId,
              topicId: assignment.topicId,
              type: 'SUBMIT_ASSIGNMENT'
            })
          });
        } catch (err) {
          console.error("Failed to update syllabus progress", err);
        }
      }
      
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-text-primary">{assignment.title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-surface grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Assignment Details</h3>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{assignment.description}</p>
            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className="pt-4 border-t border-border-soft">
                <h4 className="text-xs font-bold text-text-secondary mb-2">Teacher Attachments</h4>
                <div className="space-y-2">
                  {assignment.attachments.map((a: any, i: number) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-border-soft bg-white hover:border-brand-blue transition-colors group">
                      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <FileText className="h-4 w-4 text-brand-blue" />
                        Attachment {i + 1}
                      </div>
                      <Download className="h-4 w-4 text-text-muted group-hover:text-brand-blue" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Your Submission</h3>
            {existingSubmission && existingSubmission.status === 'GRADED' ? (
              <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4">
                <p className="text-xs font-bold text-brand-green mb-1">Graded</p>
                <p className="text-2xl font-black text-brand-green">{existingSubmission.grade}</p>
                {existingSubmission.feedback && <p className="text-sm text-text-secondary mt-2">"{existingSubmission.feedback}"</p>}
              </div>
            ) : null}

            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Add any notes for the teacher..."
              rows={3} 
              className="w-full rounded-xl border border-border-soft bg-white p-3 text-sm focus:ring-2 focus:ring-brand-blue/20"
              disabled={existingSubmission?.status === 'GRADED'}
            />

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((a: any, i: number) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 rounded-lg border border-brand-blue/30 bg-brand-blue/5 text-sm font-bold text-brand-blue">
                    <CheckCircle className="h-4 w-4" /> Submission File {i + 1}
                  </a>
                ))}
              </div>
            )}

            {existingSubmission?.status !== 'GRADED' && (
              <div className="pt-2 border-t border-border-soft">
                <FileUploader type="FILE" onUploadSuccess={handleUploadSuccess} onUploadError={console.error} onCancel={() => {}} />
                <button 
                  onClick={handleSubmit} 
                  disabled={saving || (attachments.length === 0 && !notes.trim())} 
                  className="w-full mt-4 py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-dark rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Assignment"}
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
function ViewSubmissionsModal({ assignmentId, onClose }: { assignmentId: string, onClose: () => void }) {
  const [assignment, setAssignment] = useState<any>(null);

  useEffect(() => {
    fetchApi(`/assignments/${assignmentId}`).then(setAssignment).catch(console.error);
  }, [assignmentId]);

  const handleGrade = async (subId: string, grade: number, feedback: string) => {
    try {
      await fetchApi(`/assignments/submissions/${subId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade, feedback })
      });
      fetchApi(`/assignments/${assignmentId}`).then(setAssignment);
    } catch (e) {
      console.error(e);
    }
  };

  if (!assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">{assignment.title}</h2>
            <p className="text-xs text-text-secondary mt-0.5">{assignment.submissions?.length || 0} Submissions</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          {assignment.submissions?.length === 0 ? (
            <p className="text-center py-10 text-text-muted text-sm font-medium">No submissions yet.</p>
          ) : (
            <div className="grid gap-4">
              {assignment.submissions?.map((sub: any) => (
                <div key={sub.id} className="bg-white rounded-xl border border-border-soft p-5 flex flex-col sm:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="font-bold text-text-primary">{sub.student.user.firstName} {sub.student.user.lastName}</h3>
                    <p className="text-xs text-text-secondary mb-3">Admission No: {sub.student.admissionNo}</p>
                    
                    {sub.notes && <p className="text-sm text-text-primary bg-surface-2 p-3 rounded-lg mb-3">"{sub.notes}"</p>}
                    
                    {sub.attachments?.map((a: any, i: number) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue/10 text-brand-blue text-xs font-bold rounded-lg hover:bg-brand-blue/20 transition-colors mr-2 mb-2">
                        <FileText className="h-3.5 w-3.5" /> View Attached File {i + 1}
                      </a>
                    ))}
                  </div>
                  
                  <div className="sm:w-64 shrink-0 p-4 rounded-xl border border-border-soft bg-surface-2/50 flex flex-col gap-3">
                    <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Grading</h4>
                    {sub.status === 'GRADED' ? (
                      <div>
                        <div className="text-xl font-black text-brand-green">{sub.grade}</div>
                        <p className="text-xs text-text-secondary mt-1">{sub.feedback}</p>
                      </div>
                    ) : (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        handleGrade(sub.id, Number(formData.get('grade')), formData.get('feedback') as string);
                      }} className="space-y-3">
                        <input type="number" name="grade" placeholder="Marks" required className="w-full h-8 rounded border border-border-soft px-2 text-sm" />
                        <textarea name="feedback" placeholder="Feedback (optional)" rows={2} className="w-full rounded border border-border-soft p-2 text-sm"></textarea>
                        <button type="submit" className="w-full py-1.5 bg-text-primary text-white text-xs font-bold rounded hover:bg-black transition-colors">Submit Grade</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
