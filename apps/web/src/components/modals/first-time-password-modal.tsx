"use client";

import { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchApi } from "@/lib/api";

export function FirstTimePasswordModal() {
  const { mustChangePassword, setMustChangePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!mustChangePassword) return null;

  const isMinLength = newPassword.length >= 8;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && isMinLength && isMatch && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsLoading(true);

    try {
      await fetchApi("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setIsSuccess(true);
      setTimeout(() => {
        setMustChangePassword(false);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please check your current password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-6 md:p-8 shadow-2xl text-slate-100 shadow-amber-950/40 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-time-pwd-title"
      >
        {isSuccess ? (
          <div className="py-8 text-center flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Password Set Successfully</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Your new password is now active. Unlocking your LMS dashboard...
            </p>
          </div>
        ) : (
          <>
            {/* Security Badge Icon */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <KeyRound className="w-7 h-7" />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Security Requirement</span>
              </div>
              <h2 id="first-time-pwd-title" className="text-xl font-bold tracking-tight text-white">
                Set Your Personal Password
              </h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Your account was initialized with a temporary system password. You must establish your own confidential password before accessing the system.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current / Default Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Secure Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div
                    className={`w-2 h-2 rounded-full transition-colors ${
                      isMinLength ? "bg-emerald-400" : "bg-slate-700"
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      isMinLength ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    At least 8 characters
                  </span>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl bg-slate-950/70 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div
                      className={`w-2 h-2 rounded-full transition-colors ${
                        isMatch ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span
                      className={`text-[11px] ${
                        isMatch ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isMatch ? "Passwords match" : "Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Save Password & Access LMS</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
