"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import { Users, Plus, Search, Filter, MoreVertical, X, User, ChevronRight, CheckCircle2, ChevronLeft, Building, BookOpen, GraduationCap, CreditCard, ChevronDown } from "lucide-react";
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
  track?: "TUITION" | "ENTRANCE" | "BOTH";
  password?: string;
  subjectIds?: string[];
  bloodGroup?: string;
  dateOfBirth?: string;
  address?: string;
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
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Student | null>(null);

  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      const name = searchParams.get('name') || "";
      const phone = searchParams.get('phone') || "";
      const email = searchParams.get('email') || "";
      const parentName = searchParams.get('parentName') || "";
      const board = searchParams.get('board') || "";
      const standard = searchParams.get('standard') || "";
      
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
        centre: "",
        division: "",
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
    
    return matchSearch && matchYear && matchBoard && matchClass && matchCentre && matchDivision;
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
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Student
          </button>
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

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              {[
                { label: "Academic Year", state: filterYear, set: setFilterYear, options: ["All Years", "2025-26", "2026-27"] },
                { label: "Board", state: filterBoard, set: setFilterBoard, options: ["All Boards", "State", "CBSE", "ICSE", "ISC"] },
                { label: "Class", state: filterClass, set: setFilterClass, options: ["All Classes", "Class 11", "Class 12 (A)"] },
                { label: "Centre", state: filterCentre, set: setFilterCentre, options: ["All Centres", "Neyyattinkara", "Manacaud"] },
                { label: "Division", state: filterDivision, set: setFilterDivision, options: ["All Divisions", "Division A", "Division B"] },
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
                      {f.options.map(o => <option key={o}>{o}</option>)}
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
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-bold text-xs min-w-[28px]">
                            {s.admissionNo}
                          </span>
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
                            {s.division}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-text-secondary">{s.centre}</td>
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
              if (editItem) {
                const updated = await fetchApi<any>(`/students/${savedStudent.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(savedStudent)
                });
                setStudents(students.map(s => s.id === savedStudent.id ? savedStudent : s));
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
  const [activeTab, setActiveTab] = useState("Admission");
  
  const [admissionNo, setAdmissionNo] = useState(student?.admissionNo || "");
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
  const [password, setPassword] = useState("");

  // Interactive state for hierarchy
  const [year, setYear] = useState(student?.academicYear || "");
  const [board, setBoard] = useState(student?.board || "");
  const [classLevel, setClassLevel] = useState(student?.classLevel || "");
  const [centre, setCentre] = useState(student?.centre || "");
  const [division, setDivision] = useState(student?.division || "");
  const [targetTrack, setTargetTrack] = useState<"TUITION" | "ENTRANCE" | "BOTH" | "">(student?.track || "");

  const [apiYears, setApiYears] = useState<any[]>([]);
  const [apiBoards, setApiBoards] = useState<any[]>([]);
  const [apiCentres, setApiCentres] = useState<any[]>([]);
  const [apiStandards, setApiStandards] = useState<any[]>([]);
  const [apiSubjects, setApiSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(student?.subjectIds || []);

  useEffect(() => {
    fetchApi("/setup/academic-years").then(d => setApiYears(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/boards").then(d => setApiBoards(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/centres").then(d => setApiCentres(Array.isArray(d) ? d : [])).catch(console.error);
    fetchApi("/setup/subjects").then(d => setApiSubjects(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

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
          <h2 className="text-base font-bold text-text-primary">{student ? "Edit Student" : "Add Student"}</h2>
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
          {activeTab === "Admission" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Admission No <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <input type="text" value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="Auto-generated if left blank" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Account Password <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password for student" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
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
                    disabled={!classLevel || !centre}
                    className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                  >
                    <option value="">---Select---</option>
                    {classLevel && centre && (
                      <>
                        <option value="Division A">Division A ({classLevel} - {board})</option>
                        <option value="Division B">Division B ({classLevel} - {board})</option>
                        <option value="Morning Batch">Morning Batch ({classLevel} - {board})</option>
                      </>
                    )}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Student Mode <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                    <option>Offline</option>
                    <option>Online</option>
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
                    <option value="BOTH">Both (Tuition & Entrance)</option>
                    <option value="TUITION">Tuition Only</option>
                    <option value="ENTRANCE">Entrance Only</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>



            </div>
          </div>
          )}

          {activeTab === "Basic Information" && (
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
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Date of Birth</label>
                  <input type="date" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Gender</label>
                  <div className="relative">
                    <select className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
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
          )}

          {activeTab === "Parents Login Details" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Father's / Guardian's Name <span className="text-brand-red">*</span></label>
                  <input type="text" placeholder="Name" value={parentName} onChange={(e) => setParentName(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Mother's Name</label>
                  <input type="text" placeholder="Name" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
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
                  <input type="text" placeholder="e.g. Engineer" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Emergency Contact Number</label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "Payments" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <h3 className="text-sm font-bold text-text-primary mb-6">Fee Structure & Discounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Fee Plan</label>
                  <div className="relative">
                    <select className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                      <option>Monthly Installments</option>
                      <option>Annual Plan</option>
                      <option>Quarterly</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Admission Fee Status</label>
                  <div className="relative">
                    <select className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                      <option>Pending</option>
                      <option>Paid In Full</option>
                      <option>Partially Paid</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Scholarship / Discount (%)</label>
                  <input type="number" defaultValue="0" min="0" max="100" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Discount Remarks</label>
                  <input type="text" placeholder="e.g. Merit Scholarship" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>
            </div>
          )}

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
                if (activeTab === "Payments" || student) {
                  // Validate Target Track
                  if (!targetTrack) {
                    alert("Please select a Target Audience (Tuition/Entrance/Both)");
                    return;
                  }

                  // Final save
                  const newStudentData: Student = {
                    id: student?.id || Math.random().toString(36).substr(2, 9),
                    name: `${firstName} ${lastName}`.trim() || "New Student",
                    admissionNo: admissionNo || "",
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
                    track: targetTrack,
                    password: password || undefined,
                    subjectIds: selectedSubjects,
                    bloodGroup: bloodGroup || undefined,
                    dateOfBirth: dateOfBirth || undefined,
                    address: address || undefined,
                  };
                  onSave(newStudentData);
                } else {
                  // Go to next tab
                  const idx = TABS.findIndex(t => t.id === activeTab);
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition-colors"
            >
              {activeTab === "Payments" || student ? (
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
