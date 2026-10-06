"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { Settings, ShieldCheck } from "lucide-react";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    centreName: "",
    contactEmail: "",
    contactPhone: "",
    currentYear: ""
  });

  useEffect(() => {
    if (role === 'TEACHER' || role === 'STUDENT') return;
    fetchApi("/setup/settings")
      .then(data => {
        if (data) setSettings(data as any);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);
  
  if (role === 'TEACHER' || role === 'STUDENT') {
    return (
      <DashboardLayout title="Settings">
        <div className="flex h-[60vh] items-center justify-center flex-col text-center">
          <ShieldCheck className="h-16 w-16 text-brand-red/50 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">You do not have permission to view the settings area. This section is restricted to administrators.</p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi("/setup/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      alert("Settings saved successfully!");
    } catch (e) {
      alert("Failed to save settings");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <DashboardLayout title="Settings">
      <PageShell title="Settings" subtitle="Configure your LMS preferences" icon={Settings} accentColor="blue">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-xl border border-border-soft shadow-sm">
              <div className="px-5 py-3 border-b border-border-soft">
                <h3 className="text-sm font-semibold text-text-primary">General</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Centre Name</label>
                  <input name="centreName" value={settings.centreName} onChange={handleChange} placeholder="Educare Kalathipady" className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Contact Email</label>
                  <input name="contactEmail" value={settings.contactEmail} onChange={handleChange} placeholder="admin@educare.com" className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Contact Phone</label>
                  <input name="contactPhone" value={settings.contactPhone} onChange={handleChange} placeholder="+91 00000 00000" className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border-soft shadow-sm">
              <div className="px-5 py-3 border-b border-border-soft">
                <h3 className="text-sm font-semibold text-text-primary">Academic Year</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Current Year</label>
                  <input name="currentYear" value={settings.currentYear} onChange={handleChange} placeholder="2026-2027" className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button disabled={saving} onClick={handleSave} className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </PageShell>
    </DashboardLayout>
  );
}
