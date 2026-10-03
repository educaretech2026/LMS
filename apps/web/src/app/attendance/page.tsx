"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { CalendarCheck, Search, Loader2, Save, UserCheck, UserX, Clock } from "lucide-react";
import { fetchApi } from "@/lib/api";

type Student = {
  studentId: string;
  name: string;
  admissionNo: string;
};

type Record = {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remarks: string;
};

export default function AttendancePage() {
  const [centres, setCentres] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  
  const [selectedCentre, setSelectedCentre] = useState<string>("");
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [selectedStandard, setSelectedStandard] = useState<string>("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi("/setup/centres").then(d => setCentres(Array.isArray(d) ? d : [])).catch(() => {});
    fetchApi("/setup/boards").then(d => setBoards(Array.isArray(d) ? d : [])).catch(() => {});
    fetchApi("/setup/subjects").then(d => setSubjects(Array.isArray(d) ? d : [])).catch(() => {});
    fetchApi("/setup/tracks").then(d => setTracks(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedBoard) {
      fetchApi(`/setup/standards?boardId=${selectedBoard}`).then(d => setStandards(Array.isArray(d) ? d : [])).catch(() => {});
    } else {
      setStandards([]);
    }
  }, [selectedBoard]);

  useEffect(() => {
    if (selectedCentre && selectedBoard && selectedStandard) {
      const query = `?centreId=${selectedCentre}&boardId=${selectedBoard}&standardId=${selectedStandard}${selectedTrack ? `&trackId=${selectedTrack}` : ''}`;
      fetchApi(`/attendance/batches/filter${query}`).then(d => setBatches(Array.isArray(d) ? d : [])).catch(() => {});
    } else {
      setBatches([]);
      setSelectedBatch("");
    }
  }, [selectedCentre, selectedBoard, selectedStandard, selectedTrack]);

  const loadAttendance = async () => {
    if (!selectedBatch) return;
    
    setLoading(true);
    try {
      // 1. Fetch Students in Batch
      const subjectQuery = selectedSubject ? `?subjectId=${selectedSubject}` : "";
      const stdData = (await fetchApi(`/attendance/students/${selectedBatch}${subjectQuery}`)) as any;
      setStudents(stdData);

      // 2. Fetch Existing Attendance
      const attQuery = selectedSubject ? `&subjectId=${selectedSubject}` : "";
      const attData = (await fetchApi(`/attendance/${selectedBatch}?date=${date}${attQuery}`)) as any;
      
      if (attData && attData.records) {
        setRecords(stdData.map((s: any) => {
          const existing = attData.records.find((r: any) => r.studentId === s.studentId);
          return {
            studentId: s.studentId,
            status: existing ? existing.status : "PRESENT",
            remarks: existing?.remarks || ""
          };
        }));
      } else {
        // Initialize default to PRESENT
        setRecords(stdData.map((s: any) => ({
          studentId: s.studentId,
          status: "PRESENT",
          remarks: ""
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      loadAttendance();
    } else {
      setStudents([]);
      setRecords([]);
    }
  }, [selectedBatch, date, selectedSubject]);

  const updateRecord = (studentId: string, status: string, remarks: string = "") => {
    setRecords(prev => {
      const exists = prev.find(r => r.studentId === studentId);
      if (exists) {
        return prev.map(r => r.studentId === studentId ? { ...r, status: status as any, remarks } : r);
      } else {
        return [...prev, { studentId, status: status as any, remarks }];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi("/attendance", {
        method: "POST",
        body: JSON.stringify({ 
          batchId: selectedBatch,
          date, 
          records,
          subjectId: selectedSubject || undefined
        })
      });
      alert("Attendance saved successfully!");
    } catch (e) {
      alert("Error saving attendance.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = records.filter(r => r.status === "PRESENT").length;
  const absentCount = records.filter(r => r.status === "ABSENT").length;
  const lateCount = records.filter(r => r.status === "LATE").length;

  return (
    <DashboardLayout title="Attendance Tracker">
      <PageShell
        title="Attendance Tracker"
        subtitle="Mark and manage daily student attendance"
        icon={CalendarCheck}
        accentColor="blue"
        actions={
          <button 
            onClick={handleSave}
            disabled={saving || students.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Attendance
          </button>
        }
      >
        
        <div className="bg-white rounded-xl border border-border-soft p-4 shadow-sm">
          <div className="grid grid-cols-6 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Centre</label>
              <select 
                value={selectedCentre} 
                onChange={e => setSelectedCentre(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">Select Centre</option>
                {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Board</label>
              <select 
                value={selectedBoard} 
                onChange={e => setSelectedBoard(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">Select Board</option>
                {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Class</label>
              <select 
                value={selectedStandard} 
                onChange={e => setSelectedStandard(e.target.value)}
                disabled={!selectedBoard}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
              >
                <option value="">Select Class</option>
                {standards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Track</label>
              <select 
                value={selectedTrack} 
                onChange={e => setSelectedTrack(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">All Tracks</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Division</label>
              <select 
                value={selectedBatch} 
                onChange={e => setSelectedBatch(e.target.value)}
                disabled={batches.length === 0}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-50"
              >
                <option value="">Select Division</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Subject (Optional)</label>
              <select 
                value={selectedSubject} 
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">All Subjects (Batch Level)</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>
        </div>

        {/* Status Dashboard */}
        {students.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-xl border border-border-soft p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-text-muted uppercase">Total Students</p>
              <p className="text-2xl font-black mt-1 text-text-primary">{students.length}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-green-700 uppercase">Present</p>
              <p className="text-2xl font-black mt-1 text-green-700 flex items-center justify-center gap-1"><UserCheck className="h-5 w-5" /> {presentCount}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-red-700 uppercase">Absent</p>
              <p className="text-2xl font-black mt-1 text-red-700 flex items-center justify-center gap-1"><UserX className="h-5 w-5" /> {absentCount}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 shadow-sm text-center">
              <p className="text-[11px] font-bold text-amber-700 uppercase">Late</p>
              <p className="text-2xl font-black mt-1 text-amber-700 flex items-center justify-center gap-1"><Clock className="h-5 w-5" /> {lateCount}</p>
            </div>
          </div>
        )}

        {/* Attendance List */}
        <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden mt-6 h-[50vh] flex flex-col">
          {loading ? (
             <div className="flex-1 flex items-center justify-center">
               <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
             </div>
          ) : students.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
              <p className="text-sm">No students found for these filters.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 z-10 border-b border-border-soft">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/3">Student</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-1/3">Remarks (Optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {students.map((student) => {
                    const record = records.find(r => r.studentId === student.studentId) || { status: 'PRESENT', remarks: '' };

                    return (
                      <tr key={student.studentId} className={`hover:bg-surface-2/30 transition-colors ${record.status === 'ABSENT' ? 'bg-red-50/50' : ''}`}>
                        <td className="px-5 py-4">
                          <p className="font-bold text-text-primary">{student.name}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">ID: {student.admissionNo}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((status) => (
                              <button
                                key={status}
                                onClick={() => updateRecord(student.studentId, status, record.remarks)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                                  record.status === status
                                    ? status === "PRESENT" ? "bg-green-100 border-green-200 text-green-700"
                                    : status === "ABSENT" ? "bg-red-100 border-red-200 text-red-700"
                                    : status === "LATE" ? "bg-amber-100 border-amber-200 text-amber-700"
                                    : "bg-blue-100 border-blue-200 text-blue-700"
                                    : "bg-white border-border-soft text-text-secondary hover:bg-surface"
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <input 
                            type="text" 
                            placeholder="Add note (e.g. sick, traffic)" 
                            value={record.remarks}
                            onChange={(e) => updateRecord(student.studentId, record.status, e.target.value)}
                            className="w-full h-8 rounded-md border border-border-soft bg-surface px-3 text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </PageShell>
    </DashboardLayout>
  );
}
