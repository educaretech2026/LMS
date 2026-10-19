"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Building2,
  Bell,
  Video,
  Database,
  Lock,
  Layers,
  Server,
  FileText,
  Check,
  ExternalLink,
  Menu,
  X,
  Clock,
  Calculator,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
type PillarKey = "academics" | "assessments" | "mentorship" | "operations";
type RoleLens = "SUPER_ADMIN" | "CAMPUS_ADMIN" | "TEACHER" | "STUDENT";

interface PillarData {
  id: PillarKey;
  label: string;
  badge: string;
  title: string;
  description: string;
  features: {
    title: string;
    description: string;
    specs: string[];
  }[];
}

const PILLARS: Record<PillarKey, PillarData> = {
  academics: {
    id: "academics",
    label: "Academic Delivery",
    badge: "Core Learning Engine",
    title: "Structured Curriculum Delivery Across Every Campus Tier",
    description:
      "Educare eliminates academic fragmentation by binding curriculum pacing directly to the institutional hierarchy: Academic Year › Campus Centre › Board › Class › Batch › Subject › Chapter › Topic.",
    features: [
      {
        title: "Batch-Wise Attendance Tracking",
        description:
          "Daily session marking for students and faculty with instant status flags (Present, Absent, Late, Excused) and at-risk attendance percentage detection.",
        specs: ["Interactive status registers", "Historical session registers", "Parent alert triggers"],
      },
      {
        title: "e-Study Digital Repository",
        description:
          "Structured learning material distribution mapped to chapters, supporting chapter PDFs, supplementary lecture recordings, and topic-level mastery quizzes.",
        specs: ["S3 presigned asset delivery", "Chapter & topic binding", "Student progress tracking"],
      },
      {
        title: "Integrated Live Virtual Classes",
        description:
          "WebRTC and LiveKit-powered virtual classrooms with batch scheduling, faculty controls, screen sharing, and automated room token generation.",
        specs: ["Zero external software", "Batch admission scoping", "Real-time room status"],
      },
      {
        title: "Syllabus Pacing & Lesson Logs",
        description:
          "Institutional syllabus trackers allow academic directors to verify planned vs completed topics across centres in real time.",
        specs: ["Pacing variance alerts", "Faculty topic sign-offs", "Annual term alignment"],
      },
    ],
  },
  assessments: {
    id: "assessments",
    label: "Examinations & Grading",
    badge: "Evaluation Architecture",
    title: "High-Integrity Testing, Timed Attempts, and Automated Grading",
    description:
      "From weekly topic quizzes to full-scale competitive entrance simulations, the examination engine enforces strict time windows, negative marking rules, and instant scorecards.",
    features: [
      {
        title: "Comprehensive MCQ Assessment Engine",
        description:
          "Build multi-section exams with custom positive/negative marking rules, mathematical formulas, and image-based questions.",
        specs: ["Negative marking support", "Timed auto-submission", "Randomized question order"],
      },
      {
        title: "Hierarchical Homework & Assignments",
        description:
          "Allocate assignments down to specific batches and target tracks. Collect student digital submissions with file attachments and faculty grading rubrics.",
        specs: ["Submission deadlines", "Faculty feedback scorecards", "Video explanation embeds"],
      },
      {
        title: "Chapter-Level Mastery Analytics",
        description:
          "Automated grade calculation generates individual student dossiers highlighting weak topics, mastery percentages, and peer cohort percentiles.",
        specs: ["Automated rank generation", "Topic difficulty weighting", "CSV gradebook exports"],
      },
      {
        title: "Credential & Certificate Issuance",
        description:
          "Generate tamper-evident course completion certificates and student identity cards equipped with scannable QR verification codes.",
        specs: ["Templated certificate engine", "Student ID card generator", "QR validation links"],
      },
    ],
  },
  mentorship: {
    id: "mentorship",
    label: "Mentorship & Alerts",
    badge: "Academic Safeguarding",
    title: "1-on-1 Academic Doubt Clearance with Structural Safeguards",
    description:
      "A dedicated academic communication framework connecting students directly with verified teachers. Unlike generic chat apps, Educare strictly prevents unmonitored student-to-student backchannels.",
    features: [
      {
        title: "Supervised 1-on-1 Doubt Channels",
        description:
          "Students initiate academic inquiries tagged to subjects. Verified faculty provide step-by-step solutions with rich image and PDF problem attachments.",
        specs: ["Zero student-to-student chat", "Supervisor audit badges", "Faculty re-assignment"],
      },
      {
        title: "Real-Time Notification Hub",
        description:
          "In-app sliding notification drawer categorized by streams (Doubts, Assignments, System Notices) with 15-second background synchronization.",
        specs: ["Categorized alert streams", "Direct deep-linking", "Single-click mark read"],
      },
      {
        title: "Automated SMS & Urgent Dispatches",
        description:
          "Broadcast emergency campus closures, critical fee reminders, and attendance absentee alerts directly to parents via integrated SMS gateways.",
        specs: ["Batch SMS broadcast", "Template compliance", "Delivery status tracking"],
      },
      {
        title: "Internal Support Help Desk",
        description:
          "Structured ticketing for administrative requests, technical inquiries, and student grievances with full resolution audit trails.",
        specs: ["SLA status workflows", "Internal note threads", "Role-based assignment"],
      },
    ],
  },
  operations: {
    id: "operations",
    label: "Governance & Finance",
    badge: "Institutional Administration",
    title: "Multi-Campus Financial Operations, Inquiries, and Executive Reports",
    description:
      "Complete operational oversight for educational networks operating across multiple campuses, managing admissions pipelines, fee installments, and compliance registers.",
    features: [
      {
        title: "Multi-Campus Institutional Hierarchy",
        description:
          "Centralized configuration of multiple branch campuses, academic years, boards, standards, batches, and competitive target tracks.",
        specs: ["Centre-scoped isolation", "Multi-branch admin access", "Unified academic calendar"],
      },
      {
        title: "Fee Structures & Installment Ledgers",
        description:
          "Configurable fee packages, scholarship discounts, scheduled payment installments, partial collection recording, and automated PDF receipts.",
        specs: ["Defaulter tracking", "Scholarship audit logs", "Instant receipt generation"],
      },
      {
        title: "Dynamic Form Builder & Admissions CRM",
        description:
          "Build custom public admission and registration forms without code. Capture inquiries, assign admissions counselors, and track conversion stages.",
        specs: ["Custom drag-and-drop fields", "Public shareable URLs", "Counselor assignment"],
      },
      {
        title: "Executive Reports & Audit Logs",
        description:
          "Comprehensive registers covering financial collections vs expenses, attendance standing rosters, exam score distributions, and staff activity.",
        specs: ["Centre-wise financial ledgers", "Attendance standing registers", "Export to CSV/PDF"],
      },
    ],
  },
};

