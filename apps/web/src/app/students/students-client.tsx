"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import { Users, Plus, Search, Filter, MoreVertical, X, User, ChevronRight, CheckCircle2, ChevronLeft, Building, BookOpen, GraduationCap, CreditCard, ChevronDown, Webhook } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

interface Student {
  id: string;
  admissionNo: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  academicYear: string;
  board: string;
  classLevel: string;
  centre: string;
  division: string;
  trackId?: string;
  trackName?: string;
  password?: string;
  subjectIds?: string[];
  bloodGroup?: string;
  dateOfBirth?: string;
  parentOccupation?: string;
  status?: string;
  source?: string;
  externalCrmId?: string;
  address?: string;
  createdAt?: string;
}

export function StudentsClient({ initialStudents }: { initialStudents: Student[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("All Years");
  const [filterBoard, setFilterBoard] = useState("All Boards");
  const [filterClass, setFilterClass] = useState("All Classes");
  const [filterCentre, setFilterCentre] = useState("All Centres");
  const [filterDivision, setFilterDivision] = useState("All Divisions");
  const [filterSource, setFilterSource] = useState("All Sources");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Student | null>(null);
  const [pendingEnquiryId, setPendingEnquiryId] = useState<string | null>(null);

  // Live master setup data for filters
  const [liveBatches, setLiveBatches] = useState<any[]>([]);
  const [liveYears, setLiveYears] = useState<any[]>([]);
  const [liveBoards, setLiveBoards] = useState<any[]>([]);
  const [liveStandards, setLiveStandards] = useState<any[]>([]);
  const [liveCentres, setLiveCentres] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetchApi("/setup/batches").catch(() => []),
      fetchApi("/setup/academic-years").catch(() => []),
      fetchApi("/setup/boards").catch(() => []),
      fetchApi("/setup/standards").catch(() => []),
      fetchApi("/setup/centres").catch(() => []),
    ]).then(([ba, y, bo, st, ce]: any[]) => {
      setLiveBatches(Array.isArray(ba) ? ba : []);
      setLiveYears(Array.isArray(y) ? y : []);
      setLiveBoards(Array.isArray(bo) ? bo : []);
      setLiveStandards(Array.isArray(st) ? st : []);
      setLiveCentres(Array.isArray(ce) ? ce : []);
    });
  }, []);

  const divisionOptions = useMemo(() => {
    const set = new Set<string>();
    liveBatches.forEach(b => { if (b.name) set.add(b.name); });
    students.forEach(s => { if (s.division && s.division !== "N/A") set.add(s.division); });
    return ["All Divisions", ...Array.from(set).sort()];
  }, [liveBatches, students]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    liveYears.forEach(y => { if (y.name) set.add(y.name); });
    students.forEach(s => { if (s.academicYear && s.academicYear !== "N/A") set.add(s.academicYear); });
    return ["All Years", ...Array.from(set).sort()];
  }, [liveYears, students]);

  const boardOptions = useMemo(() => {
    const set = new Set<string>();
    liveBoards.forEach(b => { if (b.name) set.add(b.name); });
    students.forEach(s => { if (s.board && s.board !== "N/A") set.add(s.board); });
    return ["All Boards", ...Array.from(set).sort()];
  }, [liveBoards, students]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    liveStandards.forEach(s => { if (s.name) set.add(s.name); });
    students.forEach(s => { if (s.classLevel && s.classLevel !== "N/A") set.add(s.classLevel); });
    return ["All Classes", ...Array.from(set).sort()];
  }, [liveStandards, students]);

  const centreOptions = useMemo(() => {
    const set = new Set<string>();
    liveCentres.forEach(c => { if (c.name) set.add(c.name); });
    students.forEach(s => { if (s.centre && s.centre !== "N/A") set.add(s.centre); });
    return ["All Centres", ...Array.from(set).sort()];
  }, [liveCentres, students]);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      const name = searchParams.get('name') || "";
      const phone = searchParams.get('phone') || "";
      const email = searchParams.get('email') || "";
      const parentName = searchParams.get('parentName') || "";
      const centre = searchParams.get('centre') || "";
      const board = searchParams.get('board') || "";
      const standard = searchParams.get('standard') || "";
      const course = searchParams.get('course') || "";
      const address = searchParams.get('address') || "";
      const dateOfBirth = searchParams.get('dateOfBirth') || "";
      const bloodGroup = searchParams.get('bloodGroup') || "";
      const parentOccupation = searchParams.get('parentOccupation') || "";
      const enquiryId = searchParams.get('enquiryId') || "";
      if (enquiryId) setPendingEnquiryId(enquiryId);
      
      setEditItem({
        id: "",
        admissionNo: "",
        name,
        email,
        phone,
        parentName,
        parentEmail: "",
        parentPhone: phone, // Assuming parent phone from enquiry
        academicYear: "",
        board,
        classLevel: standard,
        centre,
        division: "",
        trackId: course,
        address,
        dateOfBirth,
        bloodGroup,
        parentOccupation,
      });
      setShowModal(true);
      // Clean up URL so it doesn't open again on refresh
      router.replace('/students');
    }
  }, [searchParams, router]);

  const filtered = (students || []).filter(s => {
    if (!s) return false;
    const name = s.name || "";
    const admNo = s.admissionNo || "";
    const email = s.email || "";
    const phone = s.phone || "";
    
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || 
                        admNo.toLowerCase().includes(search.toLowerCase()) ||
                        email.toLowerCase().includes(search.toLowerCase()) ||
                        phone.includes(search);
    const matchYear = filterYear === "All Years" || s.academicYear === filterYear;
    const matchBoard = filterBoard === "All Boards" || s.board === filterBoard;
    const matchClass = filterClass === "All Classes" || s.classLevel === filterClass;
    const matchCentre = filterCentre === "All Centres" || s.centre === filterCentre;
    const matchDivision = filterDivision === "All Divisions" || s.division === filterDivision;
    const matchSource =
      filterSource === "All Sources" ||
      (filterSource === "CRM Webhook" && (s.source === "CRM_WEBHOOK" || Boolean(s.externalCrmId))) ||
      (filterSource === "Direct Entry" && s.source !== "CRM_WEBHOOK" && !s.externalCrmId);
    
    return matchSearch && matchYear && matchBoard && matchClass && matchCentre && matchDivision && matchSource;
  });

  return (
    <DashboardLayout title="Students">
      <div className="flex flex-col h-full bg-surface">
        
        {/* Header Section */}
        <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Students Management</h1>
              <p className="text-xs text-text-muted mt-1">Manage student admissions, information, and records</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/crm-admissions"
              className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-sm"
            >
              <Webhook className="h-4 w-4 text-purple-600" /> CRM Admissions
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Student
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="px-6 lg:px-8 py-4 flex items-center gap-2 text-xs font-medium text-text-muted">
          <Link href="/" className="flex items-center gap-1.5 hover:text-text-primary transition-colors">
            <Users className="h-3.5 w-3.5" /> Users
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary">Students</span>
        </div>

        <div className="px-6 lg:px-8 pb-8 space-y-6 flex-1 overflow-y-auto">
          
          {/* Filters Section */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6 text-sm font-bold text-text-primary">
              <Filter className="h-4 w-4 text-brand-blue" /> Filter Students
            </div>
            
            <div className="flex mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Name, Email, Mobile, or Admission Number..."
                  className="w-full h-10 rounded-l-lg border border-r-0 border-border-soft bg-surface-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <button className="h-10 px-6 rounded-r-lg bg-brand-blue-dark text-white text-sm font-semibold hover:bg-brand-blue transition-colors">
                Search
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
              {[
                { label: "Source", state: filterSource, set: setFilterSource, options: ["All Sources", "Direct Entry", "CRM Webhook"] },
                { label: "Academic Year", state: filterYear, set: setFilterYear, options: yearOptions },
                { label: "Board", state: filterBoard, set: setFilterBoard, options: boardOptions },
                { label: "Class", state: filterClass, set: setFilterClass, options: classOptions },
                { label: "Centre", state: filterCentre, set: setFilterCentre, options: centreOptions },
                { label: "Division", state: filterDivision, set: setFilterDivision, options: divisionOptions },
                { label: "Rows", options: ["10", "20", "50"] },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">{f.label}</label>
                  <div className="relative">
                    <select
                      value={f.state}
                      onChange={(e) => f.set && f.set(e.target.value)}
                      className="w-full h-9 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    >
                      {f.options.map((o: string) => <option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-lg bg-gradient-to-r from-brand-blue-dark to-brand-blue px-6 py-2 text-xs font-semibold text-white shadow-sm">
                Apply Filter
              </button>
              <button
                onClick={() => {
                  setSearch("");
                  setFilterYear("All Years");
                  setFilterBoard("All Boards");
                  setFilterClass("All Classes");
                  setFilterCentre("All Centres");
                  setFilterDivision("All Divisions");
                }}
                className="rounded-lg border border-border-soft bg-surface-2 px-6 py-2 text-xs font-semibold text-text-secondary hover:bg-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* List Section */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <BookOpen className="h-4 w-4 text-brand-blue" /> Students List
              </div>
              
              {/* Pagination */}
              <div className="flex items-center gap-1 text-xs font-medium">
                <button className="px-2 py-1 text-text-muted hover:text-text-primary">« Previous</button>
                <button className="h-7 w-7 rounded bg-brand-blue text-white flex items-center justify-center shadow-sm">1</button>
                <button className="h-7 w-7 rounded hover:bg-surface-2 text-text-secondary flex items-center justify-center">2</button>
                <button className="h-7 w-7 rounded hover:bg-surface-2 text-text-secondary flex items-center justify-center">3</button>
                <button className="h-7 w-7 rounded hover:bg-surface-2 text-text-secondary flex items-center justify-center">4</button>
                <button className="h-7 w-7 rounded hover:bg-surface-2 text-text-secondary flex items-center justify-center">5</button>
                <button className="px-2 py-1 text-text-muted hover:text-text-primary">Next »</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-white">
                    <th className="px-6 py-4 text-left">
                      <input type="checkbox" className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20" />
                    </th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">#</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Admission No</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Name</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Email</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Parent Details</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Year & Board</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Class & Div</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Centre</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Reg Date</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-sm text-text-muted">
                        No students match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="px-6 py-4">
                          <input type="checkbox" className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20" />
                        </td>
                        <td className="px-4 py-4 font-semibold text-text-primary">{idx + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-bold text-xs min-w-[28px]">
                              {(s.admissionNo && !s.admissionNo.includes('@') && !/admin/i.test(s.admissionNo))
                                ? s.admissionNo
                                : `ADM-${(s.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`}
                            </span>
                            {(s.source === "CRM_WEBHOOK" || s.externalCrmId) && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"
                                title={`Enrolled via CRM Dispatch (${s.externalCrmId || 'CRM'})`}
                              >
                                CRM
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs shadow-sm">
                              {s.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-text-primary">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-medium text-text-primary">{s.email}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{s.phone}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-bold text-brand-blue">{s.parentName}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{s.parentEmail}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{s.parentPhone}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-bold text-text-primary">{s.academicYear}</p>
                          <span className="inline-flex rounded-md bg-surface-2 border border-border-soft px-2 py-0.5 mt-1 text-[10px] font-bold text-text-secondary">
                            {s.board}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-text-primary">{s.classLevel}</p>
                          <span className="inline-flex rounded-full bg-success/10 border border-success/20 px-2.5 py-1 mt-1 text-[10px] font-bold text-success">
                            {s.trackName || 'Any'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-text-secondary">{s.centre}</td>
                        <td className="px-4 py-4 text-xs font-medium text-text-secondary">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={async () => {
                              const newStatus = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                              await fetchApi(`/students/${s.id}/status`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: newStatus })
                              });
                              setStudents(students.map(st => st.id === s.id ? { ...st, status: newStatus } : st));
                            }}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              s.status === 'ACTIVE' 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {s.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/students/${s.id}/id-card`}
                              className="text-amber-600 hover:text-amber-700 font-semibold text-xs transition-colors mr-2"
                              target="_blank"
                            >
                              ID Card
                            </Link>
                            <button 
                              onClick={() => { setEditItem(s); setShowModal(true); }}
                              className="text-brand-blue hover:text-brand-blue-dark font-semibold text-xs transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm(`Reset password for "${s.name}" to default "password123"?`)) {
                                  try {
                                    await fetchApi(`/students/${s.id}/reset-password`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ password: 'password123' }),
                                    });
                                    alert(`Password for "${s.name}" successfully reset to "password123".\nThe student can now sign in and set their personal password.`);
                                  } catch (err: any) {
                                    alert(err?.message || "Failed to reset password.");
                                  }
                                }
                              }}
                              className="text-amber-600 hover:text-amber-700 font-semibold text-xs transition-colors"
                              title="Reset password to default password123"
                            >
                              Reset Pwd
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm("Are you sure you want to deactivate this student?")) {
                                  await fetchApi(`/students/${s.id}`, { method: 'DELETE' });
                                  setStudents(students.filter(st => st.id !== s.id));
                                }
                              }}
                              className="text-brand-red hover:text-red-700 font-semibold text-xs transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {showModal && (
        <AddStudentModal 
          student={editItem} 
          onClose={() => { setShowModal(false); setEditItem(null); }} 
          onSave={async (savedStudent) => {
            try {
              if (editItem && editItem.id) {
                const updated = await fetchApi<any>(`/students/${savedStudent.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(savedStudent)
                });
                const updatedProfile = updated?.id ? updated : null;
                const updatedUser = updatedProfile?.user;
                const updatedBatch = updatedProfile?.enrollments?.[0]?.batch;
                const updatedTrack = updatedProfile?.enrollments?.[0]?.track;
                const merged: Student = {
                  ...savedStudent,
                  id: updatedProfile?.id || savedStudent.id,
                  admissionNo: updatedProfile?.admissionNo || savedStudent.admissionNo,
                  name: updatedUser ? `${updatedUser.firstName} ${updatedUser.lastName || ''}`.trim() : savedStudent.name,
                  email: updatedUser?.email || savedStudent.email,
                  phone: updatedProfile?.parentPhone || savedStudent.phone,
                  academicYear: updatedBatch?.academicYear?.name || savedStudent.academicYear,
                  board: updatedBatch?.board?.name || savedStudent.board,
                  classLevel: updatedBatch?.standard?.name || savedStudent.classLevel,
                  centre: updatedBatch?.centre?.name || savedStudent.centre,
                  division: updatedBatch?.name || savedStudent.division,
                  trackId: updatedProfile?.enrollments?.[0]?.trackId || savedStudent.trackId,
                  trackName: updatedTrack?.name || savedStudent.trackName,
                  dateOfBirth: updatedProfile?.dateOfBirth || savedStudent.dateOfBirth,
                  bloodGroup: updatedProfile?.bloodGroup || savedStudent.bloodGroup,
                  address: updatedProfile?.address || savedStudent.address,
                  parentOccupation: updatedProfile?.parentOccupation || savedStudent.parentOccupation,
                };
                setStudents(students.map(s => s.id === savedStudent.id ? merged : s));
              } else {
                const created = await fetchApi<any>('/students', {
                  method: 'POST',
                  body: JSON.stringify(savedStudent)
                });
                
                const newProfile = created.profile;
                const newUser = created.user;
                const newBatch = created.batch;
                const newStudentFromDb = {
                  ...savedStudent,
                  id: newProfile.id,
                  admissionNo: newProfile.admissionNo,
                  name: newUser.firstName + " " + (newUser.lastName || ""),
                  email: newUser.email,
                };
                setStudents([newStudentFromDb, ...students]);

                if (pendingEnquiryId) {
                  await fetchApi(`/enquiry/${pendingEnquiryId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'CONVERTED' }),
                  }).catch(() => null);
                  setPendingEnquiryId(null);
                }
              }
              setShowModal(false);
              setEditItem(null);
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Error saving student');
            }
          }}
        />
      )}
    </DashboardLayout>
  );
}

function AddStudentModal({ student, onClose, onSave }: { student: Student | null, onClose: () => void, onSave: (s: Student) => void }) {
  const isEditing = Boolean(student && student.id);
  const [activeTab, setActiveTab] = useState("Admission");
  
  const [admissionNo, setAdmissionNo] = useState(() => {
    const raw = student?.admissionNo || "";
    return raw.includes("@") || /admin/i.test(raw) || /educare/i.test(raw) ? "" : raw;
  });
  const [isCustomAdmissionNo, setIsCustomAdmissionNo] = useState(Boolean(student?.admissionNo));
  const [isGeneratingAdmNo, setIsGeneratingAdmNo] = useState(false);
  const [firstName, setFirstName] = useState(student?.name?.split(" ")[0] || "");
  const [lastName, setLastName] = useState(student?.name?.split(" ").slice(1).join(" ") || "");
  const [email, setEmail] = useState(student?.email || "");
  const [phone, setPhone] = useState(student?.phone || "");
  const [parentName, setParentName] = useState(student?.parentName || "");
  const [parentEmail, setParentEmail] = useState(student?.parentEmail || "");
  const [parentPhone, setParentPhone] = useState(student?.parentPhone || "");
  const [bloodGroup, setBloodGroup] = useState(student?.bloodGroup || "");
  const [dateOfBirth, setDateOfBirth] = useState(student?.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "");
  const [address, setAddress] = useState(student?.address || "");
  const [parentOccupation, setParentOccupation] = useState(student?.parentOccupation || "");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState((student as any)?.gender || "Male");
  const [studentMode, setStudentMode] = useState((student as any)?.studentMode || "Offline");
  const [motherName, setMotherName] = useState((student as any)?.motherName || "");
  const [emergencyPhone, setEmergencyPhone] = useState((student as any)?.emergencyPhone || "");
  const [feePlan, setFeePlan] = useState((student as any)?.feePlan || "Monthly Installments");
  const [admissionFeeStatus, setAdmissionFeeStatus] = useState((student as any)?.admissionFeeStatus || "Pending");
  const [scholarshipPercent, setScholarshipPercent] = useState<number>((student as any)?.scholarshipPercent || 0);
  const [discountRemarks, setDiscountRemarks] = useState((student as any)?.discountRemarks || "");

  // Interactive state for hierarchy
  const [year, setYear] = useState(student?.academicYear || "");
  const [board, setBoard] = useState(student?.board || "");
  const [classLevel, setClassLevel] = useState(student?.classLevel || "");
  const [centre, setCentre] = useState(student?.centre || "");
  const [division, setDivision] = useState(student?.division || "");
  const [targetTrack, setTargetTrack] = useState<string>(student?.trackId || "");

  const [apiYears, setApiYears] = useState<any[]>([]);
  const [apiBoards, setApiBoards] = useState<any[]>([]);
  const [apiCentres, setApiCentres] = useState<any[]>([]);
  const [apiStandards, setApiStandards] = useState<any[]>([]);
  const [apiSubjects, setApiSubjects] = useState<any[]>([]);
  const [apiTracks, setApiTracks] = useState<any[]>([]);
  const [apiBatches, setApiBatches] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(student?.subjectIds || []);

  useEffect(() => {
    fetchApi("/setup/academic-years").then(d => setApiYears(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/boards").then(d => setApiBoards(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/centres").then(d => setApiCentres(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/subjects").then(d => setApiSubjects(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/tracks").then(d => setApiTracks(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/batches").then(d => setApiBatches(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  // Filter batches by selected criteria if available
  const matchingBatches = useMemo(() => {
    return apiBatches.filter(b => {
      const matchCentre = !centre || !b.centre?.name || b.centre.name.toLowerCase() === centre.toLowerCase();
      const matchBoard = !board || !b.board?.name || b.board.name.toLowerCase() === board.toLowerCase();
      const matchClass = !classLevel || !b.standard?.name || b.standard.name.toLowerCase() === classLevel.toLowerCase();
      return matchCentre && matchBoard && matchClass;
    });
  }, [apiBatches, centre, board, classLevel]);

  // Available batch names: exact matches first, then centre/class matches, then all live batches
  const availableBatchNames = useMemo(() => {
    const list = matchingBatches.length > 0
      ? matchingBatches
      : apiBatches.filter(b => (!centre || !b.centre?.name || b.centre.name.toLowerCase() === centre.toLowerCase()) && (!classLevel || !b.standard?.name || b.standard.name.toLowerCase() === classLevel.toLowerCase()));
    const fallbackList = list.length > 0 ? list : apiBatches;
    const names = new Set<string>();
    fallbackList.forEach((b: any) => { if (b.name) names.add(b.name); });
    if (division) names.add(division);
    if (student?.division && student.division !== "N/A") names.add(student.division);
    return Array.from(names);
  }, [matchingBatches, apiBatches, centre, classLevel, division, student]);

  useEffect(() => {
    if (board) {
      const bObj = apiBoards.find(b => b.name === board);
      if (bObj) {
        fetchApi(`/setup/standards?boardId=${bObj.id}`).then(d => setApiStandards(Array.isArray(d) ? d : [])).catch(console.error);
      } else {
        setApiStandards([]);
      }
    } else {
      setApiStandards([]);
    }
  }, [board, apiBoards]);

  // Auto-generate structured admission number based on centre, year, course, class, batch
  useEffect(() => {
    if (!isEditing && !isCustomAdmissionNo) {
      const selectedTrack = apiTracks.find(t => t.id === targetTrack);
      const params = new URLSearchParams({
        centre: centre || '',
        academicYear: year || '',
        classLevel: classLevel || '',
        division: division || '',
        trackId: targetTrack || '',
        trackName: selectedTrack?.name || '',
      });

      setIsGeneratingAdmNo(true);
      fetchApi<{ admissionNo: string }>(`/students/generate-admission-no?${params.toString()}`)
        .then(res => {
          if (res?.admissionNo && !isCustomAdmissionNo) {
            setAdmissionNo(res.admissionNo);
          }
        })
        .catch(() => {})
        .finally(() => setIsGeneratingAdmNo(false));
    }
  }, [centre, year, classLevel, division, targetTrack, apiTracks, isEditing, isCustomAdmissionNo]);

  const TABS = [
    { id: "Admission", icon: User },
    { id: "Basic Information", icon: BookOpen },
    { id: "Parents Login Details", icon: Users },
    { id: "Payments", icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-text-primary">{isEditing ? "Edit Student" : "Add Student"}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted hover:bg-surface-3 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 border-b border-border-soft flex items-center gap-6 overflow-x-auto shrink-0 hide-scrollbar">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 py-4 min-w-max border-b-2 transition-colors ${
                  active ? "border-brand-blue" : "border-transparent hover:border-border-soft"
                }`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shadow-sm ${
                  active ? "bg-brand-blue text-white" : "bg-surface-2 text-text-secondary"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-xs font-bold ${active ? "text-brand-blue" : "text-text-secondary"}`}>
                  {tab.id}
                </span>
              </button>
            )
          })}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          <div className={activeTab === "Admission" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-text-secondary">
                    Admission No
                  </label>
                  {!isCustomAdmissionNo && admissionNo ? (
                    <span className="text-[10px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full">
                      Auto-generated
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAdmissionNo(false);
                        setAdmissionNo("");
                      }}
                      className="text-[11px] font-semibold text-brand-blue hover:underline"
                    >
                      Reset to Auto-generate
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    name="student_admission_number_custom"
                    id="student_admission_number_custom"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    spellCheck={false}
                    value={admissionNo} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('@') || /admin/i.test(val) || /educare/i.test(val)) {
                        setAdmissionNo('');
                      } else {
                        setIsCustomAdmissionNo(true);
                        setAdmissionNo(val);
                      }
                    }} 
                    placeholder={isGeneratingAdmNo ? "Generating admission number..." : "Auto-generated (e.g. KL-26-NEET-11A-001)"} 
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" 
                  />
                  {admissionNo && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomAdmissionNo(false);
                        setAdmissionNo("");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted hover:text-text-primary font-bold px-1.5 py-0.5 rounded bg-surface-3"
                      title="Reset to auto-generate"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  Format: <span className="font-mono text-text-secondary">[CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]-[NUMBER]</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5 flex items-center justify-between">
                  <span>{isEditing ? "Change Password (Optional)" : "Account Password"}</span>
                  {!isEditing && (
                    <span className="text-[11px] text-text-muted font-normal">Default: <span className="font-mono text-brand-blue font-semibold">password123</span></span>
                  )}
                </label>
                <div className="relative">
                  <input 
                    type="password" 
                    name="student_new_account_password"
                    id="student_new_account_password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder={isEditing ? "Leave blank to keep existing password, or enter new password" : "Enter custom password or leave blank for password123"} 
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" 
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  {isEditing
                    ? "Leave blank to keep existing password. If entered, this will reset the student's password and prompt them to change it on next login."
                    : <>Leave blank to automatically assign standard default password (<span className="font-mono text-text-secondary">password123</span>).</>}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Academic Year <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={year} 
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="">---Select---</option>
                    {apiYears.map(y => (
                      <option key={y.id} value={y.name}>{y.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Board / Syllabus <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={board} 
                    onChange={(e) => { setBoard(e.target.value); setClassLevel(""); setDivision(""); }}
                    disabled={!year}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                  >
                    <option value="">---Select---</option>
                    {apiBoards.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Centre <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={centre} 
                    onChange={(e) => { setCentre(e.target.value); setDivision(""); }}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="">---Select---</option>
                    {apiCentres.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Class (Standard) <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={classLevel} 
                    onChange={(e) => { setClassLevel(e.target.value); setDivision(""); }}
                    disabled={!board}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                  >
                    <option value="">---Select---</option>
                    {apiStandards.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Division / Batch <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={division} 
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="">---Select Division / Batch---</option>
                    {availableBatchNames.map((bName: string) => (
                      <option key={bName} value={bName}>{bName}</option>
                    ))}
                    {division && !availableBatchNames.includes(division) && (
                      <option value={division}>{division}</option>
                    )}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 text-[11px] text-text-muted">
                  <span>{availableBatchNames.length} live division(s) found</span>
                  <button
                    type="button"
                    onClick={() => {
                      const custom = prompt("Enter custom Division / Batch name:", division);
                      if (custom && custom.trim()) setDivision(custom.trim());
                    }}
                    className="text-brand-blue font-semibold hover:underline"
                  >
                    + Enter Custom
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Student Mode <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={studentMode}
                    onChange={(e) => setStudentMode(e.target.value)}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Target Track <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select 
                    value={targetTrack} 
                    onChange={(e) => setTargetTrack(e.target.value as any)}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    required
                  >
                    <option value="" disabled>---Select---</option>
                    {apiTracks.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

          <div className={activeTab === "Basic Information" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">First Name <span className="text-brand-red">*</span></label>
                  <input type="text" placeholder="e.g. Rahul" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Last Name</label>
                  <input type="text" placeholder="e.g. Kumar" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Gender</label>
                  <div className="relative">
                    <select 
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Blood Group</label>
                  <div className="relative">
                    <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                      <option value="">--Select--</option>
                      <option value="A+ve">A+ve</option>
                      <option value="A-ve">A-ve</option>
                      <option value="B+ve">B+ve</option>
                      <option value="B-ve">B-ve</option>
                      <option value="AB+ve">AB+ve</option>
                      <option value="AB-ve">AB-ve</option>
                      <option value="O+ve">O+ve</option>
                      <option value="O-ve">O-ve</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Phone Number <span className="text-brand-red">*</span></label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Email Address</label>
                  <input type="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Residential Address</label>
                  <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address..." className="w-full rounded-lg border border-border-soft bg-surface-2 p-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Selected Subjects (Optional)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {apiSubjects.map(sub => (
                      <label key={sub.id} className="flex items-center gap-2 text-sm text-text-primary bg-surface-2 p-2 rounded border border-border-soft cursor-pointer hover:border-brand-blue/30">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(sub.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSubjects([...selectedSubjects, sub.id]);
                            else setSelectedSubjects(selectedSubjects.filter(id => id !== sub.id));
                          }}
                          className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20"
                        />
                        {sub.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={activeTab === "Parents Login Details" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Father's / Guardian's Name <span className="text-brand-red">*</span></label>
                  <input type="text" placeholder="Name" value={parentName} onChange={(e) => setParentName(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Mother's Name</label>
                  <input type="text" placeholder="Name" value={motherName} onChange={(e) => setMotherName(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Parent's Primary Phone (Login ID) <span className="text-brand-red">*</span></label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Parent's Email</label>
                  <input type="email" placeholder="parent@example.com" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Occupation</label>
                  <input type="text" placeholder="e.g. Engineer" value={parentOccupation} onChange={(e) => setParentOccupation(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Emergency Contact Number</label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>
            </div>
          </div>

          <div className={activeTab === "Payments" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <h3 className="text-sm font-bold text-text-primary mb-6">Fee Structure & Discounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Fee Plan</label>
                  <div className="relative">
                    <select 
                      value={feePlan}
                      onChange={(e) => setFeePlan(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="Monthly Installments">Monthly Installments</option>
                      <option value="Annual Plan">Annual Plan</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Admission Fee Status</label>
                  <div className="relative">
                    <select 
                      value={admissionFeeStatus}
                      onChange={(e) => setAdmissionFeeStatus(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid In Full">Paid In Full</option>
                      <option value="Partially Paid">Partially Paid</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Scholarship / Discount (%)</label>
                  <input 
                    type="number" 
                    value={scholarshipPercent} 
                    onChange={(e) => setScholarshipPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    min="0" 
                    max="100" 
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Discount Remarks</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Merit Scholarship" 
                    value={discountRemarks}
                    onChange={(e) => setDiscountRemarks(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" 
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-between shrink-0 bg-white">
          <div>
            {activeTab !== "Admission" && (
              <button 
                onClick={() => {
                  const idx = TABS.findIndex(t => t.id === activeTab);
                  if (idx > 0) setActiveTab(TABS[idx - 1].id);
                }} 
                className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
              >
                Previous
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
              Cancel
            </button>
            <button 
              onClick={() => {
                if (activeTab === "Payments" || isEditing) {
                  // Validate Target Track
                  if (!targetTrack) {
                    alert("Please select a Target Audience (Tuition/Entrance/Both)");
                    return;
                  }

                  // Final save
                  const newStudentData: Student = {
                    id: student?.id || Math.random().toString(36).substr(2, 9),
                    name: `${firstName} ${lastName}`.trim() || "New Student",
                    admissionNo: (admissionNo && !admissionNo.includes('@') && !/admin/i.test(admissionNo) && !/educare/i.test(admissionNo))
                      ? admissionNo.trim()
                      : "",
                    email: email || "student@example.com",
                    phone: phone || "+91 9999999999",
                    parentName: parentName || "Parent",
                    parentEmail: parentEmail || "parent@example.com",
                    parentPhone: parentPhone || "+91 9999999999",
                    academicYear: year || "2025-26",
                    board: board || "CBSE",
                    classLevel: classLevel || "Class 11",
                    division: division || "Division A",
                    centre: centre || "Educare Kalathipady",
                    trackId: targetTrack,
                    password: password || undefined,
                    subjectIds: selectedSubjects,
                    bloodGroup: bloodGroup || undefined,
                    dateOfBirth: dateOfBirth || undefined,
                    address: address || undefined,
                    parentOccupation: parentOccupation || undefined,
                    gender,
                    studentMode,
                    motherName,
                    emergencyPhone,
                    feePlan,
                    admissionFeeStatus,
                    scholarshipPercent,
                    discountRemarks,
                  } as any;
                  onSave(newStudentData);
                } else {
                  // Go to next tab
                  const idx = TABS.findIndex(t => t.id === activeTab);
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition-colors"
            >
              {activeTab === "Payments" || isEditing ? (
                "Save Student"
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
