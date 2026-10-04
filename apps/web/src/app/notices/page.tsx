"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Bell } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function NoticesPage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", content: "", type: "GENERAL", isActive: true });

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const res: any = await fetchApi("/notices");
      setNotices(res);
    } catch (error) {
      alert("Failed to load notices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await fetchApi(`/notices/${editingId}`, { method: 'PUT', body: JSON.stringify(formData) });
        alert("Notice updated");
      } else {
        await fetchApi("/notices", { method: 'POST', body: JSON.stringify(formData) });
        alert("Notice created");
      }
      setIsModalOpen(false);
      fetchNotices();
    } catch (error) {
      alert("Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetchApi(`/notices/${id}`, { method: 'DELETE' });
      alert("Notice deleted");
      fetchNotices();
    } catch (error) {
      alert("Failed to delete notice");
    }
  };

  const openModal = (notice?: any) => {
    if (notice) {
      setEditingId(notice.id);
      setFormData({ title: notice.title, content: notice.content, type: notice.type, isActive: notice.isActive });
    } else {
      setEditingId(null);
      setFormData({ title: "", content: "", type: "GENERAL", isActive: true });
    }
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout title="Notice Board">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-border-soft shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-brand-blue" />
            </div>
            <div>
              <h2 className="font-bold text-text-primary">Notice Board</h2>
              <p className="text-xs text-text-muted">Manage announcements</p>
            </div>
          </div>
          <button onClick={() => openModal()} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-brand-blue-dark transition-colors">
            <Plus className="h-4 w-4" /> Create Notice
          </button>
        </div>

        <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted text-sm">Loading...</div>
          ) : notices.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No notices found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border-soft">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-text-muted uppercase text-[10px] tracking-widest">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-muted uppercase text-[10px] tracking-widest">Content</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-muted uppercase text-[10px] tracking-widest">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-text-muted uppercase text-[10px] tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {notices.map((n) => (
                  <tr key={n.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-4 font-bold text-text-primary">{n.title}</td>
                    <td className="px-4 py-4 text-text-muted truncate max-w-xs">{n.content}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${n.isActive ? 'bg-success/10 text-success border border-success/20' : 'bg-text-muted/10 text-text-muted border border-border-soft'}`}>
                        {n.isActive ? 'ACTIVE' : 'HIDDEN'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-3">
                      <button onClick={() => openModal(n)} className="text-brand-blue hover:text-brand-blue-dark transition-colors"><Edit2 className="h-4 w-4 inline" /></button>
                      <button onClick={() => handleDelete(n.id)} className="text-brand-red hover:text-brand-red-dark transition-colors"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-5 text-text-primary">{editingId ? "Edit Notice" : "New Notice"}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-text-secondary uppercase tracking-wider">Title</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border border-border-soft rounded-lg p-2.5 text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 transition-all" placeholder="Enter notice title..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-text-secondary uppercase tracking-wider">Content</label>
                  <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full border border-border-soft rounded-lg p-2.5 text-sm outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 transition-all h-28 resize-none" placeholder="Write notice content here..." />
                </div>
                <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg border border-border-soft">
                  <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="accent-brand-blue w-4 h-4 rounded" />
                  <label htmlFor="isActive" className="text-sm font-semibold text-text-primary cursor-pointer select-none">Visible to students</label>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border-soft">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold bg-surface-2 text-text-primary rounded-lg hover:bg-border-soft transition-colors">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm font-semibold bg-brand-blue text-white rounded-lg hover:bg-brand-blue-dark transition-colors shadow-sm">Save Notice</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