// ── Interactive Console Previews ─────────────────────────────────────
function ConsolePreview({ activeTab, activeRole }: { activeTab: PillarKey; activeRole: RoleLens }) {
  // Interactive student attendance clicker state
  const [students, setStudents] = useState([
    { id: "ADM-2026-012", name: "Ananya Sharma", roll: "12-A-01", status: "PRESENT", time: "08:28 AM" },
    { id: "ADM-2026-018", name: "Devansh Varma", roll: "12-A-02", status: "PRESENT", time: "08:31 AM" },
    { id: "ADM-2026-024", name: "Ishaan Nair", roll: "12-A-03", status: "LATE", time: "08:48 AM" },
    { id: "ADM-2026-031", name: "Kavya Menon", roll: "12-A-04", status: "EXCUSED", time: "Medical Leave" },
    { id: "ADM-2026-039", name: "Rohan Kulkarni", roll: "12-A-05", status: "ABSENT", time: "Unexcused" },
  ]);

  // Interactive MCQ assessment tester state
  const [selectedOption, setSelectedOption] = useState<string | null>("B");

  // Interactive fee simulator state
  const [feePlanMonths, setFeePlanMonths] = useState(3);
  const totalCourseFee = 75000;
  const scholarshipDiscount = 15000;
  const netPayable = totalCourseFee - scholarshipDiscount;
  const installmentAmount = Math.round(netPayable / feePlanMonths);

  const toggleStudentStatus = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextStatus = s.status === "PRESENT" ? "LATE" : s.status === "LATE" ? "ABSENT" : "PRESENT";
        return { ...s, status: nextStatus };
      })
    );
  };

  const presentCount = students.filter((s) => s.status === "PRESENT").length;
  const attendanceRate = ((presentCount / students.length) * 100).toFixed(1);

  if (activeTab === "academics") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attendance Register • Division A (Grade 12)
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Click status badges to test real-time recalculation:
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {attendanceRate}% Present ({presentCount}/{students.length})
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
          {students.map((student) => (
            <div key={student.id} className="py-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{student.id} • Roll {student.roll}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 hidden sm:inline">{student.time}</span>
                <button
                  type="button"
                  onClick={() => toggleStudentStatus(student.id)}
                  title="Click to cycle status"
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold tracking-wide transition-all cursor-pointer hover:scale-105 ${
                    student.status === "PRESENT"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700"
                      : student.status === "LATE"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
                      : student.status === "EXCUSED"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-300 dark:border-blue-700"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-300 dark:border-rose-700"
                  }`}
                >
                  {student.status} ↻
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Role view: <strong className="text-slate-700 dark:text-slate-300 font-mono">{activeRole}</strong></span>
          <span className="font-semibold text-brand-blue">Batch Session: Physics • 08:30 - 10:00 AM</span>
        </div>
      </div>
    );
  }

  if (activeTab === "assessments") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Interactive Assessment Palette • Organic Chemistry
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              NEET Mock Assessment #04 • 45 Questions
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80">
            <Clock className="h-3.5 w-3.5" />
            34m 12s Left
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Candidates</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">142</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">138 Active</p>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Marking Rule</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">+4 / -1</p>
            <p className="text-[10px] text-slate-500">Negative Penalty</p>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Score Impact</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {selectedOption === "B" ? "+4 Pts" : selectedOption === null ? "0 Pts" : "-1 Pt"}
            </p>
            <p className="text-[10px] text-slate-500">Live Auto-calc</p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Interactive Question Sample • Q.18</span>
            <span className="text-[10px] font-mono text-slate-400">Aldehydes & Ketones</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
            Which reagent selectively reduces cyclopentanone to cyclopentanol without affecting an ester group?
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            {[
              { key: "A", label: "A) LiAlH4 / Ether", correct: false },
              { key: "B", label: "B) NaBH4 / EtOH", correct: true },
              { key: "C", label: "C) H2 / Pd-C (Heat)", correct: false },
              { key: "D", label: "D) Zn-Hg / HCl (Clemmensen)", correct: false },
            ].map((opt) => {
              const isSelected = selectedOption === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedOption(opt.key)}
                  className={`p-2 rounded text-left transition-all cursor-pointer font-mono flex items-center justify-between ${
                    isSelected
                      ? opt.correct
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-400 text-emerald-800 dark:text-emerald-300 font-bold"
                        : "bg-rose-50 dark:bg-rose-950/50 border border-rose-400 text-rose-800 dark:text-rose-300 font-bold"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-blue"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && opt.correct && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "mentorship") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Supervised 1-on-1 Academic Thread
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Ticket #DBT-2026-441 • Physics: Electromagnetism
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Solution Verified
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-900 dark:text-white">Arjun Rao (Student • Batch A)</span>
              <span className="text-slate-400">10:14 AM</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              &ldquo;Sir, in Faraday&apos;s law problem #14, does Lenz&apos;s law opposing sign apply when computing instantaneous induced emf in a rotating loop?&rdquo;
            </p>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 font-mono">
              <FileText className="h-3 w-3 text-brand-blue" />
              problem_diagram_14.png (142 KB)
            </div>
          </div>

          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40 space-y-1.5 ml-3">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white">Dr. R. Venkat (Senior Faculty)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-semibold">
                  Verified Faculty
                </span>
              </div>
              <span className="text-slate-400">10:22 AM</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              &ldquo;Yes Arjun. The negative sign represents direction opposing the change in magnetic flux. Use ε = -dΦ/dt = ωNAB sin(ωt).&rdquo;
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Administrative supervisor audit active • Zero student-student backchannels
          </span>
          <span className="text-brand-blue font-semibold">Thread History (3)</span>
        </div>
      </div>
    );
  }

  // Operations / Fee preview with live installment calculator
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Fee Collection Ledger & Dues
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Academic Year 2026-27 • North Campus
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
          Ledger Balanced
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Invoiced</p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">₹42,80,000</p>
          <p className="text-[10px] text-slate-500">320 Enrollments</p>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Collections Cleared</p>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹36,15,000</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">84.4% Realized</p>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Pending Dues</p>
          <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">₹6,65,000</p>
          <p className="text-[10px] text-rose-500">Due 30-Oct</p>
        </div>
      </div>

      {/* Interactive Installment Simulator */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-brand-blue" />
            Installment Schedule Simulator
          </span>
          <span className="text-[10px] text-slate-500">Scholarship: ₹{scholarshipDiscount.toLocaleString()} applied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 shrink-0">Split into:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFeePlanMonths(n)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                feePlanMonths === n
                  ? "bg-brand-blue text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {n} {n === 1 ? "Payment" : "Installments"}
            </button>
          ))}
        </div>
        <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
          <span className="text-slate-500">Net Fee: ₹{netPayable.toLocaleString()}</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400">
            ₹{installmentAmount.toLocaleString()} / installment
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span>Defaulter notice batch scheduled for 25-Oct</span>
        <span className="font-semibold text-brand-blue">Download Financial Statement (CSV) →</span>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────
