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
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev[fieldId] || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((item: string) => item !== option) };
      }
    });
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (!file) return;
    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/forms/${id}/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`);
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, finalUrl } = await res.json();
      
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      
      setFormData(prev => ({ ...prev, [fieldId]: finalUrl }));
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
  };

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
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob pointer-events-none" />
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-purple-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 pointer-events-none" />

      <div className="max-w-3xl w-full relative z-10 flex flex-col gap-5 pb-20">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2.5 bg-brand-blue" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{form.title}</h1>
          {form.description && (
            <p className="mt-4 text-gray-600 leading-relaxed text-base sm:text-lg">{form.description}</p>
          )}
          {form.fields?.some((f: any) => f.required) && (
            <p className="mt-6 text-sm font-medium text-red-500">* Indicates required question</p>
          )}
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {form.fields?.map((field: any) => {
            const isFocused = focusedField === field.id;
            
            if (field.type === 'image') {
              return (
                <div key={field.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {field.imageUrl ? (
                    <img src={field.imageUrl} alt="Form visual" className="w-full h-auto object-cover" />
                  ) : (
                    <div className="p-8 text-center text-gray-400 bg-gray-50">Image placeholder</div>
                  )}
                </div>
              );
            }

            return (
              <div 
                key={field.id} 
                className={`relative bg-white rounded-2xl shadow-sm border p-6 sm:p-8 transition-all duration-300 ${isFocused ? 'border-brand-blue ring-1 ring-brand-blue/20' : 'border-gray-100'}`}
                onFocus={() => setFocusedField(field.id)}
                onClick={() => setFocusedField(field.id)}
              >
                {isFocused && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-blue rounded-l-2xl" />}
                
                <div className="mb-4">
                  <label className="block text-base sm:text-lg font-medium text-gray-900">
                    {field.label} 
                    {field.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                  </label>
                </div>

                <div className="mt-2">
                  {field.type === 'textarea' ? (
                    <textarea 
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onBlur={() => setFocusedField(null)}
                      rows={3}
                      className="w-full bg-transparent border-b border-gray-300 focus:border-brand-blue outline-none transition-colors py-2 text-gray-800 placeholder-gray-400 resize-y"
                      placeholder="Your answer"
                    />
                  ) : field.type === 'radio' ? (
                    <div className="flex flex-col gap-3">
                      {field.options?.map((opt: string, i: number) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name={field.id}
                            value={opt}
                            checked={formData[field.id] === opt}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            required={field.required && !formData[field.id]}
                            className="w-5 h-5 text-brand-blue border-gray-300 focus:ring-brand-blue"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex flex-col gap-3">
                      {field.options?.map((opt: string, i: number) => (
                        <label key={i} className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            value={opt}
                            checked={(formData[field.id] || []).includes(opt)}
                            onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                            className="w-5 h-5 text-brand-blue border-gray-300 rounded focus:ring-brand-blue"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full sm:w-1/2 p-3 bg-white border border-gray-300 rounded-lg focus:border-brand-blue outline-none transition-colors text-gray-800"
                    >
                      <option value="" disabled>Choose</option>
                      {field.options?.map((opt: string, i: number) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'file' ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file"
                        accept="image/*,application/pdf"
                        required={field.required && !formData[field.id]}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(field.id, e.target.files[0]);
                          }
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 transition-colors"
                      />
                      {uploadingFields[field.id] && <p className="text-xs text-brand-blue font-medium animate-pulse">Uploading...</p>}
                      {formData[field.id] && !uploadingFields[field.id] && <p className="text-xs text-green-600 font-medium">File uploaded successfully.</p>}
                    </div>
                  ) : (
                    <input 
                      type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      required={field.required}
                      value={formData[field.id] || ''}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      onBlur={() => setFocusedField(null)}
                      className="w-full sm:w-1/2 bg-transparent border-b border-gray-300 focus:border-brand-blue outline-none transition-colors py-2 text-gray-800 placeholder-gray-400"
                      placeholder="Your answer"
                    />
                  )}
                </div>
              </div>
            );
          })}

          <div className="mt-4 flex flex-col sm:flex-row gap-6 justify-between items-center px-2">
            <button 
              type="submit"
              disabled={submitting || Object.values(uploadingFields).some(v => v)}
              className="w-full sm:w-auto bg-brand-blue text-white px-8 py-2.5 rounded-lg font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            
            <div className="flex items-center gap-2 text-gray-400 font-medium tracking-wide text-xs uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Educare Forms
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
