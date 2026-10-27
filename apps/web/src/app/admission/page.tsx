"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { COUNTRY_CODES } from "@/lib/country-codes";
import logoImage from "@/logos/logo1-clean.png";
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  FileSignature,
  Upload,
  RotateCcw,
  BookOpen,
  Building2,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Sparkles,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileCheck2,
  Layers,
  Eye,
  ScrollText,
} from "lucide-react";

interface AdmissionRuleSubsection {
  id?: string;
  title: string;
  content?: string;
}

interface AdmissionRule {
  id: string;
  title: string;
  content: string;
  category: string;
  order: number;
  isRequiredAck: boolean;
  isActive: boolean;
  subsections?: AdmissionRuleSubsection[];
}

interface AcademicOptions {
  boards: Array<{ id: string; name: string }>;
  standards: Array<{ id: string; name: string; level: number; boardId?: string; boards?: Array<{ boardId: string }> }>;
  courses: Array<{ id: string; title: string; slug: string; level: string; price?: any }>;
  tracks: Array<{ id: string; name: string }>;
  centres: Array<{ id: string; name: string; code: string; address?: string; contactNo?: string; email?: string }>;
  turnstileSiteKey?: string | null;
  turnstileRequired?: boolean;
}

interface AdmissionPolicy {
  title: string;
  subtitle: string;
  description: string;
  declarationText: string;
  declarationBulletins?: string[];
  requireSignature: boolean;
  allowUploadSignature: boolean;
  requireParentSignature: boolean;
}

const DEFAULT_POLICY: AdmissionPolicy = {
  title: "Educare Academy Student Code & Admission Undertaking",
  subtitle: "Institutional Guidelines, Academic Code of Conduct & Guardian Declaration",
  description: "All students admitted to Educare Institute of Learning are expected to observe high standards of academic diligence, discipline, and mutual respect. Please read the terms below carefully before signing.",
  declarationText: "I hereby confirm that all information provided in this admission application is true, accurate, and complete. I have read, understood, and solemnly undertake to abide by the rules, code of conduct, attendance norms, and disciplinary regulations of Educare Institute.",
  declarationBulletins: [
    "I confirm that all details, contact information, and academic background submitted in this admission form are true, accurate, and authentic.",
    "I have carefully reviewed the Institutional Rules & Guidelines and solemnly undertake to abide by the academic code of conduct and disciplinary regulations.",
    "I understand that tuition and course fees must be remitted as per the agreed schedule and that registration charges are non-refundable once classes commence.",
    "I agree to maintain the required minimum 85% attendance, punctuality, and complete all scheduled evaluations and assignments.",
    "I understand that any willful breach of discipline, damage to property, or submission of fraudulent records may lead to disciplinary action or termination of enrollment.",
  ],
  requireSignature: true,
  allowUploadSignature: true,
  requireParentSignature: true,
};

const DEFAULT_RULES: AdmissionRule[] = [
  {
    id: "def-1",
    title: "Attendance & Punctuality Norms",
    category: "Attendance",
    content: "Students must maintain a minimum of 85% attendance across all scheduled theory, discussion, and practical laboratory sessions. In case of illness or emergency, a written leave letter signed by the parent/guardian must be submitted to the academic office within 48 hours.",
    order: 1,
    isRequiredAck: true,
    isActive: true,
    subsections: [
      { id: "s-1-1", title: "85% Lecture Quota", content: "Monthly attendance is calculated and submitted to the Academic Dean. Falling below 85% restricts test sitting rights." },
      { id: "s-1-2", title: "Emergency Medical Leave", content: "Medical leaves must be accompanied by an authorized physician certificate within 48 hours of return." },
      { id: "s-1-3", title: "Late Entry Protocol", content: "Students arriving 10 minutes past class start must secure a temporary gate pass." },
    ],
  },
  {
    id: "def-2",
    title: "Academic Integrity & Assessment Discipline",
    category: "Academics",
    content: "Academic dishonesty, including copying in examinations, unauthorized collaboration during test series, or plagiarism in assignments, is strictly prohibited. Violations will result in cancellation of test results and immediate parent-teacher consultation.",
    order: 2,
    isRequiredAck: true,
    isActive: true,
    subsections: [
      { id: "s-2-1", title: "Proctored Exam Rules", content: "Smart watches, mobile devices, and unauthorized notes are strictly banned in examination halls." },
      { id: "s-2-2", title: "Sunday Mock Tests", content: "Sitting for scheduled weekly mock examinations is mandatory for ranking and syllabus evaluation." },
      { id: "s-2-3", title: "Remedial Coaching", content: "Students with difficulties in baseline assessments will be scheduled for mentor reinforcement." },
    ],
  },
  {
    id: "def-3",
    title: "Campus Decorum, Dress Code & Mutual Respect",
    category: "Conduct",
    content: "Students must dress in modest, neat, and respectable attire appropriate for an academic environment. Respectful behavior towards teachers, peer students, and support staff is non-negotiable. Ragging, bullying, or disrespectful language will lead to immediate expulsion.",
    order: 3,
    isRequiredAck: true,
    isActive: true,
    subsections: [
      { id: "s-3-1", title: "Smart ID Card Display", content: "Educare ID cards must be worn visibly at all times within campus facilities." },
      { id: "s-3-2", title: "Zero Tolerance to Bullying", content: "Bullying, harassment, or verbal intimidation results in immediate suspension." },
      { id: "s-3-3", title: "Facility Care", content: "Willful damage to laboratory equipment, books, or smart displays will result in replacement charges." },
    ],
  },
  {
    id: "def-4",
    title: "Digital Device & Mobile Phone Policy",
    category: "Discipline",
    content: "Personal smartphones and electronic gadgets must be switched off or placed in silent mode during active lecture hours unless explicitly permitted by the instructor for interactive learning exercises.",
    order: 4,
    isRequiredAck: false,
    isActive: true,
    subsections: [
      { id: "s-4-1", title: "Device Storage", content: "Phones must remain silent and in backpacks during active instructional time." },
      { id: "s-4-2", title: "Interactive Quizzing", content: "Devices may only be used when an instructor specifically launches an LMS quiz or poll." },
    ],
  },
  {
    id: "def-5",
    title: "Fee Schedule, Batch Continuity & Refund Undertaking",
    category: "Finance",
    content: "Tuition and course fees must be remitted as per the agreed schedule. Admission and registration charges are non-refundable once classes commence. Batch or center change requests are subject to seat availability and administrative approval.",
    order: 5,
    isRequiredAck: true,
    isActive: true,
    subsections: [
      { id: "s-5-1", title: "Instalment Deadlines", content: "Tuition instalments must be remitted on or before the 10th of the designated term month." },
      { id: "s-5-2", title: "Non-Refundable Registration", content: "Registration and orientation materials fees are non-refundable once courses begin." },
      { id: "s-5-3", title: "Campus Reallocation", content: "Transfers between institutional campuses are accommodated subject to batch quota vacancy." },
    ],
  },
];

