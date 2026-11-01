"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import {
  Settings,
  ShieldCheck,
  Webhook,
  Key,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Code2,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import Link from "next/link";

interface IntegrationCredentials {
  id: string;
  name: string;
  apiKey: string;
  webhookSecret: string;
  isActive: boolean;
  totalRequests: number;
  lastUsedAt: string | null;
  createdAt: string;
  centre?: { id: string; name: string; code: string };
}

interface WebhookLogItem {
  id: string;
  event: string;
  status: string;
  statusCode: number;
  crmId?: string;
  studentName?: string;
  studentEmail?: string;
  admissionNo?: string;
  errorMessage?: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "integrations">("general");

  // General settings state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    centreName: "",
    contactEmail: "",
    contactPhone: "",
    currentYear: "",
  });

  // Integration credentials & logs state
  const [credentials, setCredentials] = useState<IntegrationCredentials | null>(null);
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (role === "TEACHER" || role === "STUDENT") return;
    fetchApi("/setup/settings")
      .then((data) => {
        if (data) setSettings(data as any);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  const loadIntegrationData = async () => {
    setLoadingCredentials(true);
    try {
      const [credsRes, logsRes]: [any, any] = await Promise.all([
        fetchApi("/integrations/credentials"),
        fetchApi("/integrations/logs?limit=20").catch(() => []),
      ]);
      if (credsRes) setCredentials(credsRes);
      if (Array.isArray(logsRes)) setLogs(logsRes);
    } catch (err) {
      console.error("Failed to load integration credentials:", err);
    } finally {
      setLoadingCredentials(false);
    }
  };

  useEffect(() => {
    if (activeTab === "integrations") {
      loadIntegrationData();
    }
  }, [activeTab]);

  if (role === "TEACHER" || role === "STUDENT") {
    return (
      <DashboardLayout title="Settings">
        <div className="flex h-[60vh] items-center justify-center flex-col text-center">
          <ShieldCheck className="h-16 w-16 text-brand-red/50 mb-4" />
          <h2 className="text-xl font-bold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted mt-2 max-w-md">
            You do not have permission to view the settings area. This section is restricted to administrators.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi("/setup/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
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
    setSettings((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerate = async () => {
    if (!credentials?.id) return;
    const confirmed = window.confirm(
      "Are you sure you want to regenerate the API Key and Webhook Secret? Any existing CRM dispatches using the old credentials will fail immediately."
    );
    if (!confirmed) return;

    setRegenerating(true);
    try {
      const res: any = await fetchApi(`/integrations/credentials/${credentials.id}/regenerate`, {
        method: "POST",
      });
      if (res) {
        setCredentials(res);
        alert("API Key & Webhook Secret regenerated successfully!");
      }
    } catch (err) {
      alert("Failed to regenerate credentials");
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  const webhookEndpoint =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:3001/api/webhooks/crm/admissions"
      : "https://api.educarelearning.in/api/webhooks/crm/admissions";

  const samplePayload = JSON.stringify(
    {
      event: "student.enrolled",
      data: {
        crmEnquiryId: "CRM-ENQ-1049",
        studentName: "John Doe",
        email: "student@example.com",
        phone: "+91 9876543210",
        parentName: "Jane Doe",
        parentPhone: "+91 9876543210",
        centre: "Main Campus",
        board: "CBSE",
        standard: "Class 10",
        academicYear: "2025-2026",
      },
    },
    null,
    2
  );

  return (
    <DashboardLayout title="Settings">
      <PageShell
        title="Settings & Integrations"
        subtitle="Manage LMS preferences, API credentials, and external webhook automation"
        icon={Settings}
        accentColor="blue"
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border-soft mb-6">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "general"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Settings className="h-4 w-4" /> General Settings
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "integrations"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Webhook className="h-4 w-4" /> CRM Integration & API Keys
          </button>
        </div>

        {activeTab === "general" ? (
          loading ? (
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
                  {role !== "SUPER_ADMIN" && (
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                        Centre Name
                      </label>
                      <input
                        name="centreName"
                        value={settings.centreName}
                        onChange={handleChange}
                        placeholder="Educare Kalathipady"
                        className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Contact Email
                    </label>
                    <input
                      name="contactEmail"
                      value={settings.contactEmail}
                      onChange={handleChange}
                      placeholder="admin@educare.com"
                      className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      name="contactPhone"
                      value={settings.contactPhone}
                      onChange={handleChange}
                      placeholder="+91 00000 00000"
                      className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-border-soft shadow-sm">
                <div className="px-5 py-3 border-b border-border-soft">
                  <h3 className="text-sm font-semibold text-text-primary">Academic Year</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                      Current Year
                    </label>
                    <input
                      name="currentYear"
                      value={settings.currentYear}
                      onChange={handleChange}
                      placeholder="2026-2027"
                      className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={saving}
                  onClick={handleSave}
                  className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          )
        ) : (
          /* CRM Integration Tab */
          <div className="max-w-4xl space-y-6">
            {/* Quick Actions Header */}
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Webhook className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-purple-950">External CRM Webhook Dispatch</h3>
                  <p className="text-xs text-purple-700">
                    Push student admissions automatically when enquiries reach ENROLLED or opportunities reach WON in your CRM.
                  </p>
                </div>
              </div>
              <Link
                href="/crm-admissions"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm"
              >
                View Dispatched Feed <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {loadingCredentials ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <>
                {/* Endpoint & Security Credentials Card */}
                <div className="bg-white rounded-xl border border-border-soft shadow-sm divide-y divide-border-soft">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">Webhook Endpoint & Authentication</h3>
                      <p className="text-xs text-text-muted">Target URL and API credentials for your CRM integration</p>
                    </div>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-soft bg-surface-2 hover:bg-white text-text-secondary transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                      Regenerate Keys
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Webhook URL */}
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Webhook Target URL (POST)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={webhookEndpoint}
                          className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 font-mono text-xs text-text-primary focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(webhookEndpoint, "endpoint")}
                          className="h-9 px-3 rounded-lg border border-border-soft bg-white hover:bg-surface-2 text-text-secondary text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === "endpoint" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        API Key Header (<code className="text-purple-700">X-API-Key</code>)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={credentials?.apiKey || "Loading..."}
                          className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 font-mono text-xs text-text-primary focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(credentials?.apiKey || "", "api-key")}
                          className="h-9 px-3 rounded-lg border border-border-soft bg-white hover:bg-surface-2 text-text-secondary text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === "api-key" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Webhook Secret */}
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Webhook Signing Secret (<code className="text-purple-700">X-Webhook-Signature</code> HMAC SHA-256)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          type={showSecret ? "text" : "password"}
                          value={credentials?.webhookSecret || "Loading..."}
                          className="w-full h-9 rounded-lg border border-border-soft bg-surface-2 px-3 font-mono text-xs text-text-primary focus:outline-none"
                        />
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="h-9 px-3 rounded-lg border border-border-soft bg-white hover:bg-surface-2 text-text-secondary text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(credentials?.webhookSecret || "", "secret")}
                          className="h-9 px-3 rounded-lg border border-border-soft bg-white hover:bg-surface-2 text-text-secondary text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          {copiedKey === "secret" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </button>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        Educare LMS verifies the <code className="font-mono">X-Webhook-Signature</code> header using HMAC SHA-256 with this secret key over the raw JSON payload.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dispatch Instructions & Code Snippets */}
                <div className="bg-white rounded-xl border border-border-soft shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-text-primary">CRM Webhook Dispatch Implementation</h3>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed">
                    Configure your CRM dispatcher to calculate an HMAC SHA-256 digest of the JSON payload using your webhook secret, and send it with the request:
                  </p>

                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-x-auto space-y-2">
                    <div className="text-slate-400">// Node.js / TypeScript Webhook Dispatcher (with Anti-Replay Protection)</div>
                    <div>
                      {`const crypto = require('crypto');
const axios = require('axios');

const payload = ${samplePayload};

const timestamp = Math.floor(Date.now() / 1000);
const rawBody = JSON.stringify(payload);

// Compute HMAC SHA-256 signature
const signature = crypto
  .createHmac('sha256', '${credentials?.webhookSecret || "YOUR_WEBHOOK_SECRET"}')
  .update(rawBody)
  .digest('hex');

await axios.post('${webhookEndpoint}', payload, {
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${credentials?.apiKey || "YOUR_API_KEY"}',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': String(timestamp)
  }
});`}
                    </div>
                  </div>
                </div>

                {/* Recent Webhook Delivery Activity Logs */}
                <div className="bg-white rounded-xl border border-border-soft shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between bg-surface-2/40">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-text-muted" />
                      <h3 className="text-sm font-bold text-text-primary">Recent Webhook Activity Logs</h3>
                    </div>
                    <button
                      onClick={loadIntegrationData}
                      className="text-xs text-brand-blue hover:underline font-semibold"
                    >
                      Refresh Logs
                    </button>
                  </div>

                  {logs.length === 0 ? (
                    <div className="py-10 text-center text-text-muted text-xs">
                      No webhook activity recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-surface-2 text-text-secondary border-b border-border-soft uppercase tracking-wider text-[11px] font-semibold">
                            <th className="px-5 py-2.5">Time</th>
                            <th className="px-5 py-2.5">Status</th>
                            <th className="px-5 py-2.5">CRM ID</th>
                            <th className="px-5 py-2.5">Student</th>
                            <th className="px-5 py-2.5">Admission No</th>
                            <th className="px-5 py-2.5">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-surface-2/30">
                              <td className="px-5 py-3 text-text-muted font-mono text-[11px]">
                                {new Date(log.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                    log.status === "SUCCESS"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : log.status === "DUPLICATE_UPDATED"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {log.status} ({log.statusCode})
                                </span>
                              </td>
                              <td className="px-5 py-3 font-mono font-medium text-text-primary">
                                {log.crmId || "—"}
                              </td>
                              <td className="px-5 py-3 font-semibold text-text-primary">
                                {log.studentName || log.studentEmail || "—"}
                              </td>
                              <td className="px-5 py-3 font-mono text-brand-blue font-semibold">
                                {log.admissionNo || "—"}
                              </td>
                              <td className="px-5 py-3 text-text-muted text-[11px]">
                                {log.errorMessage || "Dispatched successfully"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </PageShell>
    </DashboardLayout>
  );
}
