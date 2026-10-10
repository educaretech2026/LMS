"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function PublicFormView() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const loadForm = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/forms/${id}`);
        if (!res.ok) throw new Error("Form not found or inactive");
        const data = await res.json();
        setForm(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadForm();
  }, [id]);

  const handleChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/forms/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Failed to submit form");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "An error occurred during submission");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">Loading form...</div>;
  }

  if (error || !form || !form.isActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Form Unavailable</h2>
          <p className="text-gray-500 text-sm">{error || "This form is no longer accepting responses."}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full border border-gray-100 flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-500 text-sm">Your response has been successfully recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-t-2xl shadow-sm border border-gray-200 border-b-0 border-t-8 border-t-brand-600 p-8 sm:p-10 mb-4">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{form.title}</h1>
          {form.description && (
            <p className="mt-4 text-gray-600 leading-relaxed">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-b-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
          <div className="space-y-8">
            {form.fields?.map((field: any) => (
              <div key={field.id} className="group">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  {field.label} {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea 
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Your answer"
                  />
                ) : (
                  <input 
                    type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="Your answer"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Educare LMS Forms</p>
            <button 
              type="submit"
              disabled={submitting}
              className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-sm shadow-brand-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