const CATEGORY_TAG_COLORS: Record<string, string> = {
  Attendance: "bg-blue-50 text-blue-700 border-blue-200",
  Academics: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Conduct: "bg-amber-50 text-amber-700 border-amber-200",
  Discipline: "bg-purple-50 text-purple-700 border-purple-200",
  Finance: "bg-rose-50 text-rose-700 border-rose-200",
  General: "bg-slate-50 text-slate-700 border-slate-200",
};

export default function AdmissionPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [policy, setPolicy] = useState<AdmissionPolicy>(DEFAULT_POLICY);
  const [rules, setRules] = useState<AdmissionRule[]>(DEFAULT_RULES);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Live Academic Database Options
  const [academicOptions, setAcademicOptions] = useState<AcademicOptions>({
    boards: [],
    standards: [],
    courses: [],
    tracks: [],
    centres: [],
  });

  // Form State
  const [formData, setFormData] = useState({
    studentName: "",
    parentName: "",
    countryCode: "+91",
    contactNumber: "",
    email: "",
    city: "",
    address: "",
    centreId: "",
    preferredCampus: "Main Campus",
    targetBoard: "CBSE",
    targetStandard: "Class 11",
    targetCourse: "Entrance (NEET/JEE)",
    signerRole: "PARENT", // "PARENT" | "STUDENT"
    signerName: "",
    termsAccepted: false,
  });

  // Rule verification tracking: ruleId -> boolean
  const [verifiedRules, setVerifiedRules] = useState<Record<string, boolean>>({});
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});

  // Signature State
  const [signatureMode, setSignatureMode] = useState<"DRAW" | "UPLOAD">("DRAW");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isCanvasDrawn, setIsCanvasDrawn] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Canvas drawing references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [applicationRef, setApplicationRef] = useState<string>("");
  const [submissionDate, setSubmissionDate] = useState<string>("");
  // Form Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepError, setStepError] = useState<string | null>(null);

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setStepError(null);
  };

  // Load rules & policy & live academic options from backend
  useEffect(() => {
    async function loadAdmissionData() {
      try {
        const [rulesRes, optionsRes] = (await Promise.all([
          fetchApi("/setup/public/admission-rules"),
          fetchApi("/setup/public/admission-options"),
        ])) as any;

        if (rulesRes?.policy) setPolicy(rulesRes.policy);
        if (Array.isArray(rulesRes?.rules) && rulesRes.rules.length > 0) {
          setRules(rulesRes.rules);
          if (rulesRes.rules[0]?.id) {
            setExpandedRuleIds({ [rulesRes.rules[0].id]: true });
          }
        }

        if (optionsRes) {
          setAcademicOptions(optionsRes);
          // Set live defaults from real database records if available
          setFormData((prev) => {
            const firstCentre = optionsRes.centres?.[0];
            const firstBoard = optionsRes.boards?.[0];
            const matchingStandards = optionsRes.standards?.filter(
              (s: any) =>
                !firstBoard?.id ||
                !s.boardId ||
                s.boardId === firstBoard.id ||
                s.boards?.some((b: any) => b.boardId === firstBoard.id)
            );
            const firstStandard = matchingStandards?.[0] || optionsRes.standards?.[0];
            const firstTrackOrCourse =
              optionsRes.tracks?.[0]?.name || optionsRes.courses?.[0]?.title || prev.targetCourse;

            return {
              ...prev,
              centreId: prev.centreId || firstCentre?.id || "",
              preferredCampus: prev.preferredCampus || firstCentre?.name || "Main Campus",
              targetBoard: prev.targetBoard || firstBoard?.name || "CBSE",
              targetStandard: prev.targetStandard || firstStandard?.name || "Class 11",
              targetCourse: prev.targetCourse || firstTrackOrCourse,
            };
          });
        }
      } catch (err) {
        console.warn("[Admission] Using default template fallback:", err);
      } finally {
        setLoadingRules(false);
        setLoadingOptions(false);
      }
    }
    loadAdmissionData();
  }, []);

  // Initialize Canvas for Drawing
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = "#071d3d"; // Deep navy ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    if (currentStep === 4 && signatureMode === "DRAW") {
      setTimeout(setupCanvas, 100);
    }
  }, [currentStep, signatureMode]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    lastPos.current = getCanvasPos(e);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const currentPos = getCanvasPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    lastPos.current = currentPos;
    setIsCanvasDrawn(true);
    setSignatureData(canvas.toDataURL("image/png"));
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && isDrawing.current) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      setSignatureData(canvas.toDataURL("image/png"));
      clearFieldError("signature");
    }
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsCanvasDrawn(false);
    setSignatureData(null);
  };

  // Handle Signature Image Upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStepError("Please upload a valid image file (PNG, JPG, JPEG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStepError("File size exceeds 5MB limit. Please choose a smaller signature image.");
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSignatureData(dataUrl);
      clearFieldError("signature");
    };
    reader.readAsDataURL(file);
  };

  const selectedBoardObj = academicOptions.boards.find(
    (b) => b.name.toLowerCase() === formData.targetBoard.toLowerCase() || b.id === formData.targetBoard
  );

  const availableStandards = academicOptions.standards.length > 0
    ? academicOptions.standards.filter((s) => {
        if (!selectedBoardObj) return true;
        if (!s.boardId && (!s.boards || s.boards.length === 0)) return true;
        if (s.boardId === selectedBoardObj.id) return true;
        if (s.boards && s.boards.some((b: any) => b.boardId === selectedBoardObj.id)) return true;
        return false;
      })
    : [];

  const toggleRuleVerified = (ruleId: string) => {
    setVerifiedRules((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }));
  };

  const handleVerifyAllRules = () => {
    const allVerified: Record<string, boolean> = {};
    rules.forEach((r) => {
      allVerified[r.id] = true;
    });
    setVerifiedRules(allVerified);
  };

  const toggleRuleExpand = (ruleId: string) => {
    setExpandedRuleIds((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }));
  };

  const mandatoryRules = rules.filter((r) => r.isRequiredAck);
  const verifiedCount = rules.filter((r) => verifiedRules[r.id]).length;
  const verifiedPercent = rules.length > 0 ? Math.round((verifiedCount / rules.length) * 100) : 0;
  const allMandatoryVerified = mandatoryRules.every((r) => verifiedRules[r.id]);

  const handleBoardChange = (newBoardName: string) => {
    const boardObj = academicOptions.boards.find(
      (b) => b.name.toLowerCase() === newBoardName.toLowerCase() || b.id === newBoardName
    );
    const matchingStandards = academicOptions.standards.filter((s) => {
      if (!boardObj) return true;
      if (!s.boardId && (!s.boards || s.boards.length === 0)) return true;
      if (s.boardId === boardObj.id) return true;
      if (s.boards && s.boards.some((b: any) => b.boardId === boardObj.id)) return true;
      return false;
    });

    const currentStandardValid = matchingStandards.some(
      (s) => s.name.toLowerCase() === formData.targetStandard.toLowerCase()
    );

    setFormData((prev) => ({
      ...prev,
      targetBoard: newBoardName,
      targetStandard: currentStandardValid ? prev.targetStandard : matchingStandards[0]?.name || prev.targetStandard,
    }));
  };

  // Step Validation
  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    const name = formData.studentName.trim();
    if (!name) {
      newErrors.studentName = "Student full name is required.";
    } else if (name.length < 2) {
      newErrors.studentName = "Student name must be at least 2 characters.";
    } else if (name.length > 100) {
      newErrors.studentName = "Student name cannot exceed 100 characters.";
    } else if (!/^[a-zA-Z\s.'-]+$/.test(name)) {
      newErrors.studentName = "Please enter a valid legal name using letters only.";
    }

    const parent = formData.parentName.trim();
    if (!parent) {
      newErrors.parentName = "Parent / guardian full name is required.";
    } else if (parent.length < 2) {
      newErrors.parentName = "Parent / guardian name must be at least 2 characters.";
    } else if (parent.length > 100) {
      newErrors.parentName = "Parent name cannot exceed 100 characters.";
    } else if (!/^[a-zA-Z\s.'-]+$/.test(parent)) {
      newErrors.parentName = "Please enter a valid legal name using letters only.";
    }

    const cleanDigits = formData.contactNumber.replace(/[\s\-\(\)\+]/g, "").replace(/^0+/, "");
    if (!cleanDigits) {
      newErrors.contactNumber = "Mobile contact number is required.";
    } else if (formData.countryCode === "+91") {
      const nationalPhone = cleanDigits.startsWith("91") && cleanDigits.length === 12 ? cleanDigits.slice(2) : cleanDigits;
      if (!/^[6-9]\d{9}$/.test(nationalPhone)) {
        newErrors.contactNumber = "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).";
      }
    } else {
      if (cleanDigits.length < 6 || cleanDigits.length > 15 || !/^\d+$/.test(cleanDigits)) {
        newErrors.contactNumber = "Please enter a valid mobile number for the selected country (6–15 digits).";
      }
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = "Please enter a valid email address (e.g. name@domain.com).";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setStepError("Please fill in all mandatory fields with valid information to continue.");
      return false;
    }

    setStepError(null);
    return true;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.centreId && !formData.preferredCampus) {
      newErrors.preferredCampus = "Please select your preferred study campus or centre.";
    }

    if (!formData.targetBoard) {
      newErrors.targetBoard = "Please select a target curriculum board.";
    }

    if (!formData.targetStandard) {
      newErrors.targetStandard = "Please select your class / grade.";
    }

    if (!formData.targetCourse) {
      newErrors.targetCourse = "Please select your target course stream.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setStepError("Please select all required academic options before continuing.");
      return false;
    }

    setStepError(null);
    return true;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    if (!allMandatoryVerified) {
      setStepError("Please click 'Click to Verify' on all mandatory regulations above before proceeding to the digital signature step.");
      return false;
    }
    setStepError(null);
    return true;
  };

  // Step 4 Validation
  const validateStep4 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (policy.requireSignature && !signatureData) {
      newErrors.signature = "A digital signature or uploaded signature image is required.";
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the solemn undertaking covenants to submit.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setStepError("Please provide your signature and accept the undertaking to submit your application.");
      return false;
    }

    setStepError(null);
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    if (currentStep < 4) {
      setStepError(null);
      setErrors({});
      setCurrentStep((prev) => (prev + 1) as any);
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setStepError(null);
      setErrors({});
      setCurrentStep((prev) => (prev - 1) as any);
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  // Submit Application
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) {
      return;
    }

    setSubmitting(true);
    setStepError(null);
    try {
      const signer = formData.signerName.trim() || (formData.signerRole === "PARENT" ? formData.parentName : formData.studentName);
      const cleanDigits = formData.contactNumber.replace(/[\s\-\(\)\+]/g, "").replace(/^0+/, "");
      const rawDialCode = formData.countryCode.replace("+", "");
      const nationalNumber = cleanDigits.startsWith(rawDialCode) ? cleanDigits.slice(rawDialCode.length) : cleanDigits;
      const fullPhoneNumber = `${formData.countryCode}${nationalNumber}`;

      const payload = {
        studentName: formData.studentName.trim(),
        parentName: formData.parentName.trim(),
        contactNumber: fullPhoneNumber,
        email: formData.email.trim() || undefined,
        address: [formData.city.trim(), formData.address.trim()].filter(Boolean).join(", "),
        source: `Online Admission Portal (${formData.preferredCampus})`,
        centreId: formData.centreId || undefined,
        targetBoard: formData.targetBoard,
        targetStandard: formData.targetStandard,
        targetCourse: formData.targetCourse,
        signatureData: signatureData,
        signatureType: signatureMode === "DRAW" ? "DRAWN_CANVAS" : "UPLOADED_IMAGE",
        signerName: signer,
        termsAccepted: true,
      };

      const result = (await fetchApi("/enquiry/public", {
        method: "POST",
        body: JSON.stringify(payload),
      })) as any;

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedRef = `EDC-ADM-${new Date().getFullYear()}-${result?.id ? result.id.slice(0, 4).toUpperCase() : randomSuffix}`;
      setApplicationRef(generatedRef);
      setSubmissionDate(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }));
      setSubmissionSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setStepError(err.message || "Failed to submit admission application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRules =
    selectedCategory === "ALL"
      ? rules
      : rules.filter((r) => (r.category || "General").toLowerCase() === selectedCategory.toLowerCase());

  const categories = Array.from(new Set(rules.map((r) => r.category || "General")));

  // ---------------------------------------------------------------------------
  // SUCCESS VIEW
  // ---------------------------------------------------------------------------
  if (submissionSuccess) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-between font-sans selection:bg-[#0162b1]/15">
        {/* Navigation Bar */}
        <header className="border-b border-border-soft bg-white/90 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-auto flex items-center">
                <Image src={logoImage} alt="Educare Logo" width={140} height={40} className="h-9 w-auto object-contain" priority />
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Admission Logged
              </span>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-primary bg-surface hover:bg-surface-2 transition-colors border border-border-soft"
              >
                LMS Portal Login
              </Link>
            </div>
          </div>
        </header>

        {/* Success Card */}
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col justify-center">
          <div className="bg-white rounded-3xl border border-border-soft shadow-xl p-8 sm:p-12 text-center relative overflow-hidden">
            {/* Ambient Brand Accents */}
            <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[#0162b1]/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-[#ee1b24]/10 blur-3xl pointer-events-none" />

            {/* Success Icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#0162b1] to-[#1a7fd4] text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-blue/30 mb-6">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-3 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Digitally Signed & Authenticated
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              Admission Application Submitted!
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-lg mx-auto leading-relaxed">
              Thank you, <strong className="text-text-primary">{formData.studentName}</strong>. Your application and signed code of conduct undertaking have been recorded in the Educare admissions registry.
            </p>

            {/* Reference Slip Card */}
            <div className="my-8 p-6 rounded-2xl bg-[#FAFAF8] border border-border-soft text-left space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border-soft gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Application Reference No.</span>
                  <p className="text-lg font-mono font-black text-brand-blue">{applicationRef}</p>
                </div>
                <div className="sm:text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Logged Timestamp</span>
                  <p className="text-xs font-semibold text-text-secondary">{submissionDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-text-muted block">Student</span>
                  <strong className="text-xs font-bold text-text-primary block truncate">{formData.studentName}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Parent / Guardian</span>
                  <strong className="text-xs font-bold text-text-primary block truncate">{formData.parentName}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Campus</span>
                  <strong className="text-xs font-bold text-text-primary block truncate">{formData.preferredCampus}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Program</span>
                  <strong className="text-xs font-bold text-text-primary block truncate">{formData.targetCourse} ({formData.targetStandard})</strong>
                </div>
              </div>

              {/* Verified Signature Stamp */}
              {signatureData && (
                <div className="pt-4 border-t border-border-soft flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-text-muted block uppercase tracking-wider">Executed Undertaking</span>
                    <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5 mt-0.5">
                      <Check className="w-3.5 h-3.5" /> Code of Conduct & Rules Agreed
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-border-soft shadow-inner max-w-[140px] max-h-16 flex items-center justify-center">
                    <img src={signatureData} alt="Applicant Signature" className="max-h-12 w-auto object-contain" />
                  </div>
                </div>
              )}
            </div>

            {/* Next Steps Roadmap */}
            <div className="text-left mb-8 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">What Happens Next?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-border-soft">
                  <div className="w-6 h-6 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold mb-2">1</div>
                  <h4 className="text-xs font-bold text-text-primary">Counselor Consultation</h4>
                  <p className="text-[11px] text-text-muted mt-1">An academic dean will call you within 24 hours to schedule batch allocation.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-border-soft">
                  <div className="w-6 h-6 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold mb-2">2</div>
                  <h4 className="text-xs font-bold text-text-primary">Campus Visit & Verification</h4>
                  <p className="text-[11px] text-text-muted mt-1">Visit your chosen campus for document verification and study material kit collection.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-border-soft">
                  <div className="w-6 h-6 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-bold mb-2">3</div>
                  <h4 className="text-xs font-bold text-text-primary">LMS Portal Access</h4>
                  <p className="text-[11px] text-text-muted mt-1">Receive student credentials for online video classes, tests, and attendance tracking.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold text-text-primary bg-white border border-border-soft hover:bg-surface transition-colors shadow-sm inline-flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-text-secondary" /> Print Application Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmissionSuccess(false);
                  setCurrentStep(1);
                  setSignatureData(null);
                  setIsCanvasDrawn(false);
                  setUploadedFileName(null);
                  setErrors({});
                  setStepError(null);
                  setFormData({
                    studentName: "",
                    parentName: "",
                    countryCode: "+91",
                    contactNumber: "",
                    email: "",
                    city: "",
                    address: "",
                    centreId: "",
                    preferredCampus: "Main Campus",
                    targetBoard: "CBSE",
                    targetStandard: "Class 11",
                    targetCourse: "Entrance (NEET/JEE)",
                    signerRole: "PARENT",
                    signerName: "",
                    termsAccepted: false,
                  });
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark transition-colors shadow-md shadow-brand-blue/20"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border-soft bg-white py-6 text-center text-xs text-text-muted">
          <p>© {new Date().getFullYear()} Educare Institute of Learning. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN APPLICATION FORM
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-text-primary font-sans selection:bg-[#0162b1]/15">
      {/* Top Banner Navigation */}
      <header className="border-b border-border-soft bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-auto flex items-center">
              <Image src={logoImage} alt="Educare Group" width={150} height={42} className="h-9 w-auto object-contain" priority />
            </div>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex items-center gap-6 text-xs text-text-secondary font-medium">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand-blue" />
                <a href="tel:+919746033703" className="hover:text-brand-blue transition-colors">+91 97460 33703</a>
                <span>/</span>
                <a href="tel:+918089372819" className="hover:text-brand-blue transition-colors">+91 80893 72819</a>
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-brand-blue" />
                admissions@educarelearning.in
              </span>
            </div>

            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-text-primary bg-surface hover:bg-surface-2 transition-colors border border-border-soft inline-flex items-center gap-1.5"
            >
              Sign In <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#040e1d] to-[#0a2246] text-white py-14 sm:py-20 px-4">
        {/* Ambient Blurred Orbs matching LMS Theme */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0162b1]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#ee1b24]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Admissions Open for Academic Session 2026–2027</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Educare{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Course Registration
            </span>
          </h1>

          {/* Courses & Centres Highlight */}
          <div className="pt-1 max-w-3xl mx-auto space-y-2">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-medium text-slate-100 shadow-sm">
              <span className="text-sky-300 font-semibold">Courses :</span>
              <span>Entrance Coaching</span>
              <span className="text-slate-400">|</span>
              <span>Academic Tuition</span>
              <span className="text-slate-400">|</span>
              <span>Ai &amp; Cybersecurity</span>
            </div>

            <div className="space-y-1 text-xs sm:text-sm text-slate-200">
              <p className="font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Offline &amp; Online Coaching
              </p>
              <p className="text-slate-300 text-xs sm:text-sm">
                <span className="text-slate-400 font-semibold">Offline centres :</span>{" "}
                <span className="text-white font-medium">Gurukrupa Complex, Mannanam</span>{" "}
                <span className="text-slate-400">|</span>{" "}
                <span className="text-white font-medium">Castle Charis Complex Kalathipady</span>
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Apply online for regular tuition, integrated foundation, or NEET/JEE entrance coaching. Review our academic guidelines and submit your digital declaration in under 5 minutes.
          </p>

          {/* Trust Metrics */}
          <div className="pt-4 flex items-center justify-center gap-4 sm:gap-8 text-xs text-slate-300 flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Authorized Institutional Portal
            </span>
          </div>
        </div>
      </section>

      {/* Main Form Container */}
      <section className="max-w-4xl mx-auto px-4 -mt-8 pb-20 relative z-20">
        <div className="bg-white rounded-3xl border border-border-soft shadow-xl overflow-hidden">
          {/* Step Progress Tracker */}
          <div className="bg-surface border-b border-border-soft px-4 sm:px-8 py-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {[
                { step: 1, label: "Applicant Profile", icon: GraduationCap },
                { step: 2, label: "Program & Campus", icon: Building2 },
                { step: 3, label: "Rules & Guidelines", icon: BookOpen },
                { step: 4, label: "Digital Signature", icon: FileSignature },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = currentStep === item.step;
                const isCompleted = currentStep > item.step;

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step < currentStep) setCurrentStep(item.step as any);
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                      isActive
                        ? "bg-white shadow-sm border border-border-soft"
                        : isCompleted
                        ? "text-emerald-700 hover:bg-white/60"
                        : "text-text-muted opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isActive
                          ? "bg-brand-blue text-white shadow-sm"
                          : isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                        Step {item.step}
                      </span>
                      <span className={`text-xs font-bold block truncate ${isActive ? "text-text-primary" : "text-text-secondary"}`}>
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content Body */}
          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-10 space-y-8">
            {stepError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-rose-900">Please review the required information</h4>
                  <p className="mt-0.5 leading-relaxed text-rose-700">{stepError}</p>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 1: APPLICANT & PARENT PROFILE                               */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-text-primary tracking-tight">Applicant & Parent Information</h2>
                  <p className="text-xs text-text-muted mt-1">Please provide accurate contact details for official admission records</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Student Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.studentName}
                      onChange={(e) => {
                        setFormData({ ...formData, studentName: e.target.value });
                        clearFieldError("studentName");
                      }}
                      placeholder="e.g. Alen Jacob Thomas"
                      className={`w-full h-12 rounded-xl border bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:ring-2 transition-all ${
                        errors.studentName
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    />
                    {errors.studentName && (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.studentName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Parent / Guardian Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.parentName}
                      onChange={(e) => {
                        setFormData({ ...formData, parentName: e.target.value });
                        clearFieldError("parentName");
                      }}
                      placeholder="e.g. Thomas K. Jacob"
                      className={`w-full h-12 rounded-xl border bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:ring-2 transition-all ${
                        errors.parentName
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    />
                    {errors.parentName && (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.parentName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Contact / WhatsApp Mobile <span className="text-rose-500">*</span>
                    </label>
                    <div
                      className={`flex items-center w-full h-12 rounded-xl border bg-surface transition-all focus-within:bg-white focus-within:ring-2 ${
                        errors.contactNumber
                          ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus-within:ring-brand-blue/20"
                      }`}
                    >
                      {/* Country Code Dropdown */}
                      <div className="relative flex items-center shrink-0 border-r border-border-soft/80 h-full max-w-[140px] sm:max-w-[150px]">
                        <select
                          value={formData.countryCode}
                          onChange={(e) => {
                            setFormData({ ...formData, countryCode: e.target.value });
                            clearFieldError("contactNumber");
                          }}
                          className="h-full pl-3 pr-6 bg-transparent text-xs font-bold font-mono text-text-primary rounded-l-xl appearance-none cursor-pointer focus:outline-none hover:bg-slate-50 transition-colors truncate"
                          title="Select Country Dialing Code"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-xs font-sans text-slate-800">
                              {c.flag} {c.name} ({c.dialCode})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-text-muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Phone Number Input */}
                      <input
                        type="tel"
                        maxLength={16}
                        value={formData.contactNumber}
                        onChange={(e) => {
                          setFormData({ ...formData, contactNumber: e.target.value });
                          clearFieldError("contactNumber");
                        }}
                        placeholder={formData.countryCode === "+91" ? "9876543210" : "Mobile number"}
                        className="flex-1 h-full px-3 text-sm font-mono text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none"
                      />
                    </div>
                    {errors.contactNumber ? (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.contactNumber}
                      </p>
                    ) : (
                      <span className="text-[11px] text-text-muted mt-1 block">Course timetable & notifications will be communicated to this number.</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        clearFieldError("email");
                      }}
                      placeholder="student@example.com"
                      className={`w-full h-12 rounded-xl border bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:ring-2 transition-all ${
                        errors.email
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    />
                    {errors.email ? (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.email}
                      </p>
                    ) : (
                      <span className="text-[11px] text-text-muted mt-1 block">Optional: for digital receipts and student portal links.</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">City / Town of Residence</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Kottayam, Pala, Changanassery"
                      className="w-full h-12 rounded-xl border border-border-soft bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:ring-2 focus:ring-brand-blue/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">Residential Address (Optional)</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="House / Street address"
                      className="w-full h-12 rounded-xl border border-border-soft bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:ring-2 focus:ring-brand-blue/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 2: ACADEMIC PROGRAM & CAMPUS                                */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-text-primary tracking-tight">Academic Preferences & Campus Allocation</h2>
                  <p className="text-xs text-text-muted mt-1">Select your preferred branch, curriculum board, and target program stream</p>
                </div>

                {/* Campus Choice Cards */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-2">Preferred Study Campus / Centre</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {academicOptions.centres.length > 0 ? (
                      academicOptions.centres.map((centre) => {
                        const isSelected = formData.centreId === centre.id || formData.preferredCampus === centre.name;
                        return (
                          <div
                            key={centre.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                centreId: centre.id,
                                preferredCampus: centre.name,
                              });
                              clearFieldError("preferredCampus");
                            }}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                              isSelected
                                ? "border-brand-blue bg-brand-blue/5 shadow-sm"
                                : errors.preferredCampus
                                ? "border-rose-300 bg-rose-50/20 hover:border-rose-400"
                                : "border-border-soft bg-white hover:border-brand-blue/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue font-mono">
                                {centre.code || "CAMPUS"}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? "border-brand-blue bg-brand-blue" : "border-border-soft"
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-text-primary">{centre.name}</h4>
                            <p className="text-[11px] text-text-muted mt-1 leading-snug line-clamp-2">
                              {centre.address || centre.contactNo || "Classroom / Offline Centre"}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      [
                        {
                          name: "Gurukrupa Complex, Mannanam",
                          desc: "Offline Centre / Classroom Coaching",
                          type: "Offline Centre",
                        },
                        {
                          name: "Castle Charis Complex Kalathipady",
                          desc: "Offline Centre / Classroom Coaching",
                          type: "Offline Centre",
                        },
                        {
                          name: "Offline & Online Coaching",
                          desc: "Interactive Live-Class + LMS Portal",
                          type: "Hybrid / Online",
                        },
                      ].map((campus) => {
                        const isSelected = formData.preferredCampus === campus.name;
                        return (
                          <div
                            key={campus.name}
                            onClick={() => {
                              setFormData({ ...formData, preferredCampus: campus.name });
                              clearFieldError("preferredCampus");
                            }}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all text-left ${
                              isSelected
                                ? "border-brand-blue bg-brand-blue/5 shadow-sm"
                                : errors.preferredCampus
                                ? "border-rose-300 bg-rose-50/20 hover:border-rose-400"
                                : "border-border-soft bg-white hover:border-brand-blue/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">{campus.type}</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-brand-blue bg-brand-blue" : "border-border-soft"}`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-text-primary">{campus.name}</h4>
                            <p className="text-[11px] text-text-muted mt-1 leading-snug">{campus.desc}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {errors.preferredCampus && (
                    <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.preferredCampus}
                    </p>
                  )}
                </div>

                {/* Program Details from Live DB */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Target Curriculum Board <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.targetBoard}
                      onChange={(e) => {
                        handleBoardChange(e.target.value);
                        clearFieldError("targetBoard");
                      }}
                      className={`w-full h-12 rounded-xl border bg-surface px-3 text-sm text-text-primary focus:bg-white focus:ring-2 transition-all ${
                        errors.targetBoard
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    >
                      {academicOptions.boards.length > 0 ? (
                        academicOptions.boards.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name} Board
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CBSE">CBSE Board</option>
                          <option value="ICSE">ICSE / ISC Board</option>
                          <option value="State Board">Kerala State Board</option>
                          <option value="Other">Other Board</option>
                        </>
                      )}
                    </select>
                    {errors.targetBoard && (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.targetBoard}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Class / Standard <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.targetStandard}
                      onChange={(e) => {
                        setFormData({ ...formData, targetStandard: e.target.value });
                        clearFieldError("targetStandard");
                      }}
                      className={`w-full h-12 rounded-xl border bg-surface px-3 text-sm text-text-primary focus:bg-white focus:ring-2 transition-all ${
                        errors.targetStandard
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    >
                      {availableStandards.length > 0 ? (
                        availableStandards.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Class 8">Class 8 (Pre-Foundation)</option>
                          <option value="Class 9">Class 9 (Foundation)</option>
                          <option value="Class 10">Class 10 (Board Focus)</option>
                          <option value="Class 11">Class 11 (+1 Integrated)</option>
                          <option value="Class 12">Class 12 (+2 Intensive)</option>
                          <option value="Dropper / Repeat">Dropper / Repeat Batch</option>
                        </>
                      )}
                    </select>
                    {errors.targetStandard && (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.targetStandard}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">
                      Course / Programme Stream <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.targetCourse}
                      onChange={(e) => {
                        setFormData({ ...formData, targetCourse: e.target.value });
                        clearFieldError("targetCourse");
                      }}
                      className={`w-full h-12 rounded-xl border bg-surface px-3 text-sm text-text-primary focus:bg-white focus:ring-2 transition-all ${
                        errors.targetCourse
                          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                          : "border-border-soft focus:ring-brand-blue/20"
                      }`}
                    >
                      {academicOptions.tracks.length > 0 || academicOptions.courses.length > 0 ? (
                        <>
                          {academicOptions.tracks.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name} Stream
                            </option>
                          ))}
                          {academicOptions.courses.map((c) => (
                            <option key={c.id} value={c.title}>
                              {c.title}
                            </option>
                          ))}
                        </>
                      ) : (
                        <>
                          <option value="Entrance Coaching">Entrance Coaching (NEET / JEE / KEAM)</option>
                          <option value="Academic Tuition">Academic Tuition</option>
                          <option value="Ai & Cybersecurity">Ai &amp; Cybersecurity</option>
                          <option value="Integrated Foundation">Integrated School Foundation</option>
                          <option value="Crash Course">Crash Course &amp; Test Series</option>
                        </>
                      )}
                    </select>
                    {errors.targetCourse && (
                      <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.targetCourse}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 3: DYNAMIC RULES & REGULATIONS (WITH SUBSECTIONS & VERIFY)  */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary tracking-tight">Institutional Rules & Code of Conduct</h2>
                    <p className="text-xs text-text-muted mt-1">
                      Managed by Educare Academic Administration. Review each guideline and click to verify comprehension.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("ALL")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedCategory === "ALL"
                          ? "bg-text-primary text-white shadow-sm"
                          : "bg-surface text-text-secondary hover:bg-surface-2"
                      }`}
                    >
                      All ({rules.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedCategory === cat
                            ? "bg-brand-blue text-white shadow-sm"
                            : "bg-surface text-text-secondary hover:bg-surface-2"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verification Progress Strip */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-blue/10 via-[#071d3d]/5 to-transparent border border-brand-blue/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between max-w-sm text-xs font-bold text-text-primary">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-brand-blue" />
                        Verification Status: {verifiedCount} of {rules.length} Read
                      </span>
                      <span className={allMandatoryVerified ? "text-emerald-600" : "text-brand-blue"}>
                        {verifiedPercent}%
                      </span>
                    </div>
                    <div className="w-full max-w-sm h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          allMandatoryVerified ? "bg-emerald-500" : "bg-brand-blue"
                        }`}
                        style={{ width: `${verifiedPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleVerifyAllRules}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-brand-blue bg-white border border-brand-blue/30 hover:bg-brand-blue/5 transition-colors shadow-sm inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verify All Rules as Read
                    </button>
                  </div>
                </div>

                {/* Rules List Container */}
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                  {loadingRules ? (
                    <div className="p-12 text-center text-text-muted text-sm">Loading institutional rules...</div>
                  ) : filteredRules.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-sm bg-surface rounded-2xl">
                      No specific rules found in this category.
                    </div>
                  ) : (
                    filteredRules.map((rule, idx) => {
                      const tagStyle = CATEGORY_TAG_COLORS[rule.category] || CATEGORY_TAG_COLORS.General;
                      const isVerified = Boolean(verifiedRules[rule.id]);
                      const hasSubsections = Boolean(rule.subsections && rule.subsections.length > 0);

                      return (
                        <div
                          key={rule.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-sm ${
                            isVerified
                              ? "border-emerald-500/50 bg-emerald-50/10 shadow-emerald-500/5"
                              : "border-border-soft bg-white hover:border-brand-blue/30"
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 border ${
                                isVerified
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-surface border-border-soft text-text-secondary"
                              }`}
                            >
                              {isVerified ? <Check className="w-4 h-4 text-emerald-700" /> : rule.order || idx + 1}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${tagStyle}`}>
                                    {rule.category || "General"}
                                  </span>
                                  <h4 className="text-sm font-bold text-text-primary">{rule.title}</h4>
                                  {rule.isRequiredAck && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                                      Mandatory
                                    </span>
                                  )}
                                </div>

                                {/* Verification Action Button */}
                                <button
                                  type="button"
                                  onClick={() => toggleRuleVerified(rule.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                                    isVerified
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200/70"
                                      : "bg-surface text-text-secondary border border-border-soft hover:border-brand-blue/40 hover:text-brand-blue"
                                  }`}
                                >
                                  {isVerified ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Verified & Read
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      Click to Verify
                                    </>
                                  )}
                                </button>
                              </div>

                              <p className="text-xs text-text-secondary leading-relaxed">{rule.content}</p>

                              {/* Rule Subsections Breakdown */}
                              {hasSubsections && (
                                <div className="mt-3 pt-3 border-t border-border-soft space-y-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-brand-blue" />
                                    Rule Subsections ({rule.subsections!.length} clauses)
                                  </span>
                                  <div className="grid grid-cols-1 gap-2">
                                    {rule.subsections!.map((sub, sIdx) => (
                                      <div
                                        key={sub.id || sIdx}
                                        className="p-3 rounded-xl bg-surface/80 border border-border-soft text-xs"
                                      >
                                        <div className="font-bold text-text-primary flex items-center gap-2">
                                          <span className="w-5 h-5 rounded-md bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[10px] font-mono shrink-0">
                                            {idx + 1}.{sIdx + 1}
                                          </span>
                                          <span>{sub.title}</span>
                                        </div>
                                        {sub.content && (
                                          <p className="text-[11px] text-text-secondary mt-1 pl-7 leading-relaxed">
                                            {sub.content}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Gated Guidance Box */}
                {!allMandatoryVerified ? (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Mandatory Rules Verification Required</h4>
                      <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                        Please click &quot;Click to Verify&quot; on all mandatory rules above to confirm that you have read and understood each regulation before advancing to the digital signature step.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">All Mandatory Regulations Verified</h4>
                      <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                        You have verified all institutional rules and policies. Proceed to the next step to execute your digital declaration and signature.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* STEP 4: DIGITAL SIGNATURE & DECLARATION UNDERTAKING              */}
            {/* ---------------------------------------------------------------- */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-xl font-bold text-text-primary tracking-tight">Digital Undertaking & Signature Verification</h2>
                  <p className="text-xs text-text-muted mt-1">Review the solemn declaration and provide your digital signature or signature image</p>
                </div>

                {/* Official Declaration Box with Bulletins */}
                {(() => {
                  const bulletins =
                    policy.declarationBulletins && policy.declarationBulletins.length > 0
                      ? policy.declarationBulletins
                      : (policy.declarationText.includes("\n")
                          ? policy.declarationText
                              .split(/\n+/)
                              .map((s) => s.replace(/^[-*•\d.]+\s*/, "").trim())
                              .filter(Boolean)
                          : DEFAULT_POLICY.declarationBulletins || []);

                  return (
                    <div className="p-6 rounded-3xl bg-[#040e1d] text-white border border-white/10 relative overflow-hidden space-y-4 shadow-xl">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#0162b1]/20 rounded-full blur-3xl pointer-events-none" />

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                          <FileCheck2 className="w-4 h-4" /> Official Declaration & Undertaking
                        </div>
                        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-400/20">
                          {bulletins.length} Undertaking Covenants
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{policy.title}</h3>

                      {policy.declarationText && (
                        <p className="text-xs text-slate-300 leading-relaxed font-medium bg-white/[0.04] p-3.5 rounded-xl border border-white/10">
                          "{policy.declarationText}"
                        </p>
                      )}

                      {/* Bulletins Section */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                          <ScrollText className="w-3.5 h-3.5 text-sky-400" /> Specific Undertaking Bulletins
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {bulletins.map((bulletin, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 flex items-start gap-3 transition-colors"
                            >
                              <div className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                                {bulletin}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-3 border-t border-white/10">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Cryptographically bound to applicant IP, submission timestamp, and institutional reference ledger.</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Signer Identity Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">Executing Signatory Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, signerRole: "PARENT", signerName: formData.parentName })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                          formData.signerRole === "PARENT"
                            ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                            : "border-border-soft bg-surface text-text-secondary"
                        }`}
                      >
                        Parent / Guardian
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, signerRole: "STUDENT", signerName: formData.studentName })}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                          formData.signerRole === "STUDENT"
                            ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                            : "border-border-soft bg-surface text-text-secondary"
                        }`}
                      >
                        Student Applicant
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1.5">Signatory Full Name</label>
                    <input
                      type="text"
                      value={formData.signerName || (formData.signerRole === "PARENT" ? formData.parentName : formData.studentName)}
                      onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
                      placeholder="Name of person signing"
                      className="w-full h-11 rounded-xl border border-border-soft bg-surface px-4 text-xs font-bold text-text-primary focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                </div>

                {/* Dual Signature Controls (Draw vs Upload) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-text-secondary">
                      Signature Verification <span className="text-rose-500">*</span>
                    </label>

                    {/* Mode Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border-soft">
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureMode("DRAW");
                          setTimeout(setupCanvas, 50);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          signatureMode === "DRAW"
                            ? "bg-white text-brand-blue shadow-sm"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        Draw Signature
                      </button>
                      {policy.allowUploadSignature && (
                        <button
                          type="button"
                          onClick={() => setSignatureMode("UPLOAD")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            signatureMode === "UPLOAD"
                              ? "bg-white text-brand-blue shadow-sm"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          Upload Image
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mode 1: Canvas Drawing */}
                  {signatureMode === "DRAW" && (
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed border-border-soft hover:border-brand-blue/40 rounded-2xl bg-white overflow-hidden shadow-inner">
                        <canvas
                          ref={canvasRef}
                          onPointerDown={startDrawing}
                          onPointerMove={draw}
                          onPointerUp={stopDrawing}
                          onPointerLeave={stopDrawing}
                          className="w-full h-44 touch-none cursor-crosshair block"
                          style={{ touchAction: "none" }}
                        />

                        {!isCanvasDrawn && (
                          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-text-muted opacity-40">
                            <FileSignature className="w-8 h-8 mb-1" />
                            <span className="text-xs font-medium">Draw your signature here with finger or mouse</span>
                          </div>
                        )}

                        {isCanvasDrawn && (
                          <div className="absolute top-3 right-3 pointer-events-none">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                              <Check className="w-3.5 h-3.5" /> Signature Captured
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-text-muted">Use smooth strokes. You can clear and redraw anytime.</span>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Clear Signature
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Upload Signature Image */}
                  {signatureMode === "UPLOAD" && (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-border-soft hover:border-brand-blue/40 rounded-2xl p-6 bg-surface text-center transition-colors">
                        {signatureData && uploadedFileName ? (
                          <div className="space-y-3">
                            <div className="max-w-xs mx-auto p-4 rounded-xl bg-white border border-border-soft shadow-inner">
                              <img src={signatureData} alt="Uploaded Signature" className="max-h-24 mx-auto object-contain" />
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-bold text-text-primary">{uploadedFileName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSignatureData(null);
                                  setUploadedFileName(null);
                                }}
                                className="text-xs font-semibold text-rose-600 hover:underline"
                              >
                                Remove & Change
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <Upload className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                            <h4 className="text-xs font-bold text-text-primary">Upload Signed Paper Photo or Scan</h4>
                            <p className="text-[11px] text-text-muted mt-1 max-w-sm mx-auto">
                              Take a clear photo of your handwritten signature on white paper. Supports PNG, JPG, WEBP up to 5MB.
                            </p>
                            <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark transition-colors cursor-pointer shadow-sm">
                              <Upload className="w-3.5 h-3.5" /> Browse Signature Image
                              <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {errors.signature && (
                    <p className="text-xs text-rose-500 font-semibold flex items-center gap-1.5 mt-2 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.signature}
                    </p>
                  )}
                </div>

                {/* Solemn Undertaking Checkbox */}
                <div className="pt-2 border-t border-border-soft">
                  <label
                    className={`flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all shadow-sm ${
                      errors.termsAccepted
                        ? "border-rose-400 bg-rose-50/20 hover:border-rose-500"
                        : "border-brand-blue/20 bg-brand-blue/5 hover:border-brand-blue/40 hover:bg-brand-blue/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={(e) => {
                        setFormData({ ...formData, termsAccepted: e.target.checked });
                        clearFieldError("termsAccepted");
                      }}
                      className="mt-1 h-5 w-5 rounded-lg text-brand-blue focus:ring-brand-blue/30 border-border-soft cursor-pointer shrink-0"
                    />
                    <div className="space-y-1">
                      <strong className="text-xs sm:text-sm font-bold text-text-primary flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-brand-blue" />
                        Solemn Legal Undertaking Confirmation
                      </strong>
                      <span className="text-xs font-medium text-text-secondary leading-relaxed block">
                        I / We have carefully read, understood, and accept each of the undertaking covenants and bulletins stated above, along with the Code of Conduct and Disciplinary Regulations. I certify that the signatory identity and digital signature provided are genuine and legally valid.
                      </span>
                    </div>
                  </label>
                  {errors.termsAccepted && (
                    <p className="text-xs text-rose-500 font-semibold mt-2 flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.termsAccepted}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step Navigation Actions */}
            <div className="pt-6 border-t border-border-soft flex items-center justify-between gap-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-surface hover:bg-surface-2 transition-colors border border-border-soft"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-dark transition-colors shadow-md shadow-brand-blue/20"
                >
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#0162b1] to-[#014d8a] hover:from-[#014d8a] hover:to-[#071d3d] transition-all shadow-lg shadow-brand-blue/25 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting Application...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Submit Application & Sign
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Bottom Help Card */}
        <div className="mt-8 text-center text-xs text-text-muted space-y-1">
          <p>Need assistance with your admission application?</p>
          <p>
            Contact Admissions Desk at{" "}
            <a href="tel:+919746033703" className="font-bold text-brand-blue hover:underline">
              +91 97460 33703
            </a>{" "}
            or{" "}
            <a href="tel:+918089372819" className="font-bold text-brand-blue hover:underline">
              +91 80893 72819
            </a>{" "}
            or visit any of our Kottayam campuses.
          </p>
        </div>
      </section>
    </div>
  );
}

