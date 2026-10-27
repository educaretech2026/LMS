"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, X, Check, RotateCcw, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { MODULE_PERMISSIONS, ModulePermissionDefinition } from "@/lib/permissions";
import { fetchApi } from "@/lib/api";

interface UserAccessModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UserAccessModal({
  userId,
  userName,
  userEmail,
  userRole,
  isOpen,
  onClose,
}: UserAccessModalProps) {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [defaultModules, setDefaultModules] = useState<string[]>([]);
  const [isCustomized, setIsCustomized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    setIsLoading(true);
    setMessage(null);

    fetchApi<{
      userId: string;
      role: string;
      defaultModules: string[];
      customModules: string[] | null;
      isCustomized: boolean;
    }>(`/users/${userId}/module-access`)
      .then((res) => {
        const defaults = res.defaultModules || [];
        setDefaultModules(defaults);
        if (res.customModules && Array.isArray(res.customModules)) {
          setSelectedModules(res.customModules);
          setIsCustomized(true);
        } else {
          // If no custom override exists yet, start with role defaults
          setSelectedModules(defaults.length > 0 ? defaults : MODULE_PERMISSIONS.map((m) => m.key));
          setIsCustomized(false);
        }
      })
      .catch((err) => {
        setMessage({
          type: "error",
          text: err?.message || "Failed to load user access permissions.",
        });
        setSelectedModules(MODULE_PERMISSIONS.map((m) => m.key));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const toggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedModules(MODULE_PERMISSIONS.map((m) => m.key));
  };

  const handleDeselectAll = () => {
    setSelectedModules([]);
  };

  const handleResetDefaults = () => {
    setSelectedModules(defaultModules);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await fetchApi(`/users/${userId}/module-access`, {
        method: "PUT",
        body: JSON.stringify({
          modules: selectedModules,
        }),
      });

      setIsCustomized(true);
      setMessage({
        type: "success",
        text: "User permissions updated successfully. The changes take effect immediately.",
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to update permissions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Group modules by category
  const categories = Array.from(new Set(MODULE_PERMISSIONS.map((m) => m.category)));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  User Module Access Control
                </h2>
                {isCustomized ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Sparkles className="w-3 h-3" />
                    Customized
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    Role Defaults
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target User: <span className="font-semibold text-slate-200">{userName}</span> ({userEmail}) • Role:{" "}
                <span className="font-semibold text-blue-400">{userRole}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            Enabled: <strong className="text-white">{selectedModules.length}</strong> of {MODULE_PERMISSIONS.length} modules
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Deselect All
            </button>
            {defaultModules.length > 0 && (
              <button
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Reset to default permissions configured for this user's role"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Role</span>
              </button>
            )}
          </div>
        </div>

        {/* Alert / Feedback message */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs font-medium border-b shrink-0 flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/20 text-rose-300"
            }`}
          >
            {message.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Module List Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span>Loading access policies...</span>
            </div>
          ) : (
            categories.map((category) => {
              const categoryModules = MODULE_PERMISSIONS.filter((m) => m.category === category);
              return (
                <div key={category} className="space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {categoryModules.map((module) => {
                      const isChecked = selectedModules.includes(module.key);
                      return (
                        <div
                          key={module.key}
                          onClick={() => toggleModule(module.key)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? "bg-blue-600/10 border-blue-500/40 text-white"
                              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          {/* Custom Toggle Box */}
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isChecked
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "bg-slate-900 border-slate-700"
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{module.label}</span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                {module.key}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                              {module.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400">
            Unchecking a module immediately hides it from the user&apos;s sidebar and blocks API access.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Permissions</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
