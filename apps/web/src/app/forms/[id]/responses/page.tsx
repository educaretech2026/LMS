"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { fetchApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

export default function FormResponsesPage() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [formData, responseData] = await Promise.all([
          fetchApi(`/forms/${id}`),
          fetchApi(`/forms/${id}/responses`)
        ]);
        setForm(formData);
        setResponses(responseData);
      } catch (err: any) {
        alert("Failed to load form responses");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  const downloadCSV = () => {
    if (!form || responses.length === 0) return;
    
    // Get headers from form fields
    const headers = form.fields.map((f: any) => f.label);
    headers.unshift("Submitted At");

    const rows = responses.map(r => {
      const row = [new Date(r.createdAt).toLocaleString()];
      form.fields.forEach((f: any) => {
        row.push(`"${r.data[f.id] || ''}"`);
      });
      return row.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${form.title.replace(/\s+/g, '_')}_Responses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <PageShell 
        title={form ? `Responses: ${form.title}` : "Loading..."}
        description={form?.description || "Viewing collected data"}
        actions={
          <div className="flex gap-2">
            <Link href="/forms" className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forms
            </Link>
            <button onClick={downloadCSV} disabled={responses.length === 0} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 flex items-center transition-all disabled:opacity-50">
              <Download className="w-4 h-4 mr-2" /> Download CSV
            </button>
          </div>
        }
      >
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Submitted</th>
                {form?.fields?.map((field: any) => (
                  <th key={field.id} className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">Loading responses...</td>
                </tr>
              ) : responses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">No responses collected yet.</td>
                </tr>
              ) : (
                responses.map(res => (
                  <tr key={res.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      {new Date(res.createdAt).toLocaleString()}
                    </td>
                    {form.fields.map((field: any) => (
                      <td key={field.id} className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                        {res.data[field.id] || "-"}
                      </td>
                    ))}
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
