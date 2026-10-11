"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { FileText, Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ExamResultsPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const calculateGrade = (earned: number, max: number) => {
    if (!max || max <= 0) return 'F';
    const pct = (earned / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'F';
  };

  useEffect(() => {
    Promise.all([
      fetchApi(`/exams`).then((data: any) => {
        const found = data.find((e: any) => e.id === id);
        setExam(found);
      }),
      fetchApi(`/exams/${id}/students`),
      fetchApi(`/exams/${id}/results`)
    ]).then(([_, stds, resData]: any) => {
      setStudents(stds);
      
      if (resData && resData.length > 0) {
        setResults(stds.map((s: any) => {
          const existing = resData.find((r: any) => r.studentId === s.studentId);
          const earned = Number(existing?.marksObtained || 0);
          const max = Number(existing?.maxMarks || 100);
          return {
            studentId: s.studentId,
            marksObtained: earned,
            maxMarks: max,
            grade: existing?.grade || calculateGrade(earned, max),
            remarks: existing?.remarks || ""
          };
        }));
      } else {
        setResults(stds.map((s: any) => ({
          studentId: s.studentId,
          marksObtained: 0,
          maxMarks: 100,
          grade: "F",
          remarks: ""
        })));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const updateResult = (studentId: string, field: string, value: any) => {
    setResults(prev => prev.map(r => {
      if (r.studentId !== studentId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'marksObtained' || field === 'maxMarks') {
        const earned = Number(field === 'marksObtained' ? value : updated.marksObtained);
        const max = Number(field === 'maxMarks' ? value : updated.maxMarks);
        updated.grade = calculateGrade(earned, max);
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/exams/${id}/results`, {
        method: "POST",
        body: JSON.stringify({ results })
      });
      alert("Results saved successfully!");
      router.push("/exam/mcq");
    } catch (error) {
      alert("Failed to save results.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardLayout title="Loading..."><div className="p-8 text-center text-text-muted mt-20">Loading student list...</div></DashboardLayout>;

  return (
    <DashboardLayout title="Exam Results">
      <PageShell
        title={`Results: ${exam?.title || 'Exam'}`}
        subtitle="Enter and manage marks for enrolled students"
        icon={FileText}
        accentColor="blue"
        actions={
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="px-4 py-2 text-xs font-semibold rounded-lg hover:bg-surface-2 transition-colors border border-border-soft">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Results
            </button>
          </div>
        }
      >
        <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface sticky top-0 border-b border-border-soft">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Student Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Admission No</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Marks Obtained</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Max Marks</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Grade</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {students.map(student => {
                  const record = results.find(r => r.studentId === student.studentId) || {};
                  return (
                    <tr key={student.studentId} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 font-bold text-text-primary">{student.name}</td>
                      <td className="px-5 py-3 text-xs text-text-secondary">{student.admissionNo}</td>
                      <td className="px-5 py-3 text-center">
                        <input 
                          type="number" 
                          value={record.marksObtained}
                          onChange={e => updateResult(student.studentId, 'marksObtained', e.target.value)}
                          className="w-20 text-center rounded border border-border-soft px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input 
                          type="number" 
                          value={record.maxMarks}
                          onChange={e => updateResult(student.studentId, 'maxMarks', e.target.value)}
                          className="w-20 text-center rounded border border-border-soft px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input 
                          type="text" 
                          value={record.grade}
                          onChange={e => updateResult(student.studentId, 'grade', e.target.value)}
                          className="w-16 text-center rounded border border-border-soft px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all uppercase"
                          placeholder="A+"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input 
                          type="text" 
                          value={record.remarks}
                          onChange={e => updateResult(student.studentId, 'remarks', e.target.value)}
                          className="w-full rounded border border-border-soft px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                          placeholder="Optional notes"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {students.length === 0 && (
              <div className="py-12 text-center text-text-muted text-sm font-semibold">
                No eligible students found for this exam's batch/target.
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
