"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, Sparkles } from "lucide-react";

export default function PublicFormView() {
  const params = useParams();
  const id = params.id as string;
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-brand-blue-light/10 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium tracking-wide">Loading form...</p>
      </div>
    );
  }

  if (error || !form || !form.isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-brand-blue-light/10 flex items-center justify-center p-4">
        <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[2rem] shadow-xl text-center max-w-md w-full border border-white/50">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Form Unavailable</h2>
          <p className="text-gray-500">{error || "This form is no longer accepting responses."}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-brand-blue-light/10 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl text-center max-w-md w-full border border-white/60 transform transition-all hover:scale-[1.02]">
          <div className="w-20 h-20 bg-gradient-to-tr from-green-400 to-emerald-300 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-200">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Thank You!</h2>
          <p className="text-gray-500 text-lg leading-relaxed">Your response has been securely recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-pink-100/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />

      <div className="max-w-2xl mx-auto w-full relative z-10">
        <div className="bg-white/80 backdrop-blur-2xl rounded-t-[2.5rem] shadow-xl border border-white/60 p-8 sm:p-12 mb-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-blue to-indigo-400" />
          <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">{form.title}</h1>
          {form.description && (
            <p className="mt-5 text-gray-600 leading-relaxed text-lg">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-2xl rounded-b-[2.5rem] shadow-xl border border-white/60 p-8 sm:p-12">
          <div className="space-y-10">
            {form.fields?.map((field: any) => (
              <div 
                key={field.id} 
                className={`group transition-all duration-300 ${focusedField === field.id ? 'transform scale-[1.01]' : ''}`}
              >
                <label className="block text-[0.95rem] font-bold text-gray-800 mb-3 ml-1">
                  {field.label} 
                  {field.required && <span className="text-red-500 ml-1.5 font-black">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea 
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    onFocus={() => setFocusedField(field.id)}
                    onBlur={() => setFocusedField(null)}
                    rows={4}
                    className="w-full px-5 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:ring-0 focus:border-brand-blue outline-none transition-all resize-none shadow-sm placeholder-gray-400 font-medium"
                    placeholder="Type your answer here..."
                  />
                ) : (
                  <input 
                    type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    onFocus={() => setFocusedField(field.id)}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-5 py-4 bg-white/50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:ring-0 focus:border-brand-blue outline-none transition-all shadow-sm placeholder-gray-400 font-medium"
                    placeholder={field.type === 'email' ? 'hello@example.com' : field.type === 'tel' ? '+1 234 567 8900' : 'Your answer...'}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200/50 flex flex-col sm:flex-row gap-6 justify-between items-center">
            <div className="flex items-center gap-2 text-brand-blue/60 font-semibold tracking-wide text-sm uppercase">
              <Sparkles className="w-4 h-4" />
              Educare Forms
            </div>
            <button 
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white px-10 py-4 rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-brand-blue/30 transform hover:-translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
