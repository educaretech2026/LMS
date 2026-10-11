"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ArrowLeft, Clock, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function MCQExamPreviewPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetchApi<any>(`/exams/${id}`)
      .then((data) => {
        setExam(data);
      })
      .catch((err) => {
        console.error("Failed to load exam", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Exam Preview">
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
            <p className="text-sm font-medium text-text-muted">Loading exam details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!exam) {
    return (
      <DashboardLayout title="Exam Preview">
        <div className="p-8 text-center max-w-md mx-auto">
          <AlertCircle className="h-10 w-10 text-brand-red mx-auto mb-3" />
          <h2 className="text-base font-bold text-text-primary">Exam Not Found</h2>
          <p className="text-xs text-text-muted mt-1">This exam may have been deleted or is unavailable.</p>
          <Link
            href="/exam/mcq"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to MCQ Exams
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const subjectName = typeof exam.subject === 'object' ? exam.subject?.name : (exam.subject || '-');
  const questions = exam.mcqQuestions || [];
  const totalMarks = questions.reduce((acc: number, q: any) => acc + Number(q.marks || 4), 0);

  return (
    <DashboardLayout title={`Preview: ${exam.title}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-border-soft bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/exam/mcq')}
              className="p-1.5 rounded-lg border border-border-soft hover:bg-surface-2 text-text-secondary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">
                  {subjectName}
                </span>
                <h2 className="text-base font-semibold text-text-primary">{exam.title}</h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">MCQ Exam Preview & Answer Key</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/exam/${exam.id}/results`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> View Results
            </Link>
            <Link
              href={`/exam/mcq/${exam.id}/take`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm"
            >
              Take Exam Mode
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full">
          {/* Summary Box */}
          <div className="bg-white rounded-xl border border-border-soft p-5 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-muted">Total Questions</p>
              <p className="text-lg font-bold text-text-primary mt-0.5">{questions.length}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Marks</p>
              <p className="text-lg font-bold text-text-primary mt-0.5">{totalMarks}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Duration</p>
              <p className="text-lg font-bold text-text-primary mt-0.5">{exam.duration || 60} mins</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Target Track</p>
              <p className="text-lg font-bold text-brand-blue mt-0.5">{exam.targetTrack?.name || 'General'}</p>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Questions & Solutions ({questions.length})</h3>

            {questions.length === 0 ? (
              <div className="bg-white rounded-xl border border-border-soft p-10 text-center text-text-muted text-sm">
                No questions added to this examination yet.
              </div>
            ) : (
              questions.map((q: any, i: number) => {
                const rawOptions = Array.isArray(q.options) ? q.options : [];
                const options = rawOptions.map((opt: any) => typeof opt === 'string' ? opt : (opt?.text || ''));

                return (
                  <div key={q.id || i} className="bg-white rounded-xl border border-border-soft shadow-sm p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <h4 className="text-sm font-medium text-text-primary">{q.questionText || q.text}</h4>
                      </div>
                      <span className="text-[11px] font-semibold text-text-muted bg-surface-2 px-2.5 py-1 rounded-md shrink-0">
                        +{q.marks || 4} / -{q.negativeMarks || 1} M
                      </span>
                    </div>

                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="Question Attachment" className="max-h-64 rounded-lg border border-border-soft object-contain" />
                    )}

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {options.map((opt: string, optIdx: number) => {
                        const isCorrect = opt === q.correctOption;
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-xs ${
                              isCorrect
                                ? "border-success/40 bg-success/5 font-semibold text-success"
                                : "border-border-soft bg-surface-2 text-text-secondary"
                            }`}
                          >
                            <span
                              className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect ? "bg-success text-white" : "border border-border-soft text-text-muted"
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="pt-2 border-t border-border-soft text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
