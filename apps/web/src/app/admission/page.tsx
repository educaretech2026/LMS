"use client";

import { useState } from "react";
import { fetchApi } from "@/lib/api";
import { Loader2, CheckCircle2, ShieldCheck, Users, Trophy, BookOpen, Star } from "lucide-react";
import Link from "next/link";

export default function PublicEnquiryForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    studentName: "",
    parentName: "",
    contactNumber: "",
    email: "",
    targetBoard: "",
    targetStandard: "",
    targetCourse: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchApi("/enquiry/public", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Failed to submit enquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10 max-w-md w-full text-center transform transition-all duration-500 hover:scale-[1.02]">
          <div className="mx-auto w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50/50">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Request Received!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">Thank you for trusting us with your child's education. One of our academic counselors will contact you within 24 hours.</p>
          <button 
            onClick={() => {
              setSuccess(false);
              setFormData({ studentName: "", parentName: "", contactNumber: "", email: "", targetBoard: "", targetStandard: "", targetCourse: "" });
            }}
            className="w-full bg-slate-800 text-white rounded-xl h-14 font-semibold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
          >
            Submit Another Query
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 max-w-6xl w-full overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Side: Trust Signals & Branding */}
        <div className="bg-slate-900 text-white lg:w-5/12 p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-blue rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-600 rounded-full opacity-20 blur-3xl"></div>
          
          <div className="relative z-10">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-6">
              Empowering the Next Generation of Achievers.
            </h2>
            <p className="text-slate-400 mb-10 leading-relaxed">
              Join thousands of parents who have trusted us to guide their children towards academic excellence and bright futures.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Proven Track Record</h3>
                  <p className="text-slate-400 text-sm mt-1">Consistent top results in board and entrance examinations year after year.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Expert Faculty</h3>
                  <p className="text-slate-400 text-sm mt-1">Learn from highly qualified educators with decades of combined experience.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Personalized Attention</h3>
                  <p className="text-slate-400 text-sm mt-1">Small batch sizes ensuring every student's unique learning needs are met.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-12 pt-10 border-t border-white/10">
            <h3 className="font-bold text-lg mb-4 text-white">Our Campuses</h3>
            
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 bg-brand-blue/20 p-1.5 rounded-lg shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-blue"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Kottayam – Mannanam Campus</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Educare Institute, 2nd Floor Gurukrupa Complex,<br/>
                    Mannanam Jn. Near KEEMS, Mannanam
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 bg-brand-blue/20 p-1.5 rounded-lg shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-blue"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Kottayam – Kalathipady Campus</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Educare Institute, 2nd Floor Castle Charis Complex,<br/>
                    Kalathipady Jn. Near Pallikoodam, Vadavathur Kottayam
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:w-7/12 p-10 lg:p-14 bg-white relative">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Admission Enquiry</h1>
            <p className="text-slate-500">Fill out the form below to schedule a free counseling session.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Student Name <span className="text-red-500">*</span></label>
                <input required name="studentName" value={formData.studentName} onChange={handleChange} placeholder="e.g. Rahul Kumar" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Parent/Guardian Name</label>
                <input name="parentName" value={formData.parentName} onChange={handleChange} placeholder="e.g. Ramesh Kumar" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Contact Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">+91</span>
                  <input required type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="9876543210" className="w-full h-12 rounded-xl border border-slate-200 pl-12 pr-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="hello@example.com" className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-blue" />
                Academic Interests
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Board</label>
                  <select name="targetBoard" value={formData.targetBoard} onChange={handleChange} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all bg-white appearance-none">
                    <option value="">Select Board</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Standard</label>
                  <select name="targetStandard" value={formData.targetStandard} onChange={handleChange} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all bg-white appearance-none">
                    <option value="">Select Class</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Dropper">Dropper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Course Type</label>
                  <select name="targetCourse" value={formData.targetCourse} onChange={handleChange} className="w-full h-12 rounded-xl border border-slate-200 px-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all bg-white appearance-none">
                    <option value="">Select Course</option>
                    <option value="Entrance (NEET/JEE)">Entrance (NEET/JEE)</option>
                    <option value="Tuition">Tuition</option>
                    <option value="Foundation">Foundation</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-8 h-14 bg-brand-blue text-white rounded-xl font-bold text-lg flex items-center justify-center hover:bg-brand-blue-dark transition-all shadow-lg shadow-brand-blue/30 disabled:opacity-70 disabled:shadow-none hover:-translate-y-0.5"
            >
              {loading ? <Loader2 className="animate-spin h-6 w-6" /> : "Submit Enquiry"}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4">
              Your information is secure. We never share your data with third parties.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