export default function FeaturesPage() {
  const [activePillar, setActivePillar] = useState<PillarKey>("academics");
  const [activeRole, setActiveRole] = useState<RoleLens>("SUPER_ADMIN");
  const [selectedHierarchyStep, setSelectedHierarchyStep] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPillar = PILLARS[activePillar];

  const HIERARCHY_STEPS = [
    {
      step: "01",
      tier: "Academic Year & Campus",
      badge: "Strict Scope",
      description: "Isolates student admissions, fee ledgers, and grade histories into distinct operational terms.",
      dbModel: "model Centre { id, name, code, addresses, batches, enrollments }",
      cascadeRule: "ON DELETE RESTRICT (Prevents orphaned campus records)",
    },
    {
      step: "02",
      tier: "Boards & Standards",
      badge: "Curriculum Binding",
      description: "Configures curriculum boards (CBSE, ICSE, State) and educational standards (Class 9 through 12).",
      dbModel: "model Standard { id, name, boardId, subjects, batches }",
      cascadeRule: "Board › Standard relational consistency",
    },
    {
      step: "03",
      tier: "Batches & Competitive Tracks",
      badge: "Cohort Scoping",
      description: "Partitions student divisions into specialized tracks (e.g. JEE Advanced, NEET, Foundation).",
      dbModel: "model Batch { id, name, standardId, centreId, trackId, enrollments }",
      cascadeRule: "Unique batch enrollments with active academic year check",
    },
    {
      step: "04",
      tier: "Subjects, Chapters & Topics",
      badge: "Granular Pacing",
      description: "Direct binding of lesson plans, MCQ banks, e-Study PDFs, and 1-on-1 doubt tickets.",
      dbModel: "model Topic { id, chapterId, subTopics, studyMaterials, doubtTickets }",
      cascadeRule: "Automated progress tracking on completed topic assessments",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 selection:bg-brand-blue selection:text-white antialiased relative">
      {/* ── Architectural Engineering Background Grid ──────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />

      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-brand-blue flex items-center justify-center shadow-sm group-hover:bg-brand-blue-dark transition-colors">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                  educare<span className="text-brand-blue ml-0.5">LMS</span>
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Enterprise Platform
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#overview" className="hover:text-brand-blue transition-colors">
              Platform Overview
            </a>
            <a href="#modules" className="hover:text-brand-blue transition-colors">
              Institutional Modules
            </a>
            <a href="#hierarchy" className="hover:text-brand-blue transition-colors">
              Academic Hierarchy
            </a>
            <a href="#architecture" className="hover:text-brand-blue transition-colors">
              Security & Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-blue hover:bg-brand-blue-dark text-white text-xs sm:text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
            >
              Institutional Console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-[#090D16] space-y-2">
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Platform Overview
            </a>
            <a
              href="#modules"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Institutional Modules
            </a>
            <a
              href="#hierarchy"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Academic Hierarchy
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Security & Architecture
            </a>
          </div>
        )}
      </header>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section id="overview" className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left: Authoritative Headline & Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                <ShieldCheck className="h-4 w-4 text-brand-blue" />
                Enterprise Learning & Operations System
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
                Architected for Institutional Rigor & Academic Delivery.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                Educare unifies multi-campus administration, automated examination grading, daily attendance registers, fee reconciliation, and verified 1-on-1 mentorship into a singular high-reliability platform.
              </p>

              <div className="grid sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-brand-blue transition-colors">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">4-Tier</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Role Scoping (RBAC)</p>
                  <p className="text-[11px] text-slate-400 mt-1">Super Admin, Centre, Faculty & Student</p>
                </div>
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-brand-blue transition-colors">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">7-Level</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Academic Hierarchy</p>
                  <p className="text-[11px] text-slate-400 mt-1">Campus › Board › Batch › Topic</p>
                </div>
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-brand-blue transition-colors">
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Relational Integrity</p>
                  <p className="text-[11px] text-slate-400 mt-1">PostgreSQL & Prisma ACID model</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold text-sm shadow-sm transition-all"
                >
                  Sign In to Tenant Console
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#modules"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Explore Core Modules
                </a>
              </div>
            </div>

            {/* Right: Live Interactive Console Preview Window */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-slate-300/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl overflow-hidden">
                {/* Console Window Header */}
                <div className="px-4 py-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400/80 inline-block" />
                    <span className="ml-2 text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                      console.educare.ac.in
                    </span>
                  </div>

                  {/* Interactive Persona / Role Switcher */}
                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded text-[10px] font-mono">
                    {(["SUPER_ADMIN", "TEACHER", "STUDENT"] as RoleLens[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setActiveRole(r)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          activeRole === r
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {r.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-navigation tabs */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 overflow-x-auto text-xs">
                  <div className="flex items-center gap-1">
                    {(["academics", "assessments", "mentorship", "operations"] as PillarKey[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActivePillar(tab)}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors shrink-0 cursor-pointer ${
                          activePillar === tab
                            ? "bg-white dark:bg-slate-800 text-brand-blue shadow-xs"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        {PILLARS[tab].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Window Content */}
                <div className="p-5">
                  <ConsolePreview activeTab={activePillar} activeRole={activeRole} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Institutional Pillars & Detailed Features ──────────────── */}
      <section id="modules" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Layers className="h-3.5 w-3.5 text-brand-blue" />
            Product Architecture & Capabilities
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Comprehensive Institutional Modules Built for Scale
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base max-w-2xl leading-relaxed">
            Every module in Educare is designed to eliminate manual administrative overhead while providing full transparency across branches, faculties, and enrolled cohorts.
          </p>
        </div>

        {/* Tab Controls for the 4 Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl mb-10 border border-slate-200/80 dark:border-slate-800">
          {(["academics", "assessments", "mentorship", "operations"] as PillarKey[]).map((key) => {
            const p = PILLARS[key];
            const isActive = activePillar === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActivePillar(key)}
                className={`py-3 px-4 rounded-lg text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700"
                    : "hover:bg-slate-200/60 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider ${isActive ? "text-brand-blue" : "text-slate-400"}`}>
                  {p.badge}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${isActive ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                  {p.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Pillar Deep Dive */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-xs">
          <div className="grid lg:grid-cols-12 gap-8 items-start mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
            <div className="lg:col-span-8 space-y-2">
              <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300">
                Pillar {activePillar.toUpperCase()}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {currentPillar.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                {currentPillar.description}
              </p>
            </div>
            <div className="lg:col-span-4 flex items-center justify-end">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Launch Module in Console
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {currentPillar.features.map((feat) => (
              <div
                key={feat.title}
                className="p-5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-blue shrink-0" />
                  {feat.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feat.description}
                </p>
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {feat.specs.map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Academic Hierarchy Explorer ────────────────── */}
      <section id="hierarchy" className="py-20 bg-slate-100/70 dark:bg-slate-950/40 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Building2 className="h-3.5 w-3.5" />
              Hierarchical Institutional Modeling
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              A Relational Architecture That Matches Real Educational Operations
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
              Select any tier below to inspect its schema representation and relational cascade guarantee:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {HIERARCHY_STEPS.map((node, index) => {
              const isSelected = selectedHierarchyStep === index;
              return (
                <button
                  key={node.step}
                  type="button"
                  onClick={() => setSelectedHierarchyStep(index)}
                  className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 border-brand-blue ring-2 ring-brand-blue/20 shadow-md"
                      : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-mono text-xs font-bold ${isSelected ? "text-brand-blue" : "text-slate-400"}`}>
                      {node.step}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {node.badge}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{node.tier}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {node.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Dynamic Hierarchy Step Deep-Dive Inspector */}
          <div className="p-5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 font-mono text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Database className="h-4 w-4" />
                <span>Tier {HIERARCHY_STEPS[selectedHierarchyStep].step} Schema Definition:</span>
                <span className="text-slate-400">{HIERARCHY_STEPS[selectedHierarchyStep].tier}</span>
              </div>
              <p className="text-slate-300 text-[11px] pt-0.5">
                {HIERARCHY_STEPS[selectedHierarchyStep].dbModel}
              </p>
              <p className="text-slate-400 text-[10px]">
                Rule: {HIERARCHY_STEPS[selectedHierarchyStep].cascadeRule}
              </p>
            </div>
            <Link
              href="/setup"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 shrink-0 transition-colors"
            >
              Configure Institutional Setup →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Technical Infrastructure & Security ─────────────────────── */}
      <section id="architecture" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Lock className="h-3.5 w-3.5" />
            Verified Enterprise Infrastructure
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Production-Grade Reliability & Security Controls
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            Engineered using standard modern technologies with strict session invalidation, parameterized query execution, presigned storage architecture, and zero mock dependencies.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: Server,
              title: "Next.js 16 & NestJS Architecture",
              specs: "TypeScript 5 • Turborepo",
              description:
                "Clean monorepo separation between the modern React 19 Next.js frontend and the robust, guard-protected NestJS backend API.",
            },
            {
              icon: Database,
              title: "PostgreSQL & Prisma Relational Core",
              specs: "PostgreSQL 14/16 • ACID",
              description:
                "Strict relational tables with complete migration history. Parameterized queries eliminate SQL injection vulnerabilities by design.",
            },
            {
              icon: Lock,
              title: "Redis Session Enforcement & RBAC",
              specs: "Single-session • Token Revocation",
              description:
                "JWT authentication backed by Redis token blacklisting. Password changes or session logouts invalidate active tokens across all devices.",
            },
            {
              icon: ShieldCheck,
              title: "Presigned Cloudflare R2 / S3 Storage",
              specs: "Direct Upload • Ownership Scoped",
              description:
                "Exam media and study materials upload directly via presigned URLs with strict ownership path validation, preventing server bandwidth choke points.",
            },
            {
              icon: Video,
              title: "LiveKit & WebRTC Video Classrooms",
              specs: "Low Latency • Encrypted Tokens",
              description:
                "Scalable real-time audio, video, and screen sharing with token-governed room access restricted to authorized batch enrollments.",
            },
            {
              icon: Bell,
              title: "Real-Time In-App Synchronization",
              specs: "Notification Drawer • 15s Polling",
              description:
                "Contextual alert feeds deep-linking directly into active doubt threads, pending homework grading, and administrative approvals.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-5 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-brand-blue">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">{item.title}</h4>
                <p className="text-[11px] font-mono text-slate-400">{item.specs}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Security Checklist Callout */}
        <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Institutional Compliance & Audit Rigor
              </p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Engineered to Protect Student Privacy and Financial Records
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shrink-0">
              Security Audit Verified
            </span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              "Single-session JWT with Redis revocation",
              "Owner-scoped S3 asset validation",
              "Zero student-to-student private chat",
              "Fee collection receipt audit trails",
              "Role-based guards on all 47 API endpoints",
              "Anti-cheat randomized exam question sets",
              "Daily attendance record immutability",
              "Multi-tenant campus boundary isolation",
            ].map((check) => (
              <div key={check} className="flex items-start gap-2 text-slate-300">
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{check}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Institutional Call to Action ───────────────────────────── */}
      <section className="py-20 bg-slate-100 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <GraduationCap className="h-4 w-4" />
            Ready for Institutional Deployment
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Streamline Your Institution on Educare LMS.
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Log into your institutional console to manage active student batches, schedule live assessments, and track fee collection in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-brand-blue hover:bg-brand-blue-dark text-white font-bold text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
            >
              Sign In to Management Console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admission"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm border border-slate-300 dark:border-slate-700 transition-colors"
            >
              Student Admission Intake
            </Link>
          </div>
        </div>
      </section>

      {/* ── Professional Footer ────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070B12] py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">
                Academic Core
              </p>
              <ul className="space-y-2">
                <li><Link href="/students" className="hover:text-brand-blue transition-colors">Student Management</Link></li>
                <li><Link href="/attendance" className="hover:text-brand-blue transition-colors">Daily Attendance</Link></li>
                <li><Link href="/assignments" className="hover:text-brand-blue transition-colors">Assignments & Grading</Link></li>
                <li><Link href="/doubts" className="hover:text-brand-blue transition-colors">Doubt Mentorship</Link></li>
                <li><Link href="/live-class" className="hover:text-brand-blue transition-colors">Live Classrooms</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">
                Evaluation & e-Study
              </p>
              <ul className="space-y-2">
                <li><Link href="/exam" className="hover:text-brand-blue transition-colors">Examination Engine</Link></li>
                <li><Link href="/estudy" className="hover:text-brand-blue transition-colors">Digital Material Library</Link></li>
                <li><Link href="/syllabus" className="hover:text-brand-blue transition-colors">Syllabus Pacing</Link></li>
                <li><Link href="/certificate" className="hover:text-brand-blue transition-colors">Certificates & ID Cards</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">
                Operations & CRM
              </p>
              <ul className="space-y-2">
                <li><Link href="/staff" className="hover:text-brand-blue transition-colors">Faculty & Staff Scoping</Link></li>
                <li><Link href="/enquiry" className="hover:text-brand-blue transition-colors">Inquiries & Leads</Link></li>
                <li><Link href="/forms" className="hover:text-brand-blue transition-colors">Dynamic Form Builder</Link></li>
                <li><Link href="/fee" className="hover:text-brand-blue transition-colors">Fee Structures & Dues</Link></li>
                <li><Link href="/expense" className="hover:text-brand-blue transition-colors">Financial Ledgers</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-200 mb-3 uppercase tracking-wider text-[11px]">
                Governance & System
              </p>
              <ul className="space-y-2">
                <li><Link href="/setup" className="hover:text-brand-blue transition-colors">Campus Hierarchy Setup</Link></li>
                <li><Link href="/report" className="hover:text-brand-blue transition-colors">Executive Analytics</Link></li>
                <li><Link href="/settings" className="hover:text-brand-blue transition-colors">System Configuration</Link></li>
                <li><Link href="/help" className="hover:text-brand-blue transition-colors">Support Help Desk</Link></li>
                <li><Link href="/login" className="hover:text-brand-blue transition-colors">Console Authentication</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-brand-blue flex items-center justify-center text-white">
                <GraduationCap className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">
                Educare Technologies LMS
              </span>
              <span className="text-slate-400">| Enterprise Academic Operating System</span>
            </div>
            <p className="text-slate-400">
              © {new Date().getFullYear()} Educare Technologies. All institutional rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
