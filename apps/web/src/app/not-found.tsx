import Link from "next/link";
import Image from "next/image";
import logoImage from "@/logos/logo1.png";
import { ArrowLeft, Home, HelpCircle, ShieldQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-indigo-600/10 blur-[90px] rounded-full pointer-events-none" />

      {/* Top Header / Brand */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="inline-block transition-opacity hover:opacity-90">
          <div className="w-44 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center p-2 overflow-hidden">
            <Image
              src={logoImage}
              alt="Educare Group of Institutions"
              width={160}
              height={40}
              className="object-contain w-full h-full scale-[5.5] translate-y-[9px]"
              priority
            />
          </div>
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Need Assistance?</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 text-center flex flex-col items-center justify-center my-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wide uppercase mb-6 backdrop-blur-md">
          <ShieldQuestion className="w-4 h-4 text-blue-400" />
          <span>Error 404 • Page Not Found</span>
        </div>

        {/* 404 Graphic Heading */}
        <div className="relative mb-6">
          <h1 className="text-8xl md:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-600 select-none">
            404
          </h1>
          <div className="absolute inset-0 text-8xl md:text-9xl font-black tracking-tight text-blue-500/10 blur-xl select-none pointer-events-none">
            404
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
          We couldn&apos;t find that page
        </h2>
        <p className="text-sm md:text-base text-slate-400 max-w-md leading-relaxed mb-8">
          The link you clicked may be broken, the page may have been moved, or your account may not have permission to view it.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.history.back();
              }
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Educare Group of Institutions. Secure Learning Management System.
      </footer>
    </div>
  );
}
