"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { UserCheck, Plus, Search, Filter, X, User, ChevronRight, BookOpen, ChevronDown, Users, Shield, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface Staff {
  id: string;
  empId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  centre: string;
  status: "Active" | "Inactive";
  assignments?: {
    id: string;
    academicYear: string;
    board: string;
    classLevel: string;
    centre: string;
    division: string;
    subject: string;
  }[];
  password?: string;
  createdAt?: string;
}

export function StaffClient({ initialStaffList }: { initialStaffList: Staff[] }) {
  const { role } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>(initialStaffList);
  const [search, setSearch] = useState("");
  const [filterCentre, setFilterCentre] = useState("All Centres");
  const [filterRole, setFilterRole] = useState("All Roles");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [filterBoard, setFilterBoard] = useState("All Boards");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Staff | null>(null);
  const filtered = staffList.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                        s.empId.toLowerCase().includes(search.toLowerCase()) ||
                        s.email.toLowerCase().includes(search.toLowerCase()) ||
                        s.phone.includes(search);
    const matchCentre = filterCentre === "All Centres" || s.centre === filterCentre;
    const matchRole = filterRole === "All Roles" || s.role === filterRole;
    const matchStatus = filterStatus === "All Status" || s.status === filterStatus;
    const matchBoard = filterBoard === "All Boards" || 
      (s.assignments && s.assignments.some(a => a.board === filterBoard));
    return matchSearch && matchCentre && matchRole && matchStatus && matchBoard;
  });

  if (role === 'TEACHER' || role === 'STUDENT') {
    return (
      <DashboardLayout title="Staff Management">
        <div className="flex h-[60vh] items-center justify-center flex-col text-center">
          <ShieldCheck className="h-16 w-16 text-brand-red/50 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">You do not have permission to view the staff area. This section is restricted to administrators.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Staff Management">
      <div className="flex flex-col h-full bg-surface">
        
        {/* Header Section */}
        <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">Staff Management</h1>
              <p className="text-xs text-text-muted mt-1">Manage teachers, coordinators, and administrative staff</p>
            </div>
          </div>
          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-6 lg:px-8 py-4 flex items-center gap-2 text-xs font-medium text-text-muted">
          <Link href="/" className="flex items-center gap-1.5 hover:text-text-primary transition-colors">
            <Users className="h-3.5 w-3.5" /> Users
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary">Staff</span>
        </div>

        <div className="px-6 lg:px-8 pb-8 space-y-6 flex-1 overflow-y-auto">
          
          {/* Filters Section */}
          <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6 text-sm font-bold text-text-primary">
              <Filter className="h-4 w-4 text-brand-blue" /> Filter Staff
            </div>
            
            <div className="flex mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by Name, Email, Mobile, or Employee ID..."
                  className="w-full h-10 rounded-l-lg border border-r-0 border-border-soft bg-surface-2 pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
              </div>
              <button className="h-10 px-6 rounded-r-lg bg-brand-blue-dark text-white text-sm font-semibold hover:bg-brand-blue transition-colors">
                Search
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Centre", state: filterCentre, set: setFilterCentre, options: ["All Centres", "Neyyattinkara", "Manacaud"] },
                { label: "Role", state: filterRole, set: setFilterRole, options: ["All Roles", "Teacher", "Coordinator", "Admin"] },
                { label: "Board", state: filterBoard, set: setFilterBoard, options: ["All Boards", "State", "CBSE", "ICSE", "ISC", "None"] },
                { label: "Status", state: filterStatus, set: setFilterStatus, options: ["All Status", "Active", "Inactive"] },
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
                  setFilterCentre("All Centres");
                  setFilterRole("All Roles");
                  setFilterStatus("All Status");
                  setFilterBoard("All Boards");
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
                <BookOpen className="h-4 w-4 text-brand-blue" /> Staff List
              </div>
              
              {/* Pagination */}
              <div className="flex items-center gap-1 text-xs font-medium">
                <button className="px-2 py-1 text-text-muted hover:text-text-primary">« Previous</button>
                <button className="h-7 w-7 rounded bg-brand-blue text-white flex items-center justify-center shadow-sm">1</button>
                <button className="h-7 w-7 rounded hover:bg-surface-2 text-text-secondary flex items-center justify-center">2</button>
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
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Employee ID</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Name</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Role</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Assignments</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Centre</th>
                    <th className="px-4 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Reg Date</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-sm text-text-muted">
                        No staff match your filters.
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
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-brand-blue/10 text-brand-blue font-bold text-xs">
                            {s.empId}
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
                          <span className="text-xs font-bold text-brand-blue">{s.role}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {s.assignments && s.assignments.length > 0 ? (
                              s.assignments.map(a => (
                                <span key={a.id} className="inline-flex rounded-md bg-surface-2 border border-border-soft px-2 py-0.5 text-[10px] font-bold text-text-secondary w-max">
                                  {a.classLevel} - {a.subject} ({a.board})
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-text-muted">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs font-medium text-text-secondary">{s.centre}</td>
                        <td className="px-4 py-4 text-xs font-medium text-text-secondary">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            s.status === "Active" ? "bg-success/10 border-success/20 text-success" : "bg-surface-2 border-border-soft text-text-muted"
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                            <button 
                              onClick={() => { setEditItem(s); setShowModal(true); }}
                              className="text-brand-blue hover:text-brand-blue-dark font-semibold text-xs transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm("Are you sure you want to deactivate this staff member?")) {
                                  await fetchApi(`/staff/${s.id}`, { method: 'DELETE' });
                                  setStaffList(staffList.filter(st => st.id !== s.id));
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

      {/* Add/Edit Staff Modal */}
      {showModal && (
        <AddStaffModal 
          staff={editItem} 
          onClose={() => { setShowModal(false); setEditItem(null); }} 
                    onSave={async (savedStaff) => {
            try {
              if (editItem) {
                const updated = await fetchApi<any>(`/staff/${savedStaff.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(savedStaff)
                });
                setStaffList(staffList.map(s => s.id === savedStaff.id ? savedStaff : s));
              } else {
                const created = await fetchApi<any>('/staff', {
                  method: 'POST',
                  body: JSON.stringify(savedStaff)
                });
                setStaffList([savedStaff, ...staffList]);
              }
              setShowModal(false);
              setEditItem(null);
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Error saving staff');
            }
          }}
        />
      )}
    </DashboardLayout>
  );
}

function AddStaffModal({ staff, onClose, onSave }: { staff: Staff | null, onClose: () => void, onSave: (s: Staff) => void }) {
  const [activeTab, setActiveTab] = useState("Basic Information");
  const [formData, setFormData] = useState<any>({
    empId: staff?.empId || "",
    name: staff?.name || "",
    email: staff?.email || "",
    phone: staff?.phone || "",
    role: staff?.role || "Teacher",
    centre: staff?.centre || "Educare Kalathipady",
    status: staff?.status || "Active",
    assignments: staff?.assignments || [],
    password: ""
  });

  const [newAssignment, setNewAssignment] = useState({ academicYear: "2025-26", board: "CBSE", classLevel: "Class 11", division: "Division A", subject: "" });
  const [showAddAssignment, setShowAddAssignment] = useState(false);

  const TABS = [
    { id: "Basic Information", icon: User },
    { id: "Teaching Assignments", icon: BookOpen },
    { id: "Login Details", icon: Users },
    { id: "Roles & Permissions", icon: Shield },
    { id: "Documents", icon: FileText },
  ];

  const handleAddAssignment = () => {
    if (newAssignment.subject) {
      setFormData({
        ...formData,
        assignments: [...formData.assignments, { id: Math.random().toString(), ...newAssignment }]
      });
      setShowAddAssignment(false);
      setNewAssignment({ academicYear: "2025-26", board: "CBSE", classLevel: "Class 11", division: "Division A", subject: "" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-bold text-text-primary">{staff ? "Edit Staff" : "Add Staff"}</h2>
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
          {activeTab === "Basic Information" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Employee ID <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <input type="text" value={formData.empId} onChange={(e) => setFormData({...formData, empId: e.target.value})} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Full Name <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Rahul Kumar" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Centre <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select value={formData.centre} onChange={(e) => setFormData({...formData, centre: e.target.value})} className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm text-text-muted focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                    <option value="">---Select---</option>
                    <option value="Educare Kalathipady">Educare Kalathipady</option>
                    <option value="Educare North Wing">Educare North Wing</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                    <ChevronDown className="h-3 w-3 text-text-muted rotate-180 -mb-1" />
                    <ChevronDown className="h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1.5">
                  Role Type <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full h-10 appearance-none rounded-lg border border-border-soft bg-surface-2 pl-3 pr-8 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                    <option value="Teacher">Teacher</option>
                    <option value="Coordinator">Coordinator</option>
                    <option value="Admin">Admin</option>
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

          {activeTab === "Teaching Assignments" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Assigned Classes</h3>
                  <p className="text-xs text-text-muted mt-1">Assign subjects and batches to this teacher.</p>
                </div>
                <button onClick={() => setShowAddAssignment(!showAddAssignment)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-brand-blue/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Assignment
                </button>
              </div>

              {showAddAssignment && (
                <div className="mb-6 bg-surface-2 p-4 rounded-lg border border-border-soft">
                  <div className="grid grid-cols-5 gap-4">
                     <select value={newAssignment.academicYear} onChange={e => setNewAssignment({...newAssignment, academicYear: e.target.value})} className="h-10 rounded-lg text-sm px-3">
                       <option>2025-26</option>
                       <option>2026-27</option>
                     </select>
                     <select value={newAssignment.board} onChange={e => setNewAssignment({...newAssignment, board: e.target.value})} className="h-10 rounded-lg text-sm px-3">
                       <option>CBSE</option>
                       <option>State</option>
                     </select>
                     <select value={newAssignment.classLevel} onChange={e => setNewAssignment({...newAssignment, classLevel: e.target.value})} className="h-10 rounded-lg text-sm px-3">
                       <option>Class 11</option>
                       <option>Class 12</option>
                     </select>
                     <input type="text" placeholder="Subject" value={newAssignment.subject} onChange={e => setNewAssignment({...newAssignment, subject: e.target.value})} className="h-10 rounded-lg text-sm px-3 border border-border-soft" />
                     <button onClick={handleAddAssignment} className="h-10 bg-brand-blue text-white rounded-lg text-sm font-bold">Add</button>
                  </div>
                </div>
              )}

              {formData.assignments.length > 0 ? (
                <div className="border border-border-soft rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-2/50 border-b border-border-soft">
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-text-secondary uppercase">Academic Year</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-text-secondary uppercase">Board</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-text-secondary uppercase">Class & Div</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-text-secondary uppercase">Subject</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {formData.assignments.map((a: any) => (
                        <tr key={a.id}>
                          <td className="px-4 py-3 font-medium">{a.academicYear}</td>
                          <td className="px-4 py-3 text-xs">{a.board}</td>
                          <td className="px-4 py-3 text-xs">{a.classLevel} - {a.division}</td>
                          <td className="px-4 py-3 font-bold text-brand-blue">{a.subject}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setFormData({...formData, assignments: formData.assignments.filter((x: any) => x.id !== a.id)})} className="text-text-muted hover:text-brand-red">
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center bg-surface-2/30 rounded-lg border border-dashed border-border-soft">
                  <BookOpen className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-text-secondary">No assignments added yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "Login Details" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Account Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1.5">Account Password <span className="text-brand-red">*</span></label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Enter password for staff" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "Roles & Permissions" && (
            <div className="bg-white rounded-xl border border-border-soft p-6">
              <h3 className="text-sm font-bold text-text-primary mb-4">Permissions (Read-Only Preview)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2"><input type="checkbox" checked readOnly className="rounded border-border-soft text-brand-blue" /><span className="text-sm text-text-secondary">Manage Students</span></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked readOnly className="rounded border-border-soft text-brand-blue" /><span className="text-sm text-text-secondary">Manage Attendance</span></div>
                <div className="flex items-center gap-2"><input type="checkbox" readOnly className="rounded border-border-soft text-brand-blue" /><span className="text-sm text-text-secondary">Manage Staff</span></div>
                <div className="flex items-center gap-2"><input type="checkbox" readOnly className="rounded border-border-soft text-brand-blue" /><span className="text-sm text-text-secondary">System Settings</span></div>
              </div>
            </div>
          )}

          {activeTab === "Documents" && (
            <div className="bg-white rounded-xl border border-border-soft p-6 text-center">
              <div className="py-12 bg-surface-2/30 rounded-lg border border-dashed border-border-soft">
                <FileText className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-text-secondary">Drag and drop documents here</p>
                <p className="text-xs text-text-muted mt-1">Supports PDF, JPG, PNG (Max 5MB)</p>
                <button className="mt-4 text-xs font-bold text-brand-blue px-4 py-2 bg-brand-blue/10 rounded-lg">Browse Files</button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border-soft flex items-center justify-between shrink-0 bg-white">
          <div>
            {activeTab !== "Basic Information" && (
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
                if (activeTab === "Documents" || staff) {
                  // Final save
                  const newStaffData: any = {
                    id: staff?.id || Math.random().toString(36).substr(2, 9),
                    empId: formData.empId || undefined,
                    name: formData.name || undefined,
                    email: formData.email || undefined,
                    phone: formData.phone || undefined,
                    role: formData.role || "Teacher",
                    centre: formData.centre || "Educare Kalathipady",
                    status: formData.status as "Active" | "Inactive",
                    assignments: formData.assignments,
                    password: formData.password || undefined
                  };
                  onSave(newStaffData);
                } else {
                  // Go to next tab
                  const idx = TABS.findIndex(t => t.id === activeTab);
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition-colors"
            >
              {activeTab === "Documents" || staff ? (
                "Save Staff"
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
