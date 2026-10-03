"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { 
  Building2, 
  ShieldCheck, 
  GraduationCap, 
  CreditCard, 
  MessageSquare, 
  FileText,
  Save,
  Plus,
  Trash2,
  Upload,
  Edit2,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Folder,
  Book,
  FileBox,
  Layers,
  AlertTriangle
} from "lucide-react";

const DeleteWarningModal = ({ isOpen, onClose, message }: { isOpen: boolean, onClose: () => void, message: string }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-rose-400 to-orange-400" />
        
        <div className="flex items-start gap-5 mt-2">
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-100 shadow-inner">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          
          <div className="flex-1 pt-1">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Cannot Delete Item</h3>
            <div className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
              {message}
            </div>
            
            <div className="mt-7 flex justify-end">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-slate-900/20 w-full sm:w-auto active:scale-95"
              >
                Understood, I'll remove them first
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SetupPage() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState("Centre Setup");
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  if (role === 'TEACHER' || role === 'STUDENT') {
    return (
      <DashboardLayout title="Setup">
        <div className="flex h-[60vh] items-center justify-center flex-col text-center">
          <ShieldCheck className="h-16 w-16 text-brand-red/50 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">You do not have permission to view the setup area. This section is restricted to administrators.</p>
        </div>
      </DashboardLayout>
    );
  }

  const TABS = [
    { id: "Centre Setup", icon: Building2 },
    { id: "Roles & Permissions", icon: ShieldCheck },
    { id: "Academic Structure", icon: GraduationCap },
    { id: "Curriculum Builder", icon: BookOpen },
    { id: "Fee Structure", icon: CreditCard },
    { id: "SMS Templates", icon: MessageSquare },
    { id: "Exam Configuration", icon: FileText },
  ];

  return (
    <DashboardLayout title="System Setup">
      <div className="flex h-full bg-surface">
        
        {/* Left Nav (Tabs) */}
        <div className="w-64 bg-white border-r border-border-soft flex flex-col hidden md:flex shrink-0">
          <div className="p-6 border-b border-border-soft">
            <h2 className="text-sm font-bold text-text-primary">System Setup</h2>
            <p className="text-xs text-text-muted mt-1">Manage global configurations</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    active 
                      ? "bg-brand-blue/10 text-brand-blue" 
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-brand-blue" : "text-text-muted"}`} />
                  {tab.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="bg-white border-b border-border-soft px-6 lg:px-8 py-4 flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-base font-bold text-text-primary">{activeTab}</h1>
              <p className="text-xs text-text-muted mt-0.5">Configure your system preferences</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors">
              <Save className="h-3.5 w-3.5" /> Save Changes
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-4xl mx-auto md:mx-0">
              {activeTab === "Centre Setup" && <CentreSetupTab onError={setDeleteWarning} />}
              {activeTab === "Roles & Permissions" && <RolesPermissionsTab />}
              {activeTab === "Academic Structure" && <AcademicStructureTab onError={setDeleteWarning} />}
              {activeTab === "Curriculum Builder" && <CurriculumBuilderTab onError={setDeleteWarning} />}
              {activeTab === "Fee Structure" && <FeeStructureTab />}
              {activeTab === "SMS Templates" && <SmsTemplatesTab />}
              {activeTab === "Exam Configuration" && <ExamConfigTab />}
            </div>
          </div>
        </div>
      </div>

      <DeleteWarningModal 
        isOpen={!!deleteWarning} 
        onClose={() => setDeleteWarning(null)} 
        message={deleteWarning || ""} 
      />
    </DashboardLayout>
  );
}

function CentreSetupTab({ onError }: { onError: (msg: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "", code: "", type: "MAIN", address: ""
  });

  useEffect(() => {
    fetchApi<any[]>('/setup/centres')
      .then(data => { setCentres(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  const handleSave = async () => {
    try {
      if (editingId) {
        const updated = await fetchApi<any>(`/setup/centres/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        setCentres(centres.map(c => c.id === editingId ? updated : c));
      } else {
        const created = await fetchApi<any>('/setup/centres', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        setCentres([...centres, created]);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: "", code: "", type: "MAIN", address: "" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCentre = async (id: string) => {
    if (!confirm("Are you sure? This will delete the centre and might affect users assigned to it.")) return;
    try {
      await fetchApi(`/setup/centres/${id}`, { method: 'DELETE' });
      setCentres(centres.filter(c => c.id !== id));
    } catch (e: any) {
      console.error(e);
      onError(e.message || "Failed to delete centre. It might be in use.");
    }
  };

  if (isAdding) {
    return (
      <div className="bg-white rounded-xl border border-border-soft p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-text-primary">{editingId ? "Edit Centre" : "Add New Centre"}</h3>
          <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-xs font-semibold text-text-secondary hover:text-text-primary">Cancel</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Centre Name *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Educare South Wing" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Centre Code</label>
            <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. EDU-SW" className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Address</label>
            <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full address" className="w-full rounded-lg border border-border-soft bg-surface-2 p-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 resize-none" />
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-border-soft">
          <button onClick={handleSave} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors">
            Save Centre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Centres & Branches</h3>
          <p className="text-xs text-text-muted mt-1">Manage multiple learning centres within your institution.</p>
        </div>
        <button onClick={() => { setFormData({ name: "", code: "", type: "MAIN", address: "" }); setEditingId(null); setIsAdding(true); }} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add New Centre
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white border-b border-border-soft">
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Centre Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {loading ? <tr><td colSpan={4} className="p-6 text-center text-text-muted">Loading...</td></tr> : 
             centres.map(c => (
              <tr key={c.id} className="hover:bg-surface-2/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-brand-blue/10 flex items-center justify-center font-bold text-brand-blue text-xs">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-text-primary text-sm flex items-center gap-2">
                        {c.name}
                        {c.type === "MAIN" && <span className="inline-flex rounded-full bg-brand-red/10 px-2 py-0.5 text-[9px] font-bold text-brand-red uppercase">Main</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-text-secondary font-mono">{c.code}</td>
                <td className="px-6 py-4 text-text-secondary">{c.type}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => {
                        setEditingId(c.id);
                        setFormData({ name: c.name, code: c.code, type: c.type, address: c.address || "" });
                        setIsAdding(true);
                      }}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-surface-3 text-text-muted transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteCentre(c.id)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 text-danger transition-colors" title="Delete Centre">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolesPermissionsTab() {
  const roles = ["Super Admin", "Teacher", "Coordinator", "Receptionist"];
  const modules = [
    "Student Management",
    "Staff Management",
    "Fee Collection",
    "Academics (Exams/Classes)",
    "Reports & Analytics",
    "System Settings"
  ];

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Roles & Permissions Matrix</h3>
          <p className="text-xs text-text-muted mt-1">Control access to different modules based on staff roles.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text-primary border border-border-soft shadow-sm hover:bg-white transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Role
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white border-b border-border-soft">
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary">Modules</th>
              {roles.map(role => (
                <th key={role} className="px-4 py-4 text-center text-xs font-bold text-text-secondary">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {modules.map(module => (
              <tr key={module} className="hover:bg-surface-2/30">
                <td className="px-6 py-4 font-semibold text-text-primary text-xs">{module}</td>
                {roles.map(role => {
                  const isChecked = role === "Super Admin" || 
                    (role === "Teacher" && (module.includes("Student") || module.includes("Academics"))) ||
                    (role === "Receptionist" && (module.includes("Student") || module.includes("Fee")));
                  return (
                    <td key={role} className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        defaultChecked={isChecked}
                        disabled={role === "Super Admin"}
                        className="rounded border-border-soft text-brand-blue focus:ring-brand-blue/20 disabled:opacity-50"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AcademicStructureTab({ onError }: { onError: (msg: string) => void }) {
  const [activeTab, setActiveTab] = useState("Years");
  const [years, setYears] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "" });
  const [boardForm, setBoardForm] = useState({ name: "", code: "" });
  const [standardForm, setStandardForm] = useState({ name: "", code: "", level: 1, boardId: "" });
  const [standardFilterBoard, setStandardFilterBoard] = useState("");
  const [subjectForm, setSubjectForm] = useState({ name: "", boardId: "", standardId: "" });
  const [subjectSort, setSubjectSort] = useState("board");
  const [filterBoard, setFilterBoard] = useState("");
  const [filterStandard, setFilterStandard] = useState("");

  const filteredStandards = standards.filter(s => !standardFilterBoard || s.boardId === standardFilterBoard);

  const sortedSyllabi = [...syllabi]
    .filter(s => {
      if (filterBoard && s.boardId !== filterBoard) return false;
      if (filterStandard && s.standardId !== filterStandard) return false;
      return true;
    })
    .sort((a, b) => {
      if (subjectSort === 'board') return (a.board?.name || "").localeCompare(b.board?.name || "");
      if (subjectSort === 'class') return (a.standard?.level || 0) - (b.standard?.level || 0) || (a.standard?.name || "").localeCompare(b.standard?.name || "");
      if (subjectSort === 'subject') return (a.subject?.name || "").localeCompare(b.subject?.name || "");
      return 0;
    });

  useEffect(() => {
    fetchApi<any[]>('/setup/academic-years').then(data => setYears(data));
    fetchApi<any[]>('/setup/boards').then(data => setBoards(data));
    fetchApi<any[]>('/setup/standards').then(data => setStandards(data));
    fetchApi<any[]>('/setup/subjects').then(data => setSubjects(data));
    fetchApi<any[]>('/setup/syllabi').then(data => setSyllabi(data));
  }, []);

  const addYear = async () => {
    if (!yearForm.name) return;
    const res = await fetchApi<any>('/setup/academic-years', { method: 'POST', body: JSON.stringify(yearForm) });
    setYears([...years, res]);
    setYearForm({ name: "", startDate: "", endDate: "" });
  };
  
  const addBoard = async () => {
    if (!boardForm.name) return;
    const res = await fetchApi<any>('/setup/boards', { method: 'POST', body: JSON.stringify(boardForm) });
    setBoards([...boards, res]);
    setBoardForm({ name: "", code: "" });
  };

  const addStandard = async () => {
    if (!standardForm.name || !standardForm.boardId) return;
    const res = await fetchApi<any>('/setup/standards', { method: 'POST', body: JSON.stringify(standardForm) });
    setStandards([...standards, res]);
    setStandardForm({ name: "", code: "", level: 1, boardId: standardForm.boardId });
  };

  const addSubject = async () => {
    if (!subjectForm.name || !subjectForm.boardId || !subjectForm.standardId) return;
    await fetchApi<any>('/setup/subjects', { method: 'POST', body: JSON.stringify(subjectForm) });
    
    // Refresh both subjects and syllabi to show the new mappings
    const [subRes, sylRes] = await Promise.all([
      fetchApi<any[]>('/setup/subjects'),
      fetchApi<any[]>('/setup/syllabi')
    ]);
    setSubjects(subRes);
    setSyllabi(sylRes);
    setSubjectForm({...subjectForm, name: ""});
  };

  const deleteBoard = async (id: string) => {
    if (!confirm("Are you sure? This will delete all classes, subjects, and data associated with this board.")) return;
    try {
      await fetchApi(`/setup/boards/${id}`, { method: 'DELETE' });
      setBoards(boards.filter(b => b.id !== id));
      setStandards(standards.filter(s => s.boardId !== id));
      setSyllabi(syllabi.filter(s => s.boardId !== id));
    } catch (e: any) {
      onError(e.message || "Failed to delete board.");
    }
  };

  const deleteStandard = async (id: string) => {
    if (!confirm("Are you sure? This will delete all subjects and data associated with this class.")) return;
    try {
      await fetchApi(`/setup/standards/${id}`, { method: 'DELETE' });
      setStandards(standards.filter(s => s.id !== id));
      setSyllabi(syllabi.filter(s => s.standardId !== id));
    } catch (e: any) {
      onError(e.message || "Failed to delete class.");
    }
  };

  const deleteSyllabus = async (id: string) => {
    if (!confirm("Are you sure? This will remove the subject from this class.")) return;
    try {
      await fetchApi(`/setup/syllabi/${id}`, { method: 'DELETE' });
      setSyllabi(syllabi.filter(s => s.id !== id));
    } catch (e: any) {
      onError(e.message || "Failed to remove subject.");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Academic Structure</h3>
          <p className="text-xs text-text-muted mt-1">Configure boards, classes, and subjects.</p>
        </div>
      </div>
      <div className="border-b border-border-soft px-6 flex items-center gap-6">
        {["Years", "Boards", "Classes", "Subjects"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === tab ? "border-brand-blue text-brand-blue" : "border-transparent text-text-secondary hover:text-text-primary"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="p-6">
        {activeTab === "Years" && (
          <div>
            <div className="flex gap-4 mb-6">
              <input type="text" placeholder="e.g. 2026-2027" value={yearForm.name} onChange={e => setYearForm({...yearForm, name: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm flex-1" />
              <input type="date" value={yearForm.startDate} onChange={e => setYearForm({...yearForm, startDate: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm" />
              <input type="date" value={yearForm.endDate} onChange={e => setYearForm({...yearForm, endDate: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm" />
              <button onClick={addYear} className="h-10 bg-brand-blue text-white px-4 rounded-lg text-sm font-bold">Add Year</button>
            </div>
            <div className="space-y-3">
              {years.map(y => (
                <div key={y.id} className="p-4 rounded-lg border border-border-soft bg-surface-2 flex items-center justify-between">
                  <span className="font-bold text-sm">{y.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === "Boards" && (
          <div>
            <div className="flex gap-4 mb-6">
              <input type="text" placeholder="Board Name (e.g. CBSE)" value={boardForm.name} onChange={e => setBoardForm({...boardForm, name: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm flex-1" />
              <input type="text" placeholder="Code (e.g. CBSE)" value={boardForm.code} onChange={e => setBoardForm({...boardForm, code: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm w-48" />
              <button onClick={addBoard} className="h-10 bg-brand-blue text-white px-4 rounded-lg text-sm font-bold">Add Board</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {boards.map(b => (
                <div key={b.id} className="p-4 rounded-lg border border-border-soft bg-surface-2 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{b.name}</span>
                    <span className="text-xs text-text-muted mt-1">{b.code}</span>
                  </div>
                  <button onClick={() => deleteBoard(b.id)} className="p-2 text-danger hover:bg-danger/10 rounded transition-colors" title="Delete Board">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Classes" && (
          <div>
            <div className="bg-surface-2/50 p-4 rounded-xl border border-border-soft mb-6">
              <h4 className="text-xs font-bold text-text-primary mb-3">Add New Class</h4>
              <div className="flex gap-4">
                <select value={standardForm.boardId} onChange={e => setStandardForm({...standardForm, boardId: e.target.value})} className="h-10 rounded-lg border border-border-soft bg-white px-3 text-sm w-48 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                  <option value="" disabled>Select Board</option>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input type="text" placeholder="Class Name (e.g. Class 11)" value={standardForm.name} onChange={e => setStandardForm({...standardForm, name: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm flex-1 focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                <input type="text" placeholder="Code (e.g. 11)" value={standardForm.code} onChange={e => setStandardForm({...standardForm, code: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm w-32 focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                <input type="number" placeholder="Level" value={standardForm.level} onChange={e => setStandardForm({...standardForm, level: parseInt(e.target.value)})} className="h-10 rounded-lg border border-border-soft px-3 text-sm w-24 focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                <button onClick={addStandard} className="h-10 bg-brand-blue text-white px-4 rounded-lg text-sm font-bold shrink-0 opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all" disabled={!standardForm.name || !standardForm.boardId}>Add Class</button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-border-soft shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-secondary">Filter:</span>
                <select value={standardFilterBoard} onChange={e => setStandardFilterBoard(e.target.value)} className="h-8 rounded border border-border-soft bg-surface-2 px-2 text-xs focus:outline-none">
                  <option value="">All Boards</option>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredStandards.map(s => (
                <div key={s.id} className="p-4 rounded-lg border border-border-soft bg-surface-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm block">{s.name}</span>
                    <span className="text-xs text-text-muted mt-0.5">{boards.find(b => b.id === s.boardId)?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted px-2 py-1 bg-white rounded border border-border-soft">Level {s.level}</span>
                    <button onClick={() => deleteStandard(s.id)} className="p-1.5 text-danger hover:bg-danger/10 rounded transition-colors" title="Delete Class">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Subjects" && (
          <div>
            <div className="bg-surface-2/50 p-4 rounded-xl border border-border-soft mb-6">
              <h4 className="text-xs font-bold text-text-primary mb-3">Add New Subject</h4>
              <div className="flex gap-4">
                <select value={subjectForm.boardId} onChange={e => setSubjectForm({...subjectForm, boardId: e.target.value})} className="h-10 rounded-lg border border-border-soft bg-white px-3 text-sm w-48 focus:ring-2 focus:ring-brand-blue/20 outline-none">
                  <option value="" disabled>Select Board</option>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={subjectForm.standardId} onChange={e => setSubjectForm({...subjectForm, standardId: e.target.value})} className="h-10 rounded-lg border border-border-soft bg-white px-3 text-sm w-48 focus:ring-2 focus:ring-brand-blue/20 outline-none" disabled={!subjectForm.boardId}>
                  <option value="" disabled>Select Class</option>
                  {standards.filter(s => s.boardId === subjectForm.boardId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="text" placeholder="Subject Name (e.g. Physics)" value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} className="h-10 rounded-lg border border-border-soft px-3 text-sm flex-1 focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                <button onClick={addSubject} className="h-10 bg-brand-blue text-white px-4 rounded-lg text-sm font-bold shrink-0 opacity-90 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all" disabled={!subjectForm.name || !subjectForm.boardId || !subjectForm.standardId}>
                  Add Subject
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-border-soft shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-secondary">Filter:</span>
                <select value={filterBoard} onChange={e => setFilterBoard(e.target.value)} className="h-8 rounded border border-border-soft bg-surface-2 px-2 text-xs focus:outline-none">
                  <option value="">All Boards</option>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={filterStandard} onChange={e => setFilterStandard(e.target.value)} className="h-8 rounded border border-border-soft bg-surface-2 px-2 text-xs focus:outline-none" disabled={!filterBoard}>
                  <option value="">All Classes</option>
                  {standards.filter(s => s.boardId === filterBoard).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary">Sort by:</span>
                <select value={subjectSort} onChange={e => setSubjectSort(e.target.value)} className="h-8 rounded border border-border-soft bg-surface-2 px-2 text-xs focus:outline-none">
                  <option value="board">Board</option>
                  <option value="class">Class</option>
                  <option value="subject">Subject Name</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {sortedSyllabi.map(s => (
                <div key={s.id} className="p-4 rounded-lg border border-border-soft bg-surface-2 flex flex-col justify-between relative group">
                  <span className="font-bold text-sm text-brand-blue">{s.subject?.name}</span>
                  <div className="mt-2 text-xs text-text-muted flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-white rounded border border-border-soft">{s.board?.name}</span>
                    <span className="px-2 py-0.5 bg-white rounded border border-border-soft">{s.standard?.name}</span>
                  </div>
                  <button onClick={() => deleteSyllabus(s.id)} className="absolute top-2 right-2 p-1.5 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded transition-all" title="Remove Subject">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function FeeStructureTab() {
  const feeHeads = [
    { id: 1, name: "Tuition Fee", type: "Recurring (Monthly)", defaultAmount: "₹2,500" },
    { id: 2, name: "Admission Fee", type: "One-time", defaultAmount: "₹5,000" },
    { id: 3, name: "Study Material Fee", type: "Annual", defaultAmount: "₹1,500" },
  ];

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Fee Heads</h3>
          <p className="text-xs text-text-muted mt-1">Define the standard fee types applicable in your institute.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Fee Head
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white border-b border-border-soft">
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Fee Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Frequency</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Default Amount</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {feeHeads.map(fee => (
              <tr key={fee.id} className="hover:bg-surface-2/30">
                <td className="px-6 py-4 font-bold text-text-primary text-sm">{fee.name}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-surface-2 border border-border-soft px-2.5 py-1 text-[10px] font-bold text-text-secondary">
                    {fee.type}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-text-primary">{fee.defaultAmount}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button className="text-text-muted hover:text-brand-blue transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button className="text-text-muted hover:text-brand-red transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SmsTemplatesTab() {
  const [activeTemplate, setActiveTemplate] = useState("Fee Reminder");
  const templates = ["Welcome Message", "Fee Reminder", "Absent Alert", "Exam Results", "General Notice"];

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm p-6 md:p-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        <div className="w-full md:w-64 shrink-0">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">Templates</h3>
          <div className="space-y-1">
            {templates.map(t => (
              <button 
                key={t}
                onClick={() => setActiveTemplate(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTemplate === t ? "bg-surface text-brand-blue" : "text-text-primary hover:bg-surface-2"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Edit: {activeTemplate}</h3>
            <span className="text-xs font-semibold text-text-muted">160 chars = 1 SMS</span>
          </div>
          <textarea 
            rows={6}
            className="w-full rounded-xl border border-border-soft bg-surface-2 p-4 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 resize-none"
            defaultValue={`Dear Parent, this is a gentle reminder that the fee for {student_name} is due on {due_date}. Please clear the dues to avoid late fees. Regards, Educare.`}
          />
          <div className="mt-4">
            <p className="text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Available Variables</p>
            <div className="flex flex-wrap gap-2">
              {["{student_name}", "{parent_name}", "{due_date}", "{amount}", "{class}"].map(v => (
                <button key={v} className="inline-flex rounded border border-border-soft bg-surface px-2 py-1 text-[11px] font-mono text-text-muted hover:bg-surface-2 transition-colors">
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function ExamConfigTab() {
  const grades = [
    { grade: "A+", min: 90, max: 100, gpa: 10.0 },
    { grade: "A", min: 80, max: 89, gpa: 9.0 },
    { grade: "B+", min: 70, max: 79, gpa: 8.0 },
    { grade: "B", min: 60, max: 69, gpa: 7.0 },
    { grade: "C", min: 50, max: 59, gpa: 6.0 },
    { grade: "F", min: 0, max: 49, gpa: 0.0 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-border-soft p-6 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary mb-6">General Exam Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Default Pass Percentage (%)</label>
            <input type="number" defaultValue={50} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Show Rank in Results?</label>
            <select className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 appearance-none">
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Grading System</h3>
            <p className="text-xs text-text-muted mt-1">Configure grade letters and percentage thresholds.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text-primary border border-border-soft shadow-sm hover:bg-white transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Grade
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-border-soft">
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Grade</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Min %</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">Max %</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase">GPA / Points</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {grades.map((g, i) => (
                <tr key={i} className="hover:bg-surface-2/30">
                  <td className="px-6 py-4 font-bold text-brand-blue text-sm">{g.grade}</td>
                  <td className="px-6 py-4 font-semibold text-text-primary">{g.min}%</td>
                  <td className="px-6 py-4 font-semibold text-text-primary">{g.max}%</td>
                  <td className="px-6 py-4 font-semibold text-text-primary">{g.gpa.toFixed(1)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-text-muted hover:text-brand-red transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CurriculumBuilderTab({ onError }: { onError: (msg: string) => void }) {
  const [boards, setBoards] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);

  const [selBoard, setSelBoard] = useState("");
  const [selStandard, setSelStandard] = useState("");
  const [selSubject, setSelSubject] = useState("");

  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  
  const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState("");

  const [addingSubtopicTo, setAddingSubtopicTo] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState("");

  useEffect(() => {
    fetchApi<any[]>('/setup/boards').then(setBoards);
    fetchApi<any[]>('/setup/standards').then(setStandards);
    fetchApi<any[]>('/setup/syllabi').then(setSyllabi);
  }, []);

  const availableSubjects = syllabi
    .filter(s => s.boardId === selBoard && s.standardId === selStandard)
    .map(s => s.subject);

  const activeSyllabus = syllabi.find(s => s.boardId === selBoard && s.standardId === selStandard && s.subjectId === selSubject);

  useEffect(() => {
    if (activeSyllabus) {
      fetchApi<any[]>(`/setup/chapters?syllabusId=${activeSyllabus.id}`).then(setChapters);
    } else {
      setChapters([]);
    }
  }, [activeSyllabus]);

  const toggleChapter = (id: string) => setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTopic = (id: string) => setExpandedTopics(prev => ({ ...prev, [id]: !prev[id] }));

  const handleAddChapter = async () => {
    if (!activeSyllabus || !newChapterName) return;
    const res = await fetchApi<any>('/setup/chapters', {
      method: 'POST', body: JSON.stringify({ name: newChapterName, syllabusId: activeSyllabus.id })
    });
    setChapters([...chapters, { ...res, topics: [] }]);
    setAddingChapter(false);
    setNewChapterName("");
  };

  const handleAddTopic = async (chapterId: string) => {
    if (!newTopicName) return;
    const res = await fetchApi<any>('/setup/topics', {
      method: 'POST', body: JSON.stringify({ name: newTopicName, chapterId })
    });
    setChapters(chapters.map(c => c.id === chapterId ? { ...c, topics: [...(c.topics || []), { ...res, subtopics: [] }] } : c));
    setAddingTopicTo(null);
    setNewTopicName("");
    setExpandedChapters(prev => ({ ...prev, [chapterId]: true }));
  };

  const handleAddSubtopic = async (chapterId: string, topicId: string) => {
    if (!newSubtopicName) return;
    const res = await fetchApi<any>('/setup/subtopics', {
      method: 'POST', body: JSON.stringify({ name: newSubtopicName, topicId })
    });
    setChapters(chapters.map(c => c.id === chapterId ? {
      ...c, topics: c.topics.map((t: any) => t.id === topicId ? { ...t, subtopics: [...(t.subtopics || []), res] } : t)
    } : c));
    setAddingSubtopicTo(null);
    setNewSubtopicName("");
    setExpandedTopics(prev => ({ ...prev, [topicId]: true }));
  };

  const handleDelete = async (type: 'chapters' | 'topics' | 'subtopics', id: string, parentId?: string, grandParentId?: string) => {
    if (!confirm(`Are you sure you want to delete this ${type.slice(0,-1)}?`)) return;
    try {
      await fetchApi(`/setup/${type}/${id}`, { method: 'DELETE' });
      
      if (type === 'chapters') {
        setChapters(chapters.filter(c => c.id !== id));
      } else if (type === 'topics' && parentId) {
        setChapters(chapters.map(c => c.id === parentId ? { ...c, topics: c.topics.filter((t: any) => t.id !== id) } : c));
      } else if (type === 'subtopics' && parentId && grandParentId) {
        setChapters(chapters.map(c => c.id === grandParentId ? {
          ...c, topics: c.topics.map((t: any) => t.id === parentId ? { ...t, subtopics: t.subtopics.filter((s: any) => s.id !== id) } : t)
        } : c));
      }
    } catch (e: any) {
      onError(e.message || `Failed to delete ${type.slice(0,-1)}.`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col min-h-[600px]">
      <div className="p-6 border-b border-border-soft flex items-center justify-between bg-surface-2/30">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Curriculum Builder</h3>
          <p className="text-xs text-text-muted mt-1">Build and manage the syllabus hierarchy: Chapters, Topics, and Subtopics.</p>
        </div>
      </div>
      
      <div className="p-6 border-b border-border-soft bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Board</label>
            <select value={selBoard} onChange={e => setSelBoard(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
              <option value="" disabled>Select Board</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Class / Standard</label>
            <select value={selStandard} onChange={e => setSelStandard(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" disabled={!selBoard}>
              <option value="" disabled>Select Class</option>
              {standards.filter(s => s.boardId === selBoard).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Subject</label>
            <select value={selSubject} onChange={e => setSelSubject(e.target.value)} className="w-full h-10 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" disabled={!selBoard || !selStandard}>
              <option value="" disabled>Select Subject</option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 bg-surface overflow-y-auto">
        {!selBoard || !selStandard ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
            <Layers className="h-12 w-12 text-brand-blue mb-4" />
            <h3 className="text-sm font-bold text-text-primary">Select Board & Class</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm">Please select a Board and Class above to see available subjects.</p>
          </div>
        ) : availableSubjects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-border-soft rounded-xl shadow-sm">
            <BookOpen className="h-10 w-10 text-brand-blue/50 mb-3" />
            <h3 className="text-sm font-bold text-text-primary">No Subjects Found</h3>
            <p className="text-xs text-text-muted mt-1 mb-4">You have not created any subjects for this Board and Class combination yet.</p>
            <p className="text-xs text-text-muted">Go to the "Academic Structure" → "Subjects" tab to add one.</p>
          </div>
        ) : !selSubject ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
            <Book className="h-12 w-12 text-brand-blue mb-4" />
            <h3 className="text-sm font-bold text-text-primary">Select Subject</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm">Select a subject to build its curriculum.</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Book className="h-4 w-4 text-brand-blue" />
                Syllabus Content
              </h4>
              {!addingChapter && (
                <button onClick={() => setAddingChapter(true)} className="inline-flex items-center gap-1 rounded-md bg-white border border-border-soft px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-brand-blue hover:border-brand-blue/30 transition-colors shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> Add Chapter
                </button>
              )}
            </div>

            {addingChapter && (
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-brand-blue/30 shadow-sm">
                <Folder className="h-4 w-4 text-brand-blue" />
                <input autoFocus type="text" value={newChapterName} onChange={e => setNewChapterName(e.target.value)} placeholder="Chapter Name (e.g. Kinematics)" className="flex-1 h-8 text-sm focus:outline-none" />
                <button onClick={() => { setAddingChapter(false); setNewChapterName(""); }} className="text-xs font-semibold text-text-muted hover:text-text-primary px-2">Cancel</button>
                <button onClick={handleAddChapter} className="h-7 px-3 bg-brand-blue text-white text-xs font-bold rounded">Save</button>
              </div>
            )}

            {chapters.length === 0 && !addingChapter ? (
              <div className="p-8 text-center text-text-muted text-xs border border-dashed border-border-soft rounded-xl bg-white">
                No chapters added yet. Click "Add Chapter" to start building.
              </div>
            ) : (
              <div className="space-y-2">
                {chapters.map(c => (
                  <div key={c.id} className="bg-white rounded-lg border border-border-soft overflow-hidden shadow-sm">
                    {/* Chapter Header */}
                    <div className="flex items-center justify-between p-3 hover:bg-surface-2/50 group">
                      <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleChapter(c.id)}>
                        <button className="p-1 rounded text-text-muted hover:bg-surface-3 transition-colors">
                          {expandedChapters[c.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <Folder className="h-4 w-4 text-brand-blue" />
                        <span className="text-sm font-bold text-text-primary">{c.name}</span>
                        <span className="text-[10px] font-semibold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {c.topics?.length || 0} Topics
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAddingTopicTo(c.id)} className="text-[11px] font-semibold text-brand-blue hover:underline px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          + Topic
                        </button>
                        <button onClick={() => handleDelete('chapters', c.id)} className="text-text-muted hover:text-brand-red p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chapter Body (Topics) */}
                    {expandedChapters[c.id] && (
                      <div className="border-t border-border-soft bg-surface/50 pl-9 pr-3 py-2 space-y-1">
                        
                        {addingTopicTo === c.id && (
                          <div className="flex items-center gap-2 bg-white p-2 rounded border border-brand-blue/30 shadow-sm ml-2 mb-2">
                            <FileBox className="h-3.5 w-3.5 text-brand-blue/70" />
                            <input autoFocus type="text" value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic Name" className="flex-1 h-7 text-xs focus:outline-none" />
                            <button onClick={() => { setAddingTopicTo(null); setNewTopicName(""); }} className="text-[10px] font-semibold text-text-muted hover:text-text-primary px-2">Cancel</button>
                            <button onClick={() => handleAddTopic(c.id)} className="h-6 px-2 bg-brand-blue text-white text-[10px] font-bold rounded">Save</button>
                          </div>
                        )}

                        {(!c.topics || c.topics.length === 0) && addingTopicTo !== c.id && (
                          <p className="text-xs text-text-muted italic py-1 pl-2">No topics yet.</p>
                        )}

                        {c.topics?.map((t: any) => (
                          <div key={t.id} className="group/topic">
                            {/* Topic Header */}
                            <div className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors border border-transparent hover:border-border-soft hover:shadow-sm">
                              <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleTopic(t.id)}>
                                <button className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors">
                                  {expandedTopics[t.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </button>
                                <FileBox className="h-3.5 w-3.5 text-brand-blue/70" />
                                <span className="text-xs font-semibold text-text-primary">{t.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setAddingSubtopicTo(t.id)} className="text-[10px] font-semibold text-brand-blue hover:underline px-1 opacity-0 group-hover/topic:opacity-100 transition-opacity">
                                  + Subtopic
                                </button>
                                <button onClick={() => handleDelete('topics', t.id, c.id)} className="text-text-muted hover:text-brand-red p-1 rounded transition-colors opacity-0 group-hover/topic:opacity-100">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Topic Body (Subtopics) */}
                            {expandedTopics[t.id] && (
                              <div className="pl-8 pr-2 py-1 space-y-1">
                                {addingSubtopicTo === t.id && (
                                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-brand-blue/30 shadow-sm ml-2 mb-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-brand-blue/50" />
                                    <input autoFocus type="text" value={newSubtopicName} onChange={e => setNewSubtopicName(e.target.value)} placeholder="Subtopic Name" className="flex-1 h-6 text-[11px] focus:outline-none" />
                                    <button onClick={() => { setAddingSubtopicTo(null); setNewSubtopicName(""); }} className="text-[9px] font-semibold text-text-muted hover:text-text-primary px-1">Cancel</button>
                                    <button onClick={() => handleAddSubtopic(c.id, t.id)} className="h-5 px-1.5 bg-brand-blue text-white text-[9px] font-bold rounded">Save</button>
                                  </div>
                                )}
                                
                                {(!t.subtopics || t.subtopics.length === 0) && addingSubtopicTo !== t.id && (
                                  <p className="text-[11px] text-text-muted italic py-0.5 pl-2">No subtopics.</p>
                                )}

                                {t.subtopics?.map((s: any) => (
                                  <div key={s.id} className="flex items-center justify-between p-1.5 pl-2 rounded hover:bg-white group/subtopic">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-brand-blue/30" />
                                      <span className="text-[11px] text-text-secondary group-hover/subtopic:text-text-primary transition-colors">{s.name}</span>
                                    </div>
                                    <button onClick={() => handleDelete('subtopics', s.id, t.id, c.id)} className="text-text-muted hover:text-brand-red p-0.5 rounded transition-colors opacity-0 group-hover/subtopic:opacity-100">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
