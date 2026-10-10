"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { Plus, List, Eye, Link as LinkIcon, Trash, FileText } from "lucide-react";
import { fetchApi } from "@/lib/api";
import Link from "next/link";

export default function FormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadForms = async () => {
    try {
      const data = await fetchApi("/forms");
      setForms(data as any[]);
    } catch (error: any) {
      alert(error.message || "Failed to load forms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const deleteForm = async (id: string) => {
    if (!confirm("Are you sure you want to delete this form?")) return;
    try {
      await fetchApi(`/forms/${id}`, { method: 'DELETE' });
      alert("Form deleted");
      loadForms();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/f/${id}`;
    navigator.clipboard.writeText(url);
    alert("Public link copied to clipboard");
  };

  return (
    <DashboardLayout>
      <PageShell
        title="Public Forms"
        subtitle="Create and manage custom forms for events and data collection."
        icon={FileText}
        actions={
          <Link href="/forms/builder" className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-blue-dark flex items-center transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Create New Form
          </Link>
        }
      >
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Form Title</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responses</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created On</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Loading forms...</td>
                </tr>
              ) : forms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No forms created yet.</td>
                </tr>
              ) : (
                forms.map((form) => (
                  <tr key={form.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{form.title}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{form.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {form.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/forms/${form.id}/responses`} className="text-sm font-semibold text-brand-600 hover:text-brand-800 flex items-center">
                        <List className="w-4 h-4 mr-1.5" />
                        {form._count?.responses || 0} Responses
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(form.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => copyLink(form.id)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Copy Public Link">
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteForm(form.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Form">
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
