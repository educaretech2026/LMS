"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, X, ArrowLeft, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface AccessBlockedDetail {
  status?: number;
  message?: string;
  module?: string;
  endpoint?: string;
}

export function AccessRestrictedModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<AccessBlockedDetail | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleAccessBlocked = (event: Event) => {
      const customEvent = event as CustomEvent<AccessBlockedDetail>;
      setDetails(customEvent.detail || {});
      setIsOpen(true);
    };

    window.addEventListener("educare:access-blocked", handleAccessBlocked);
    return () => {
      window.removeEventListener("educare:access-blocked", handleAccessBlocked);
    };
  }, []);

  if (!isOpen) return null;

  const title = "Module Access Restricted";
  const message =
    details?.message ||
    "You do not have permission to access or perform operations on this module.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl text-slate-100 shadow-rose-950/50 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close icon button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Authorization Blocked</span>
          </div>
          <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
          <p className="text-xs text-rose-300/80 mt-1 font-mono break-all px-2">
            {details?.endpoint ? `Endpoint: ${details.endpoint}` : ""}
          </p>
        </div>

        {/* Body */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800 text-xs text-slate-300 leading-relaxed mb-6 text-center">
          <p>{message}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            If you need access to this feature, please contact your Super Administrator to update your module permissions.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/");
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
