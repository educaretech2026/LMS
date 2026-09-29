"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import {
  ArrowLeft, Brain, CheckCircle2, XCircle, Clock, ChevronRight,
  ChevronLeft, Loader2, Trophy, RotateCcw, AlertCircle, BookOpen,
} from "lucide-react";
import { FileUploader } from "@/components/upload/file-uploader";

interface Option {
  key: string;
  text: string;
}

interface Question {
  id: string;
  type?: "MCQ" | "DESCRIPTIVE";
  questionText: string;
  imageUrl?: string;
  options: Option[] | Record<string, string>;
  correctOption: string;
  explanation?: string;
  marks: number;
  negativeMarks: number;
}

interface Exam {
  id: string;
  title: string;
  type: string;
  subject?: { name: string };
  chapter?: { name: string };
  topic?: { name: string };
  mcqQuestions: Question[];
}

type Phase = "loading" | "briefing" | "quiz" | "results";

function normalizeOptions(raw: any): { key: string; text: string }[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([key, text]) => ({ key, text: String(text) }));
  }
  return [];
}

export default function QuizPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState({ earned: 0, total: 0, correct: 0, wrong: 0, skipped: 0 });

  // Load exam
  useEffect(() => {
    fetchApi(`/exams`)
      .then((exams: any) => {
        const found = (exams as Exam[]).find(e => e.id === examId);
        if (!found) { setPhase("loading"); return; }
        setExam(found);
        const qs = found.mcqQuestions ?? [];
        setQuestions(qs);
        setTimeLeft(qs.length * 90); // 90 seconds per question
        setPhase("briefing");
      })
      .catch(console.error);
  }, [examId]);

  // Countdown timer during quiz
  useEffect(() => {
    if (phase !== "quiz") return;
    if (timeLeft <= 0) { finishQuiz(); return; }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft]);

  const finishQuiz = useCallback(async () => {
    let earned = 0, correct = 0, wrong = 0, skipped = 0, total = 0;
    questions.forEach(q => {
      total += q.marks;
      const a = answers[q.id];
      if (!a) { skipped++; return; }
      if (q.type === 'DESCRIPTIVE') return; // Descriptive questions are graded later
      
      if (a === q.correctOption) { earned += q.marks; correct++; }
      else { earned -= q.negativeMarks; wrong++; }
    });
    
    const finalScore = { earned: Math.max(0, earned), total, correct, wrong, skipped };
    setScore(finalScore);
    
    setPhase("loading");
    try {
      await fetchApi(`/exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          score: finalScore
        })
      });
      setPhase("results");
    } catch (error) {
      console.error(error);
      alert("Failed to submit exam results.");
      setPhase("results"); // Show results anyway
    }
  }, [questions, answers, examId]);

  const selectAnswer = (qId: string, key: string) => {
    setAnswers(prev => ({ ...prev, [qId]: key }));
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = questions.length ? Math.round((score.correct / questions.length) * 100) : 0;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
          <p className="text-sm text-gray-500 font-medium">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // ── Briefing ──────────────────────────────────────────────────────────────

  if (phase === "briefing" && exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Top banner */}
          <div className="bg-gradient-to-r from-brand-blue to-indigo-600 px-8 py-10 text-white text-center">
            <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            {exam.topic && <p className="text-blue-100 text-sm mt-1">{exam.topic.name}</p>}
          </div>

          <div className="p-8 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Questions", value: questions.length },
                { label: "Time", value: `${Math.floor(questions.length * 1.5)} min` },
                { label: "Marks", value: questions.reduce((s, q) => s + q.marks, 0) },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-400 font-medium mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Rules */}
            <div className="bg-amber-50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Rules</p>
              {[
                `+${questions[0]?.marks ?? 4} marks for each correct answer`,
                `-${questions[0]?.negativeMarks ?? 1} mark for each wrong answer`,
                "No marks for skipped questions",
                "Timer runs continuously — submit before time runs out",
              ].map(r => (
                <div key={r} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{r}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (questions.length === 0) return;
                  setCurrentIdx(0);
                  setPhase("quiz");
                }}
                disabled={questions.length === 0}
                className="flex-[2] py-3 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-blue-dark transition-colors disabled:opacity-50"
              >
                {questions.length === 0 ? "No questions yet" : "Start Quiz →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────

  if (phase === "quiz" && exam) {
    const q = questions[currentIdx];
    const opts = normalizeOptions(q.options);
    const selected = answers[q.id];
    const isLast = currentIdx === questions.length - 1;
    const answered = Object.keys(answers).length;
    const timePct = Math.max(0, (timeLeft / (questions.length * 90)) * 100);
    const isUrgent = timeLeft < 60;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => { if (confirm("Exit quiz? Your progress will be lost.")) router.back(); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium">
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400">{answered}/{questions.length} answered</span>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${isUrgent ? "bg-red-100 text-red-600" : "bg-blue-50 text-brand-blue"}`}>
              <Clock className="h-3.5 w-3.5" /> {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-brand-blue"}`}
            style={{ width: `${timePct}%` }}
          />
        </div>

        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
          {/* Question counter */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <button
              onClick={() => setFlagged(prev => {
                const n = new Set(prev);
                n.has(q.id) ? n.delete(q.id) : n.add(q.id);
                return n;
              })}
              className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${flagged.has(q.id) ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400 hover:bg-amber-50"}`}
            >
              {flagged.has(q.id) ? "★ Flagged" : "☆ Flag"}
            </button>
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {q.imageUrl && (
              <img src={q.imageUrl} alt="Question" className="w-full max-h-48 object-contain rounded-xl mb-4 bg-gray-50" />
            )}
            <p className="text-base font-semibold text-gray-800 leading-relaxed">{q.questionText}</p>
          </div>

          {/* Answer Area */}
          {q.type === 'DESCRIPTIVE' ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <p className="text-sm font-bold text-gray-700">Upload your answer (Image or PDF)</p>
              {selected ? (
                <div className="flex flex-col gap-2">
                  <a href={selected} target="_blank" rel="noreferrer" className="text-brand-blue underline text-sm break-all">View Uploaded File</a>
                  <button onClick={() => selectAnswer(q.id, "")} className="text-red-500 text-xs font-bold w-fit hover:underline">Remove File</button>
                </div>
              ) : (
                <FileUploader 
                  type="FILE"
                  onUploadSuccess={(url) => selectAnswer(q.id, url)}
                  onUploadError={(err) => alert(err)}
                  onCancel={() => {}}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {opts.map(opt => {
                const isSelected = selected === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => selectAnswer(q.id, opt.key)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? "border-brand-blue bg-brand-blue/5 shadow-sm"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                    }`}
                  >
                    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black transition-colors ${
                      isSelected ? "bg-brand-blue text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {opt.key.toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? "text-brand-blue" : "text-gray-700"}`}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <div className="flex-1" />
            {isLast ? (
              <button
                onClick={finishQuiz}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors"
              >
                Submit <CheckCircle2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-blue-dark transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Question palette */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Question Palette</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${
                    i === currentIdx ? "bg-brand-blue text-white" :
                    answers[qq.id] ? "bg-green-100 text-green-700" :
                    flagged.has(qq.id) ? "bg-amber-100 text-amber-600" :
                    "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────

  if (phase === "results" && exam) {
    const passed = pct >= 60;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Score banner */}
          <div className={`px-8 py-10 text-center ${passed ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-rose-600"}`}>
            <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              {passed ? <Trophy className="h-10 w-10 text-white" /> : <Brain className="h-10 w-10 text-white" />}
            </div>
            <p className="text-white/80 text-sm font-medium mb-1">{exam.title}</p>
            <p className="text-5xl font-black text-white">{pct}%</p>
            <p className="text-white/80 mt-2 text-sm">{passed ? "Great job! You passed." : "Keep practicing — you'll get there!"}</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: CheckCircle2, label: "Correct", value: score.correct, color: "text-green-600 bg-green-50" },
                { icon: XCircle, label: "Wrong", value: score.wrong, color: "text-red-600 bg-red-50" },
                { icon: AlertCircle, label: "Skipped", value: score.skipped, color: "text-gray-500 bg-gray-50" },
                { icon: Trophy, label: "Score", value: `${score.earned.toFixed(1)}/${score.total}`, color: "text-brand-blue bg-blue-50" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 flex items-center gap-3 ${s.color.split(" ")[1]}`}>
                  <s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} />
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                    <p className={`text-xl font-black ${s.color.split(" ")[0]}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Answer review */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Review Answers</p>
              {questions.map((q, i) => {
                const given = answers[q.id];
                const isCorrect = given === q.correctOption;
                const opts = normalizeOptions(q.options);
                const correctText = opts.find(o => o.key === q.correctOption)?.text ?? q.correctOption;
                return (
                  <div key={q.id} className={`rounded-xl border p-3 ${isCorrect ? "border-green-100 bg-green-50" : given ? "border-red-100 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> :
                       given ? <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> :
                       <AlertCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-700 truncate">Q{i + 1}. {q.questionText}</p>
                        {!isCorrect && (
                          <p className="text-[11px] text-green-600 mt-0.5">✓ Correct: {correctText}</p>
                        )}
                        {q.explanation && (
                          <p className="text-[11px] text-gray-400 mt-1 italic">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAnswers({});
                  setFlagged(new Set());
                  setCurrentIdx(0);
                  setTimeLeft(questions.length * 90);
                  setPhase("briefing");
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Retry
              </button>
              <button
                onClick={() => router.push("/estudy")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-blue-dark transition-colors"
              >
                <BookOpen className="h-4 w-4" /> Back to eStudy
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
