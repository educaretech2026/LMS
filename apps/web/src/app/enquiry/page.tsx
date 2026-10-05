"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { Headset, Plus, Search, Mail, Phone, Calendar, Loader2, User, MapPin, X } from "lucide-react";
import { fetchApi } from "@/lib/api";

type EnquiryStatus = "NEW" | "CONTACTED" | "VISITED" | "QUALIFIED" | "CONVERTED" | "LOST";

interface Enquiry {
  id: string;
  studentName: string;
  parentName?: string;
  contactNumber: string;
  email?: string;
  address?: string;
  source?: string;
  targetBoard?: string;
  targetStandard?: string;
  targetCourse?: string;
  status: EnquiryStatus;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<EnquiryStatus, string> = {
  NEW: "bg-blue-100 text-blue-700 border-blue-200",
  CONTACTED: "bg-amber-100 text-amber-700 border-amber-200",
  VISITED: "bg-purple-100 text-purple-700 border-purple-200",
  QUALIFIED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  CONVERTED: "bg-green-100 text-green-700 border-green-200",
  LOST: "bg-red-100 text-red-700 border-red-200",
};

export default function EnquiryPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [summary, setSummary] = useState({ total: 0, thisMonth: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [data, stats] = await Promise.all([
        fetchApi("/enquiry"),
        fetchApi("/enquiry/summary")
      ]);
      setEnquiries(Array.isArray(data) ? data : []);
      setSummary(stats as any);
    } catch (e) {
      console.error("Failed to load enquiries", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = enquiries.filter(e => 
    e.studentName.toLowerCase().includes(search.toLowerCase()) ||
    e.contactNumber.includes(search) ||
    e.targetCourse?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Enquiry / Leads">
      <PageShell
        title="Enquiry / Leads"
        subtitle="Track prospective student inquiries and leads"
        icon={Headset}
        accentColor="orange"
        actions={
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const url = window.location.origin + "/admission";
                navigator.clipboard.writeText(url);
                alert("Public form link copied to clipboard:\n" + url);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border-soft bg-white px-4 py-2 text-xs font-semibold text-text-secondary shadow-sm hover:bg-surface-2 transition-colors"
            >
              Share Public Form
            </button>
            <button 
              onClick={() => { setEditingId(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Enquiry
            </button>
          </div>
        }
      >
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Enquiries", value: summary.total, sub: "All time" },
            { label: "This Month", value: summary.thisMonth, sub: "Current month" },
            { label: "Converted", value: summary.converted, sub: "To students" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-border-soft p-5 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{c.label}</p>
              <p className="text-3xl font-black mt-2 text-brand-blue">{c.value}</p>
              <p className="text-[10px] text-text-muted mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border-soft shadow-sm p-4 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name or phone..."
              className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 pl-9 pr-4 text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 z-10 border-b border-border-soft">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Student Details</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Interest</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Follow-up</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-blue mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-sm text-text-muted">No enquiries found.</td></tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-2/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-text-primary">{e.studentName}</p>
                        {e.parentName && <p className="text-[11px] text-text-muted mt-0.5">Parent: {e.parentName}</p>}
                        {e.source && <span className="inline-block mt-1 text-[9px] font-bold bg-surface px-2 py-0.5 rounded text-text-secondary">{e.source}</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-text-primary mb-1">
                          <Phone className="h-3 w-3 text-brand-blue" /> {e.contactNumber}
                        </div>
                        {e.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                            <Mail className="h-3 w-3" /> {e.email}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-text-primary">{e.targetCourse || "N/A"}</p>
                        {(e.targetBoard || e.targetStandard) && (
                          <p className="text-[10px] text-text-muted mt-0.5">{e.targetStandard} • {e.targetBoard}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase ${STATUS_COLORS[e.status]}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {e.followUpDate ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 inline-flex">
                            <Calendar className="h-3.5 w-3.5" /> {new Date(e.followUpDate).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic">Not set</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {e.status !== 'CONVERTED' && (
                            <button
                              onClick={() => {
                                const params = new URLSearchParams({
                                  add: 'true',
                                  name: e.studentName || '',
                                  phone: e.contactNumber || '',
                                  email: e.email || '',
                                  parentName: e.parentName || '',
                                  board: e.targetBoard || '',
                                  standard: e.targetStandard || ''
                                });
                                window.location.href = `/students?${params.toString()}`;
                              }}
                              className="text-xs font-bold text-green-600 hover:underline"
                            >
                              Convert
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingId(e.id); setShowModal(true); }}
                            className="text-xs font-bold text-brand-blue hover:underline"
                          >
                            Update
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
      </PageShell>

      {/* Add / Edit Modal */}
      {showModal && (
        <EnquiryModal 
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadData(); }}
          editingId={editingId}
          initialData={editingId ? enquiries.find(e => e.id === editingId) : undefined}
        />
      )}
    </DashboardLayout>
  );
}

function EnquiryModal({ onClose, onSuccess, editingId, initialData }: any) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    studentName: initialData?.studentName || "",
    parentName: initialData?.parentName || "",
    contactNumber: initialData?.contactNumber || "",
    email: initialData?.email || "",
    source: initialData?.source || "Walk-in",
    targetBoard: initialData?.targetBoard || "",
    targetStandard: initialData?.targetStandard || "",
    targetCourse: initialData?.targetCourse || "",
    status: initialData?.status || "NEW",
    followUpDate: initialData?.followUpDate ? new Date(initialData.followUpDate).toISOString().split('T')[0] : "",
    notes: initialData?.notes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await fetchApi(`/enquiry/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...formData,
            followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : null
          }),
        });
      } else {
        await fetchApi(`/enquiry`, {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            followUpDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : null
          }),
        });
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("Error saving enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
          <h2 className="text-sm font-bold text-text-primary">{editingId ? "Update Lead Status" : "Add New Lead"}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-surface flex items-center justify-center"><X className="h-4 w-4 text-text-muted" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Student Name *</label>
              <input required value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Parent Name</label>
              <input value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Contact Number *</label>
              <input required value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Email Address</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border-soft bg-brand-blue/5 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Target Course</label>
              <input value={formData.targetCourse} onChange={e => setFormData({...formData, targetCourse: e.target.value})} placeholder="e.g. NEET 2026" className="w-full h-9 rounded-lg border border-border-soft bg-white pl-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Target Class</label>
              <input value={formData.targetStandard} onChange={e => setFormData({...formData, targetStandard: e.target.value})} placeholder="e.g. Class 11" className="w-full h-9 rounded-lg border border-border-soft bg-white pl-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Target Board</label>
              <input value={formData.targetBoard} onChange={e => setFormData({...formData, targetBoard: e.target.value})} placeholder="e.g. CBSE" className="w-full h-9 rounded-lg border border-border-soft bg-white pl-3 text-sm focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Lead Status *</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface px-3 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
                <option value="NEW">New Lead</option>
                <option value="CONTACTED">Contacted</option>
                <option value="VISITED">Visited Centre</option>
                <option value="QUALIFIED">Qualified / Hot</option>
                <option value="CONVERTED">Converted (Won)</option>
                <option value="LOST">Lost / Not Interested</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Next Follow-up Date</label>
              <input type="date" value={formData.followUpDate} onChange={e => setFormData({...formData, followUpDate: e.target.value})} className="w-full h-9 rounded-lg border border-border-soft bg-surface pl-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Lead Notes / Remarks</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full rounded-lg border border-border-soft bg-surface p-3 text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20 resize-none" placeholder="Add follow-up notes here..." />
          </div>

        </form>
        <div className="p-4 border-t border-border-soft bg-surface-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-bold text-text-secondary hover:text-text-primary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center justify-center min-w-[120px] rounded-lg bg-brand-blue px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue-dark disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
