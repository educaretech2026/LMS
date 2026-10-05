"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { User, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response: any = await fetchApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      document.cookie = `AccessToken=${response.access_token}; path=/; max-age=86400; samesite=lax`;
      // Force a cache-busting hard reload to the dashboard
      window.location.href = "/?t=" + Date.now();
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]">
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-blue/30 blur-[120px] mix-blend-screen opacity-50 animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-red/20 blur-[100px] mix-blend-screen opacity-60 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-indigo-500/20 blur-[80px] mix-blend-screen opacity-40"></div>

      <div className="w-full max-w-md p-6 relative z-10">
        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Subtle highlight line at the top */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

          <div className="text-center mb-10">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-blue to-indigo-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-brand-blue/30 border border-white/10">
              <span className="text-white font-bold text-2xl tracking-tighter">EL</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm text-white/60 mt-2 font-medium">Log in to your learning dashboard</p>
          </div>

          {error && (
            <div className="bg-red-500/20 backdrop-blur-md text-red-200 text-sm font-medium p-3 rounded-xl mb-6 border border-red-500/30 text-center shadow-lg shadow-red-500/10">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-white/70 ml-1 tracking-wide uppercase">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-white/40" />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-11 text-white text-sm placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner" 
                  placeholder="you@example.com" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-xs font-semibold text-white/70 tracking-wide uppercase">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-white/40" />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-11 text-white text-sm placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full h-12 mt-4 rounded-xl bg-gradient-to-r from-brand-blue to-indigo-600 text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 hover:from-brand-blue-dark hover:to-indigo-700 transition-all disabled:opacity-70 disabled:hover:shadow-brand-blue/25 flex items-center justify-center gap-2 border border-white/10"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </>
              )}
            </button>
          </form>

        </div>
        
        {/* Footer text outside the card */}
        <p className="text-center text-white/40 text-xs mt-8 font-medium">
          © {new Date().getFullYear()} EducareTech. All rights reserved.
        </p>
      </div>
    </div>
  );
}
