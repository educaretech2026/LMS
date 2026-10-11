"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Clock, AlertCircle, ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function TakeExamPage() {
  const router = useRouter();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchApi<any>(`/exams/${id}`)
      .then((data) => {
        setExam(data);
        const qCount = data?.mcqQuestions?.length || 0;
        setAnswers(Array(qCount).fill(null));
        const durationMinutes = data?.duration || 60;
        setTimeLeft(durationMinutes * 60);
      })
      .catch((err) => {
        console.error("Failed to load exam", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const questions = exam?.mcqQuestions || [];

  const submit = useCallback(async () => {
    if (submitted || submitting) return;
    setSubmitting(true);

    try {
      // Calculate score
      let earned = 0;
      let total = 0;
      const answerPayload: Record<string, string> = {};

      questions.forEach((q: any, i: number) => {
        const marks = Number(q.marks || 4);
        const neg = Number(q.negativeMarks || 1);
        total += marks;

        const ansIdx = answers[i];
        const rawOptions = Array.isArray(q.options) ? q.options : [];
        const selectedText = ansIdx !== null && ansIdx !== undefined ? (typeof rawOptions[ansIdx] === 'string' ? rawOptions[ansIdx] : rawOptions[ansIdx]?.text) : null;

        if (selectedText) {
          answerPayload[q.id] = selectedText;
          if (selectedText === q.correctOption) {
            earned += marks;
          } else {
            earned = Math.max(0, earned - neg);
          }
        }
      });

      if (id) {
        await fetchApi(`/exams/${id}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            answers: answerPayload,
            score: { earned, total }
          })
        }).catch(console.error);
      }
    } catch (e) {
      console.error("Error submitting attempt", e);
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  }, [submitted, submitting, questions, answers, id]);

  useEffect(() => {
    if (!started || submitted) return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          submit();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, submitted, submit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
          <p className="text-sm font-medium text-text-muted">Loading exam details...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-border-soft p-8 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-brand-red mx-auto mb-3" />
          <h2 className="text-base font-bold text-text-primary">Exam Not Found</h2>
          <p className="text-xs text-text-muted mt-1">This examination may have been removed or is unavailable.</p>
          <button onClick={() => router.push("/exam")} className="mt-5 w-full rounded-lg bg-brand-blue py-2 text-xs font-semibold text-white">
            Return to Exams
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-border-soft p-8 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-warning mx-auto mb-3" />
          <h2 className="text-base font-bold text-text-primary">No Questions in Exam</h2>
          <p className="text-xs text-text-muted mt-1">The teacher has not added questions to this examination yet.</p>
          <button onClick={() => router.push("/exam")} className="mt-5 w-full rounded-lg bg-brand-blue py-2 text-xs font-semibold text-white">
            Return to Exams
          </button>
        </div>
      </div>
    );
  const subjectName = typeof exam.subject === 'object' ? exam.subject?.name : (exam.subject || 'General');
  const durationMinutes = exam.duration || 60;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const isUrgent = timeLeft < 5 * 60;

  /* ── Results ── */
  if (submitted) {
    let earned = 0;
    let totalMarks = 0;
    questions.forEach((q: any, i: number) => {
      const marks = Number(q.marks || 4);
      totalMarks += marks;
      const ansIdx = answers[i];
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const selectedText = ansIdx !== null && ansIdx !== undefined ? (typeof rawOptions[ansIdx] === 'string' ? rawOptions[ansIdx] : rawOptions[ansIdx]?.text) : null;
      if (selectedText === q.correctOption) {
        earned += marks;
      }
    });
    const pct = totalMarks > 0 ? Math.round((earned / totalMarks) * 100) : 0;
    const passed = pct >= 40;

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-border-soft shadow-lg overflow-hidden">
          <div className={`p-8 text-center ${passed ? "bg-success/5" : "bg-brand-red/5"}`}>
            <div className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center mb-4 ${passed ? "bg-success/10" : "bg-brand-red/10"}`}>
              <CheckCircle2 className={`h-10 w-10 ${passed ? "text-success" : "text-brand-red"}`} />
            </div>
            <p className="text-4xl font-bold tracking-tight text-text-primary">{pct}%</p>
            <p className={`text-sm font-semibold mt-1 ${passed ? "text-success" : "text-brand-red"}`}>
              {passed ? "Passed 🎉" : "Needs Review"}
            </p>
            <p className="text-xs text-text-muted mt-1">{earned} / {totalMarks} Marks</p>
          </div>
          <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
            {questions.map((q: any, i: number) => {
              const ansIdx = answers[i];
              const rawOptions = Array.isArray(q.options) ? q.options : [];
              const selectedText = ansIdx !== null && ansIdx !== undefined ? (typeof rawOptions[ansIdx] === 'string' ? rawOptions[ansIdx] : rawOptions[ansIdx]?.text) : null;
              const correct = selectedText === q.correctOption;
              return (
                <div key={q.id || i} className={`rounded-lg p-3 border ${correct ? "border-success/20 bg-success/5" : "border-brand-red/20 bg-brand-red/5"}`}>
                  <p className="text-xs font-medium text-text-primary mb-1.5">{i + 1}. {q.questionText || q.text}</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={correct ? "text-success font-semibold" : "text-brand-red font-medium"}>
                      Your answer: {selectedText || "Not answered"}
                    </span>
                    {!correct && <span className="text-success font-semibold">Correct: {q.correctOption}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 pb-6">
            <button onClick={() => router.push("/exam")} className="w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors">
              Back to Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Instructions ── */
  if (!started) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-border-soft shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-brand-blue-dark to-brand-blue p-6">
            <p className="text-white/70 text-xs mb-1">{subjectName}</p>
            <h1 className="text-lg font-bold text-white">{exam.title}</h1>
            <div className="flex items-center gap-4 mt-3 text-white/70 text-xs">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{durationMinutes} minutes</span>
              <span>{questions.length} questions</span>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-surface-2 border border-border-soft p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-text-primary mb-1">Instructions</p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Read each question carefully. Select the best option. Each correct answer earns marks as shown. Good luck!
                  </p>
                </div>
              </div>
            </div>
            <button onClick={() => setStarted(true)} className="w-full rounded-lg bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm">
              Start Exam
            </button>
            <button onClick={() => router.back()} className="w-full text-xs font-medium text-text-muted hover:text-text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Exam UI ── */
  const q = questions[current];
  const answered = answers.filter((a) => a !== null).length;
  const rawOptions = Array.isArray(q?.options) ? q.options : [];
  const options = rawOptions.map((opt: any) => typeof opt === 'string' ? opt : (opt?.text || ''));

  const select = (i: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const n = [...prev];
      n[current] = i;
      return n;
    });
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-border-soft px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-sm font-semibold text-text-primary">{exam.title}</p>
          <p className="text-xs text-text-muted">Question {current + 1} of {questions.length}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted">{answered}/{questions.length} answered</span>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold border ${isUrgent ? "bg-brand-red/10 border-brand-red/25 text-brand-red" : "bg-brand-blue/8 border-brand-blue/20 text-brand-blue"}`}>
            <Clock className="h-3.5 w-3.5" />
            {mm}:{ss}
          </div>
        </div>
      </div>

      {/* Question palette */}
      <div className="border-b border-border-soft bg-white px-6 py-3 flex items-center gap-2 overflow-x-auto">
        {questions.map((_: any, i: number) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-7 w-7 rounded text-xs font-semibold shrink-0 transition-colors ${
              i === current ? "bg-brand-blue text-white" :
              answers[i] !== null ? "bg-success/15 text-success border border-success/30" :
              "bg-surface-2 text-text-muted border border-border-soft hover:border-brand-blue/40"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question body */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-5">
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Question {current + 1}</p>
              <span className="text-[11px] font-medium text-text-muted">+{q?.marks || 4} / -{q?.negativeMarks || 1} marks</span>
            </div>
            <p className="text-base font-medium text-text-primary leading-relaxed">{q?.questionText || q?.text}</p>
            {q?.imageUrl && (
              <img src={q.imageUrl} alt="Question Diagram" className="mt-4 max-h-60 rounded-lg border border-border-soft object-contain" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt: string, i: number) => {
              const selected = answers[current] === i;
              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                    selected
                      ? "border-brand-blue bg-brand-blue/5 shadow-sm"
                      : "border-border-soft bg-white hover:border-brand-blue/30"
                  }`}
                >
                  <span className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${selected ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft text-text-muted"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={`text-sm ${selected ? "font-semibold text-brand-blue" : "text-text-secondary"}`}>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0} className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-white px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-2 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            {current < questions.length - 1 ? (
              <button onClick={() => setCurrent((p) => Math.min(questions.length - 1, p + 1))} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-medium text-white hover:bg-brand-blue-dark transition-colors">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
