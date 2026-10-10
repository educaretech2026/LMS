"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { fetchApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Plus, Trash, GripVertical, Save, PenTool } from "lucide-react";

type Field = {
  id: string;
  label: string;
  type: string;
  required: boolean;
};

export default function FormBuilderPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Field[]>([
    { id: "field_" + Date.now(), label: "Full Name", type: "text", required: true },
    { id: "field_" + (Date.now() + 1), label: "Mobile / WhatsApp Number", type: "tel", required: true },
    { id: "field_" + (Date.now() + 2), label: "Email Address", type: "email", required: true },
  ]);
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields([...fields, { id: "field_" + Date.now(), label: "New Field", type: "text", required: false }]);
  };

  const removeField = (index: number) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const updateField = (index: number, key: keyof Field, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  const handleSave = async () => {
    if (!title) return alert("Form title is required");
    if (fields.length === 0) return alert("Add at least one field");

    setSaving(true);
    try {
      await fetchApi("/forms", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          fields,
          isActive: true
        })
      });
      alert("Form created successfully!");
      router.push("/forms");
    } catch (err: any) {
      alert(err.message || "Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageShell title="Form Builder" subtitle="Design a new public response form." icon={PenTool}>
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Form Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Form Title <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g., Annual Sports Day Registration"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Provide some context for the respondents..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Form Fields</h2>
              <button onClick={addField} className="flex items-center text-sm font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add Field
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:border-brand-200 transition-colors group">
                  <div className="pt-2 text-gray-300 cursor-move">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Field Label</label>
                      <input 
                        type="text" 
                        value={field.label} 
                        onChange={e => updateField(idx, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue outline-none"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Input Type</label>
                      <select 
                        value={field.type} 
                        onChange={e => updateField(idx, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-brand-blue outline-none bg-white"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Paragraph</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone / WhatsApp</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-center pt-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={field.required}
                          onChange={e => updateField(idx, 'required', e.target.checked)}
                          className="rounded text-brand-blue focus:ring-brand-blue w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Required</span>
                      </label>
                    </div>
                  </div>
                  <button onClick={() => removeField(idx)} className="pt-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                  No fields added yet.
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-brand-blue text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-blue-dark flex items-center transition-all shadow-sm shadow-brand-blue-light/20 disabled:opacity-70"
              >
                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save & Publish Form</>}
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
