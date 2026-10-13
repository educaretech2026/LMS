"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import {
  MessagesSquare,
  Search,
  Plus,
  Send,
  User,
  Shield,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Paperclip,
  X,
  RefreshCw,
  ArrowLeft,
  UserCheck,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Info,
  ImageIcon,
  FileText,
  UploadCloud,
  Loader2,
  ZoomIn,
  Download,
} from "lucide-react";

export interface AttachmentItem {
  url: string;
  name: string;
  type?: "image" | "pdf" | "file";
  size?: number;
}

function isImageUrl(url: string, name?: string): boolean {
  const target = (name || url).toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(target);
}

function isPdfUrl(url: string, name?: string): boolean {
  const target = (name || url).toLowerCase();
  return /\.pdf(\?.*)?$/i.test(target);
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAttachments(attachments: any, attachmentUrls: any): AttachmentItem[] {
  let rawList: any[] = [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    rawList = attachments;
  } else if (Array.isArray(attachmentUrls) && attachmentUrls.length > 0) {
    rawList = attachmentUrls;
  }

  return rawList
    .map((item, idx) => {
      if (!item) return null;
      if (typeof item === "string") {
        const isImg = isImageUrl(item);
        const isPdf = isPdfUrl(item);
        let displayName = `Attachment ${idx + 1}`;
        try {
          const path = item.split("?")[0];
          const filename = path.substring(path.lastIndexOf("/") + 1);
          if (filename && filename.length > 0) {
            displayName = decodeURIComponent(filename);
          }
        } catch {
          // ignore
        }
        return {
          url: item,
          name: displayName,
          type: isImg ? "image" : isPdf ? "pdf" : "file",
        } as AttachmentItem;
      }
      const url = item.url || "";
      const isImg = item.type === "image" || isImageUrl(url, item.filename || item.name);
      const isPdf = item.type === "pdf" || isPdfUrl(url, item.filename || item.name);
      return {
        url,
        name: item.filename || item.name || (isImg ? `Image ${idx + 1}` : isPdf ? `Document ${idx + 1}.pdf` : `Attachment ${idx + 1}`),
        type: isImg ? "image" : isPdf ? "pdf" : item.type || "file",
        size: item.size,
      } as AttachmentItem;
    })
    .filter((x): x is AttachmentItem => Boolean(x && x.url));
}

function AttachmentGallery({
  attachments,
  attachmentUrls,
  onPreviewImage,
  isOwnMessage,
}: {
  attachments: any;
  attachmentUrls: any;
  onPreviewImage: (item: { url: string; title: string }) => void;
  isOwnMessage?: boolean;
}) {
  const list = normalizeAttachments(attachments, attachmentUrls);
  if (list.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-black/10 flex flex-col gap-2">
      {/* Images Grid */}
      {list.some((a) => a.type === "image") && (
        <div className="flex flex-wrap gap-2">
          {list
            .filter((a) => a.type === "image")
            .map((img, idx) => (
              <div
                key={idx}
                onClick={() => onPreviewImage({ url: img.url, title: img.name })}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-xs hover:shadow-md transition-all w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center shrink-0"
                title="Click to view full image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="p-1.5 rounded-full bg-white/90 text-slate-900 shadow">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[10px] text-white truncate font-medium">
                  {img.name}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* PDFs and Other Documents */}
      {list.some((a) => a.type !== "image") && (
        <div className="flex flex-col gap-1.5">
          {list
            .filter((a) => a.type !== "image")
            .map((doc, idx) => {
              const isPdf = doc.type === "pdf";
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-xs transition-colors ${
                    isOwnMessage
                      ? "bg-white/15 border-white/20 text-white hover:bg-white/20"
                      : isPdf
                      ? "bg-red-50/90 border-red-200/90 text-red-950 hover:bg-red-100/70"
                      : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPdf ? (
                      <div className="p-1.5 bg-red-100 text-red-600 rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-[11px] sm:text-xs">
                        {doc.name}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {isPdf ? "PDF Document" : "File Attachment"}
                        {doc.size ? ` • ${formatFileSize(doc.size)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                        isOwnMessage
                          ? "bg-white/20 hover:bg-white/30 text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 shadow-2xs"
                      }`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View</span>
                    </a>
                    <a
                      href={doc.url}
                      download={doc.name}
                      className={`p-1 rounded-md transition-colors ${
                        isOwnMessage
                          ? "hover:bg-white/20 text-white"
                          : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                      }`}
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teacherProfile?: {
    specialization?: string | null;
    qualification?: string | null;
  } | null;
}

interface DoubtMessageItem {
  id: string;
  doubtId: string;
  senderId: string;
  senderRole: string;
  content?: string;
  message?: string;
  attachments?: any;
  attachmentUrls?: string[];
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
    role?: { name: string };
  };
}

interface DoubtItem {
  id: string;
  studentId: string;
  teacherId?: string;
  assignedTeacherId?: string;
  subjectId?: string | null;
  chapterId?: string | null;
  topicId?: string | null;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "PENDING" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED" | "CLOSED";
  attachments?: any;
  attachmentUrls?: string[];
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
  };
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
  };
  assignedTeacher?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
  };
  subject?: { id: string; name: string } | null;
  chapter?: { id: string; name: string } | null;
  topic?: { id: string; name: string } | null;
  messages?: DoubtMessageItem[];
  _count?: {
    messages: number;
  };
}

interface DoubtsClientProps {
  initialDoubts: DoubtItem[];
  initialTeachers: TeacherOption[];
  initialRole?: string | null;
  initialSelectedId?: string;
}

export function DoubtsClient({ initialDoubts, initialTeachers, initialRole, initialSelectedId }: DoubtsClientProps) {
  const { role: authRole, userId } = useAuth();
  const effectiveRole = initialRole || authRole;
  const normalizedRole = effectiveRole ? effectiveRole.toUpperCase().replace(/\s+/g, "_") : "";
  const isStudent = normalizedRole === "STUDENT" || normalizedRole === "PUBLIC_LEARNER";
  const isTeacher = normalizedRole === "TEACHER";
  const isAdmin = ["SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN"].includes(normalizedRole);

  const [doubts, setDoubts] = useState<DoubtItem[]>(initialDoubts);
  const [teachers, setTeachers] = useState<TeacherOption[]>(initialTeachers);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId || (initialDoubts.length > 0 ? initialDoubts[0].id : null)
  );
  const [activeDoubt, setActiveDoubt] = useState<DoubtItem | null>(null);
  const [isLoadingActive, setIsLoadingActive] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Mobile navigation
  const [showMobileChat, setShowMobileChat] = useState<boolean>(Boolean(initialSelectedId));

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<AttachmentItem[]>([]);
  const [newAttachmentInput, setNewAttachmentInput] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isUploadingReplyFile, setIsUploadingReplyFile] = useState(false);
  const [replyUploadStatus, setReplyUploadStatus] = useState("");
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ask Doubt Modal state (for Students)
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newAttachments, setNewAttachments] = useState<AttachmentItem[]>([]);
  const [newModalAttachmentInput, setNewModalAttachmentInput] = useState("");
  const [isSubmittingNewDoubt, setIsSubmittingNewDoubt] = useState(false);
  const [isUploadingModalFiles, setIsUploadingModalFiles] = useState(false);
  const [modalUploadStatus, setModalUploadStatus] = useState("");
  const [isDragOverModal, setIsDragOverModal] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Lightbox modal state for full-screen image preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Reassign Modal state (for Admin)
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Helper to upload files to Cloudflare R2
  const uploadFileToR2 = async (file: File): Promise<AttachmentItem> => {
    const isImg = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    const { uploadUrl, finalUrl } = (await fetchApi(
      `/storage/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`
    )) as { uploadUrl: string; finalUrl: string };

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    return {
      url: finalUrl,
      name: file.name,
      type: isImg ? "image" : isPdf ? "pdf" : "file",
      size: file.size,
    };
  };

  // Upload handler for reply composer (Teacher, Student, Admin)
  const handleReplyFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingReplyFile(true);
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setReplyUploadStatus(`Uploading ${file.name} (${i + 1}/${list.length})...`);
        const item = await uploadFileToR2(file);
        setReplyAttachments((prev) => [...prev, item]);
      }
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    } finally {
      setIsUploadingReplyFile(false);
      setReplyUploadStatus("");
      if (replyFileInputRef.current) {
        replyFileInputRef.current.value = "";
      }
    }
  };

  // Upload handler for Ask Doubt modal (Student)
  const handleModalFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingModalFiles(true);
    setModalError(null);
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setModalUploadStatus(`Uploading ${file.name} (${i + 1}/${list.length})...`);
        const item = await uploadFileToR2(file);
        setNewAttachments((prev) => [...prev, item]);
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to upload file");
    } finally {
      setIsUploadingModalFiles(false);
      setModalUploadStatus("");
      if (modalFileInputRef.current) {
        modalFileInputRef.current.value = "";
      }
    }
  };

  // Fetch full details of active thread
  const loadActiveThread = async (id: string, silent = false) => {
    if (!silent) setIsLoadingActive(true);
    try {
      const data = await fetchApi<DoubtItem>(`/doubts/${id}`);
      setActiveDoubt(data);
      // Update thread in parent list summary if needed
      setDoubts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: data.status, messages: data.messages } : d))
      );
    } catch (err) {
      console.error("Failed to load thread:", err);
    } finally {
      if (!silent) setIsLoadingActive(false);
    }
  };

  // Poll active thread messages every 5 seconds
  useEffect(() => {
    if (!selectedId) return;
    loadActiveThread(selectedId);

    const interval = setInterval(() => {
      loadActiveThread(selectedId, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedId]);

  // Periodic list refresh every 15 seconds
  useEffect(() => {
    const listInterval = setInterval(async () => {
      try {
        const fresh = await fetchApi<DoubtItem[]>("/doubts");
        setDoubts(fresh || []);
      } catch (e) {
        // Silent catch
      }
    }, 15000);

    return () => clearInterval(listInterval);
  }, []);

  // Auto-scroll messages feed
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeDoubt?.messages]);

  // Manual list refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [freshDoubts, freshTeachers] = await Promise.all([
        fetchApi<DoubtItem[]>("/doubts"),
        fetchApi<TeacherOption[]>("/doubts/teachers/available"),
      ]);
      setDoubts(freshDoubts || []);
      setTeachers(freshTeachers || []);
      if (selectedId) {
        await loadActiveThread(selectedId, true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Status update (Teacher or Admin)
  const handleStatusChange = async (newStatus: "OPEN" | "PENDING" | "IN_PROGRESS" | "ANSWERED" | "RESOLVED") => {
    if (!selectedId) return;
    try {
      const updated = await fetchApi<DoubtItem>(`/doubts/${selectedId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setActiveDoubt(updated);
      setDoubts((prev) =>
        prev.map((d) => (d.id === selectedId ? { ...d, status: updated.status || newStatus } : d))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  // Send message reply (Student, Teacher, Admin)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || (!replyText.trim() && replyAttachments.length === 0) || isSendingReply || isUploadingReplyFile) return;

    setIsSendingReply(true);
    try {
      const text = replyText.trim() || (replyAttachments.length > 0 ? "Shared attachment(s)" : "");
      const attachmentUrls = replyAttachments.map((a) => a.url);

      const newMsg = await fetchApi<DoubtMessageItem>(`/doubts/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: text,
          message: text,
          attachments: replyAttachments,
          attachmentUrls: attachmentUrls,
        }),
      });

      // Optimistic append
      if (activeDoubt) {
        setActiveDoubt({
          ...activeDoubt,
          messages: [...(activeDoubt.messages || []), newMsg],
          status: isTeacher && (activeDoubt.status === "PENDING" || activeDoubt.status === "OPEN") ? "ANSWERED" : activeDoubt.status,
        });
      }
      setReplyText("");
      setReplyAttachments([]);
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Submit new doubt (Student)
  const handleCreateDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newTeacherId) {
      setModalError("Please select a teacher to ask your doubt.");
      return;
    }
    if (!newTitle.trim()) {
      setModalError("Please provide a title for your doubt.");
      return;
    }
    if (!newDescription.trim()) {
      setModalError("Please explain your doubt in detail.");
      return;
    }

    setIsSubmittingNewDoubt(true);
    try {
      const attachmentUrls = newAttachments.map((a) => a.url);

      const created = await fetchApi<DoubtItem>("/doubts", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          teacherId: newTeacherId,
          assignedTeacherId: newTeacherId,
          priority: newPriority,
          attachments: newAttachments,
          attachmentUrls: attachmentUrls,
        }),
      });

      setDoubts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setActiveDoubt(created);
      setIsAskModalOpen(false);
      setShowMobileChat(true);

      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewTeacherId("");
      setNewPriority("MEDIUM");
      setNewAttachments([]);
      setNewModalAttachmentInput("");
    } catch (err: any) {
      setModalError(err.message || "Failed to submit doubt");
    } finally {
      setIsSubmittingNewDoubt(false);
    }
  };

  // Admin Reassign Teacher
  const handleReassignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reassignTeacherId) return;

    setIsSubmittingReassign(true);
    try {
      const updated = await fetchApi<DoubtItem>(`/doubts/${selectedId}/reassign`, {
        method: "PATCH",
        body: JSON.stringify({ teacherId: reassignTeacherId }),
      });

      setActiveDoubt(updated);
      setDoubts((prev) =>
        prev.map((d) => (d.id === selectedId ? { ...d, teacher: updated.teacher, assignedTeacher: updated.teacher || updated.assignedTeacher } : d))
      );
      setIsReassignModalOpen(false);
      setReassignTeacherId("");
    } catch (err: any) {
      alert(err.message || "Failed to reassign teacher");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Filtered doubts
  const filteredDoubts = doubts.filter((d) => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "PENDING" && d.status !== "PENDING" && d.status !== "OPEN") return false;
      if (statusFilter !== "PENDING" && d.status !== statusFilter) return false;
    }
    if (priorityFilter !== "ALL" && d.priority !== priorityFilter) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const studentName = d.student ? `${d.student.firstName} ${d.student.lastName}`.toLowerCase() : "";
    const teacherObj = d.teacher || d.assignedTeacher;
    const teacherName = teacherObj
      ? `${teacherObj.firstName} ${teacherObj.lastName}`.toLowerCase()
      : "";
    const title = (d.title || "").toLowerCase();
    const desc = (d.description || "").toLowerCase();
    const subject = (d.subject?.name || "").toLowerCase();

    return (
      title.includes(q) ||
      desc.includes(q) ||
      studentName.includes(q) ||
      teacherName.includes(q) ||
      subject.includes(q)
    );
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">Urgent</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">High</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Medium</span>;
      case "LOW":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">Low</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
      case "PENDING":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Pending</span>;
      case "IN_PROGRESS":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1"><Clock className="w-3 h-3" /> In Progress</span>;
      case "ANSWERED":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Answered</span>;
      case "RESOLVED":
      case "CLOSED":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolved</span>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Doubt Clearance" role={effectiveRole || undefined}>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 text-slate-800">
        {/* Top Header Banner */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-blue to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <MessagesSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Academic Doubt Clearance</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isStudent && "Ask questions directly to your teachers. Receive clear explanations and 1-on-1 guidance."}
              {isTeacher && "Answer academic queries from your students and provide structured mentorship."}
              {isAdmin && "Supervise all academic doubts and faculty guidance across departments."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh threads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>

          {/* Student "Ask Doubt" CTA */}
          {(isStudent || isAdmin) && (
            <button
              onClick={() => setIsAskModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-brand-red to-rose-600 hover:from-rose-600 hover:to-rose-700 rounded-lg shadow-sm shadow-rose-200 transition-all hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              Ask a Doubt
            </button>
          )}
        </div>
      </header>

      {/* Admin Monitoring Disclaimer Notice */}
      <div className="bg-amber-50/80 border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-between text-xs text-amber-800 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>Institutional Oversight:</strong> All messages between students and teachers are academic-only and supervised by EduCare administration.
          </span>
        </div>
        <span className="text-[11px] text-amber-700/80 hidden sm:inline">End-to-End Audited</span>
      </div>

      {/* Main Workspace: Left Thread List + Right Chat Feed */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column: Doubts Threads List */}
        <div
          className={`w-full md:w-96 lg:w-[410px] bg-white border-r border-slate-200 flex flex-col shrink-0 ${
            showMobileChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-200 space-y-2.5 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search doubts, teachers, students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
              {(["ALL", "PENDING", "IN_PROGRESS", "ANSWERED", "RESOLVED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? "bg-brand-blue text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {st === "ALL" ? "All" : st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredDoubts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <HelpCircle className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No doubt threads found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                  {doubts.length === 0
                    ? isStudent
                      ? "You haven't asked any doubts yet. Click 'Ask a Doubt' above to get help from your teachers!"
                      : "No student doubts submitted yet."
                    : "No threads match your current search and filters."}
                </p>
                {isStudent && doubts.length === 0 && (
                  <button
                    onClick={() => setIsAskModalOpen(true)}
                    className="mt-4 px-3 py-1.5 text-xs font-medium text-brand-red bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                  >
                    + Ask Your First Doubt
                  </button>
                )}
              </div>
            ) : (
              filteredDoubts.map((d) => {
                const isSelected = selectedId === d.id;
                const studentName = d.student ? `${d.student.firstName} ${d.student.lastName}` : "Student";
                const teacherObj = d.teacher || d.assignedTeacher;
                const teacherName = teacherObj
                  ? `${teacherObj.firstName} ${teacherObj.lastName}`
                  : "Teacher";

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedId(d.id);
                      setShowMobileChat(true);
                    }}
                    className={`p-3.5 cursor-pointer transition-all hover:bg-slate-50 relative ${
                      isSelected
                        ? "bg-indigo-50/70 border-l-4 border-l-brand-blue"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {getPriorityBadge(d.priority)}
                        {getStatusBadge(d.status)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(d.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <h3 className={`text-xs font-semibold line-clamp-1 mb-1 ${isSelected ? "text-brand-blue font-bold" : "text-slate-800"}`}>
                      {d.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                      {d.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1 truncate max-w-[200px]" title={`Student: ${studentName} → Teacher: ${teacherName}`}>
                        <span className="font-medium text-slate-700">{studentName}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-indigo-600 font-medium truncate">{teacherName}</span>
                      </div>
                      {d._count?.messages !== undefined && d._count.messages > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 font-semibold">
                          <MessageCircle className="w-2.5 h-2.5" />
                          {d._count.messages}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Conversation Thread */}
        <div
          className={`flex-1 flex flex-col bg-slate-50/50 overflow-hidden ${
            showMobileChat ? "flex" : "hidden md:flex"
          }`}
        >
          {activeDoubt ? (
            <>
              {/* Active Thread Header */}
              <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Back to doubts"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-slate-900">{activeDoubt.title}</h2>
                      {getPriorityBadge(activeDoubt.priority)}
                      {getStatusBadge(activeDoubt.status)}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <User className="w-3 h-3 text-slate-400" />
                        Student: {activeDoubt.student?.firstName} {activeDoubt.student?.lastName}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        <GraduationCap className="w-3 h-3 text-indigo-500" />
                        Teacher: {activeDoubt.teacher?.firstName || activeDoubt.assignedTeacher?.firstName} {activeDoubt.teacher?.lastName || activeDoubt.assignedTeacher?.lastName}
                      </span>
                      {activeDoubt.subject && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-medium">Subject: {activeDoubt.subject.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Status Dropdown & Admin Reassign */}
                <div className="flex items-center gap-2">
                  {/* Status update (Available to Teacher and Admin) */}
                  {(isTeacher || isAdmin) && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500 font-medium hidden sm:inline">Status:</span>
                      <select
                        value={activeDoubt.status}
                        onChange={(e) => handleStatusChange(e.target.value as any)}
                        className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand-blue shadow-xs"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="ANSWERED">Answered</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>
                    </div>
                  )}

                  {/* Admin Reassign Button */}
                  {isAdmin && (
                    <button
                      onClick={() => setIsReassignModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                      title="Reassign to another teacher"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      Reassign Teacher
                    </button>
                  )}
                </div>
              </div>

              {/* Message Feed Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingActive ? (
                  <div className="flex items-center justify-center h-48 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Original Student Doubt Statement Card */}
                    <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-xs relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-blue" />
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-brand-blue font-bold flex items-center justify-center text-xs">
                            {activeDoubt.student?.firstName?.[0] || "S"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {activeDoubt.student?.firstName} {activeDoubt.student?.lastName} (Student Query)
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Submitted {new Date(activeDoubt.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          Initial Problem
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-2 pl-1">
                        {activeDoubt.description}
                      </div>

                      {/* Attachments if any */}
                      <AttachmentGallery
                        attachments={activeDoubt.attachments}
                        attachmentUrls={activeDoubt.attachmentUrls}
                        onPreviewImage={(item) => setPreviewImage(item)}
                      />
                    </div>

                    {/* Timeline Separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Discussion Thread
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Replies Feed */}
                    {activeDoubt.messages && activeDoubt.messages.length > 0 ? (
                      activeDoubt.messages.map((msg) => {
                        const isOwn = Boolean(userId && msg.senderId === userId);
                        const isTeacherMsg = msg.senderRole === "TEACHER";
                        const isAdminMsg = ["ADMIN", "SUPER_ADMIN", "CENTRE_ADMIN"].includes(msg.senderRole);

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-full`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[11px] font-semibold text-slate-700">
                                {msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : "User"}
                              </span>

                              {/* Badges for Sender Roles */}
                              {isTeacherMsg && (
                                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  <GraduationCap className="w-2.5 h-2.5" /> Faculty
                                </span>
                              )}
                              {isAdminMsg && (
                                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Shield className="w-2.5 h-2.5 text-amber-600" /> Academic Supervisor
                                </span>
                              )}

                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div
                              className={`rounded-2xl px-4 py-2.5 text-xs max-w-2xl leading-relaxed whitespace-pre-wrap shadow-xs ${
                                isAdminMsg
                                  ? "bg-amber-50/90 text-amber-950 border border-amber-200/80 rounded-tl-sm"
                                  : isTeacherMsg
                                  ? "bg-gradient-to-br from-indigo-50 to-blue-50/70 text-slate-900 border border-indigo-100 rounded-tl-sm"
                                  : isOwn
                                  ? "bg-brand-blue text-white rounded-tr-sm"
                                  : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                              }`}
                            >
                              {msg.content || msg.message}

                              {/* Attachments inside message bubble */}
                              <AttachmentGallery
                                attachments={msg.attachments}
                                attachmentUrls={msg.attachmentUrls}
                                onPreviewImage={(item) => setPreviewImage(item)}
                                isOwnMessage={isOwn}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <Sparkles className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p className="text-xs">No replies yet on this thread.</p>
                        <p className="text-[11px] text-slate-400">
                          {isTeacher
                            ? "Provide a clear step-by-step explanation or code snippet below to help the student."
                            : "Waiting for faculty response."}
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Reply Composer Box */}
              <form
                onSubmit={handleSendMessage}
                className="bg-white border-t border-slate-200 p-3 shrink-0"
              >
                {/* Hidden File Input for Image/PDF Upload */}
                <input
                  ref={replyFileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleReplyFileUpload(e.target.files);
                  }}
                />

                {/* Upload Status Banner */}
                {isUploadingReplyFile && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-600" />
                    <span>{replyUploadStatus || "Uploading attachment to cloud storage..."}</span>
                  </div>
                )}

                {/* Active attachments pills */}
                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {replyAttachments.map((item, i) => (
                      <span
                        key={i}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border shadow-2xs ${
                          item.type === "pdf"
                            ? "bg-red-50 text-red-800 border-red-200"
                            : item.type === "image"
                            ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.type === "image" ? (
                          <div className="w-4 h-4 rounded overflow-hidden shrink-0 border border-indigo-300 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : item.type === "pdf" ? (
                          <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate max-w-[150px] font-medium">{item.name}</span>
                        {item.size ? (
                          <span className="text-[10px] opacity-60">({formatFileSize(item.size)})</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setReplyAttachments(replyAttachments.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-500 ml-0.5"
                          title="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-brand-blue/20 focus-within:border-brand-blue transition-all">
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isTeacher
                          ? "Write an academic explanation, solution steps, or upload handwritten solution/PDF..."
                          : isAdmin
                          ? "Intervene as Academic Supervisor (visible to student & teacher)..."
                          : "Reply to your teacher, ask clarification, or upload problem screenshots..."
                      }
                      className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden resize-none"
                    />

                    {/* Attachment toolbar (Upload Image/PDF + Quick URL adder) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 mt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Direct File Upload Button */}
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          disabled={isUploadingReplyFile}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors shadow-2xs hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-50"
                          title="Upload Image (PNG, JPG, WEBP) or PDF"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Upload Image / PDF</span>
                        </button>

                        {/* Optional Web Link Adder */}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Or paste web link..."
                            value={newAttachmentInput}
                            onChange={(e) => setNewAttachmentInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newAttachmentInput.trim()) {
                                e.preventDefault();
                                const url = newAttachmentInput.trim();
                                setReplyAttachments([
                                  ...replyAttachments,
                                  {
                                    url,
                                    name: isImageUrl(url) ? "Image Link" : isPdfUrl(url) ? "PDF Document" : "Web Resource",
                                    type: isImageUrl(url) ? "image" : isPdfUrl(url) ? "pdf" : "file",
                                  },
                                ]);
                                setNewAttachmentInput("");
                              }
                            }}
                            className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600 placeholder:text-slate-400 focus:outline-hidden w-36 sm:w-48"
                          />
                          {newAttachmentInput.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                const url = newAttachmentInput.trim();
                                setReplyAttachments([
                                  ...replyAttachments,
                                  {
                                    url,
                                    name: isImageUrl(url) ? "Image Link" : isPdfUrl(url) ? "PDF Document" : "Web Resource",
                                    type: isImageUrl(url) ? "image" : isPdfUrl(url) ? "pdf" : "file",
                                  },
                                ]);
                                setNewAttachmentInput("");
                              }}
                              className="text-[11px] px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        Shift+Enter for newline
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={(!replyText.trim() && replyAttachments.length === 0) || isSendingReply || isUploadingReplyFile}
                    className="p-3 bg-brand-blue hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:hover:bg-brand-blue flex items-center justify-center shrink-0"
                    title="Send Message"
                  >
                    <Send className={`w-4 h-4 ${isSendingReply ? "animate-pulse" : ""}`} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-blue mb-4 shadow-xs">
                <MessagesSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Select a Doubt to View Conversation
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Choose a discussion thread from the left to view questions, submit faculty solutions, and monitor progress.
              </p>
              {isStudent && (
                <button
                  onClick={() => setIsAskModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand-red to-rose-600 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  + Ask a New Doubt
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STUDENT: Ask Doubt Modal */}
      {isAskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-brand-blue to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <MessagesSquare className="w-5 h-5 text-indigo-200" />
                  Ask Your Teacher a Doubt
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Direct academic inquiry to your faculty. Monitored for learning quality.
                </p>
              </div>
              <button
                onClick={() => setIsAskModalOpen(false)}
                className="text-white/70 hover:text-white rounded-lg p-1 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDoubt} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Teacher Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Teacher / Faculty <span className="text-red-500">*</span>
                </label>
                <select
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  required
                >
                  <option value="">-- Choose a Teacher --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} {t.teacherProfile?.specialization ? `(${t.teacherProfile.specialization})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Students can only ask academic questions to registered teachers.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Doubt Title / Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Calculus: Integration by parts on Question 4"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Explain Your Doubt in Detail <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe where you got stuck, the step you don't understand, or what you've tried so far..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue resize-none"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        newPriority === p
                          ? p === "URGENT"
                            ? "bg-red-500 text-white border-red-500 shadow-xs"
                            : p === "HIGH"
                            ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                            : "bg-brand-blue text-white border-brand-blue shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attachments (Images & PDFs) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attachments (Upload Problem Screenshots, Diagrams, or PDF Notes)
                </label>

                {/* Hidden File Input */}
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleModalFileUpload(e.target.files);
                  }}
                />

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOverModal(true);
                  }}
                  onDragLeave={() => setIsDragOverModal(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOverModal(false);
                    if (e.dataTransfer.files) handleModalFileUpload(e.dataTransfer.files);
                  }}
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragOverModal
                      ? "border-brand-blue bg-indigo-50/80 scale-[1.01]"
                      : "border-slate-300 hover:border-brand-blue bg-slate-50 hover:bg-indigo-50/40"
                  }`}
                >
                  {isUploadingModalFiles ? (
                    <div className="py-2 flex flex-col items-center gap-1.5 text-indigo-700">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
                      <span className="text-xs font-medium">
                        {modalUploadStatus || "Uploading files to cloud storage..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="p-2 bg-indigo-100 text-brand-blue rounded-full mb-0.5">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        Click or drag images & PDFs here
                      </p>
                      <p className="text-[11px] text-slate-500">
                        PNG, JPG, WEBP, or PDF files (assignment photos, exercise pages, formula sheets)
                      </p>
                    </div>
                  )}
                </div>

                {/* Uploaded attachments preview list */}
                {newAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {newAttachments.map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs shadow-2xs ${
                          item.type === "pdf"
                            ? "bg-red-50 text-red-900 border-red-200"
                            : item.type === "image"
                            ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                            : "bg-slate-50 text-slate-800 border-slate-200"
                        }`}
                      >
                        {item.type === "image" ? (
                          <div className="w-5 h-5 rounded overflow-hidden shrink-0 border border-indigo-300 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        ) : item.type === "pdf" ? (
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate max-w-[170px] font-medium">{item.name}</span>
                        {item.size ? (
                          <span className="text-[10px] opacity-60">({formatFileSize(item.size)})</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setNewAttachments(newAttachments.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-500 ml-1"
                          title="Remove attachment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional Web Link Input */}
                <div className="flex gap-2 mt-2.5">
                  <input
                    type="text"
                    placeholder="Or paste external drive link / image URL..."
                    value={newModalAttachmentInput}
                    onChange={(e) => setNewModalAttachmentInput(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newModalAttachmentInput.trim()) {
                        const url = newModalAttachmentInput.trim();
                        setNewAttachments([
                          ...newAttachments,
                          {
                            url,
                            name: isImageUrl(url) ? "Image Link" : isPdfUrl(url) ? "PDF Document" : "Web Resource",
                            type: isImageUrl(url) ? "image" : isPdfUrl(url) ? "pdf" : "file",
                          },
                        ]);
                        setNewModalAttachmentInput("");
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    Add Link
                  </button>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAskModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewDoubt}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand-red to-rose-600 hover:from-rose-600 hover:to-rose-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmittingNewDoubt ? "Submitting..." : "Send Doubt to Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN: Reassign Teacher Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  Reassign Academic Doubt
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Administrative re-routing to another subject teacher
                </p>
              </div>
              <button
                onClick={() => setIsReassignModalOpen(false)}
                className="text-white/70 hover:text-white rounded-lg p-1 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select New Assigned Teacher
                </label>
                <select
                  value={reassignTeacherId}
                  onChange={(e) => setReassignTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  required
                >
                  <option value="">-- Choose Faculty Member --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} {t.teacherProfile?.specialization ? `(${t.teacherProfile.specialization})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  The selected teacher will be notified immediately and will receive this student&apos;s doubt thread.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reassignTeacherId || isSubmittingReassign}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmittingReassign ? "Reassigning..." : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-white text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-semibold truncate max-w-md">{previewImage.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Size</span>
                </a>
                <a
                  href={previewImage.url}
                  download={previewImage.title}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                  title="Download Image"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Stage */}
            <div className="p-3 sm:p-6 flex items-center justify-center bg-slate-950/60 overflow-auto max-h-[80vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
