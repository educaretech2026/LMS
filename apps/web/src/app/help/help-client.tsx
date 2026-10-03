"use client";

import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/api";
import { BookOpen, ExternalLink, HelpCircle, MessageSquare, Send, CheckCircle2, Ticket, Image as ImageIcon, X } from "lucide-react";

export function HelpClient({ role }: { role?: string }) {
  const [activeTab, setActiveTab] = useState<"options" | "ticket" | "my-tickets">("options");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (activeTab === "my-tickets") {
      fetchTickets();
    }
  }, [activeTab]);

  const fetchTickets = async () => {
    try {
      const data = await fetchApi(role === 'SUPER_ADMIN' || role === 'CENTRE_ADMIN' ? '/support/tickets' : '/support/tickets/me');
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch tickets", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;
    setLoading(true);
    try {
      await fetchApi("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, description, imageUrl }),
      });
      setMessage("Ticket created successfully! We will get back to you soon.");
      setSubject("");
      setDescription("");
      setImageUrl("");
      setTimeout(() => {
        setMessage("");
        setActiveTab("my-tickets");
      }, 2000);
    } catch (err: any) {
      alert(err.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { uploadUrl, finalUrl } = (await fetchApi(`/storage/presigned-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)) as any;
      
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image");
      setImageUrl(finalUrl);
    } catch (err: any) {
      alert(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetchApi(`/support/tickets/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      fetchTickets();
    } catch (err) {
      console.error(err);
    }
  };

  if (activeTab === "options") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
        <div 
          onClick={() => setActiveTab("ticket")}
          className="bg-white rounded-xl border border-border-soft p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="h-10 w-10 rounded-lg bg-brand-blue/8 flex items-center justify-center mb-4">
            <MessageSquare className="h-5 w-5 text-brand-blue" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">Create Support Ticket</p>
          <p className="text-xs text-text-muted leading-relaxed mb-4">Open a new ticket and our support team will help you resolve your issue.</p>
          <p className="text-xs font-semibold text-brand-blue group-hover:underline">Open Ticket →</p>
        </div>

        <div 
          onClick={() => setActiveTab("my-tickets")}
          className="bg-white rounded-xl border border-border-soft p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="h-10 w-10 rounded-lg bg-brand-blue/8 flex items-center justify-center mb-4">
            <Ticket className="h-5 w-5 text-brand-blue" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">{role === 'SUPER_ADMIN' || role === 'CENTRE_ADMIN' ? 'Manage Tickets' : 'My Tickets'}</p>
          <p className="text-xs text-text-muted leading-relaxed mb-4">View the status of your existing support tickets.</p>
          <p className="text-xs font-semibold text-brand-blue group-hover:underline">View Tickets →</p>
        </div>

        <div className="bg-white rounded-xl border border-border-soft p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="h-10 w-10 rounded-lg bg-brand-blue/8 flex items-center justify-center mb-4">
            <BookOpen className="h-5 w-5 text-brand-blue" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">Documentation</p>
          <p className="text-xs text-text-muted leading-relaxed mb-4">Read guides and how-to articles for every feature.</p>
          <p className="text-xs font-semibold text-brand-blue group-hover:underline">Browse Docs →</p>
        </div>

        <div className="bg-white rounded-xl border border-border-soft p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
          <div className="h-10 w-10 rounded-lg bg-brand-blue/8 flex items-center justify-center mb-4">
            <ExternalLink className="h-5 w-5 text-brand-blue" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">Release Notes</p>
          <p className="text-xs text-text-muted leading-relaxed mb-4">See what's new in the latest version of Educare LMS.</p>
          <p className="text-xs font-semibold text-brand-blue group-hover:underline">View Changelog →</p>
        </div>
      </div>
    );
  }

  if (activeTab === "ticket") {
    return (
      <div className="max-w-2xl bg-white border border-border-soft rounded-2xl shadow-sm p-6 lg:p-8 relative">
        <button 
          onClick={() => setActiveTab("options")}
          className="absolute top-6 right-6 text-sm font-bold text-text-muted hover:text-text-primary"
        >
          Back
        </button>
        <h2 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-blue" />
          Create Support Ticket
        </h2>

        {message ? (
          <div className="bg-green-50 text-green-700 p-6 rounded-xl text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="font-bold text-sm">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Subject</label>
              <input 
                required
                type="text"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full h-10 rounded-lg border border-border-soft bg-surface pl-3 pr-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Description</label>
              <textarea 
                required
                placeholder="Provide detailed information about the issue you're facing..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full h-32 rounded-lg border border-border-soft bg-surface p-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/20 resize-none"
              />
            </div>
            
            {/* Image Upload */}
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1.5">Screenshot (Optional)</label>
              {imageUrl ? (
                <div className="relative inline-block border border-border-soft rounded-lg overflow-hidden">
                  <img src={imageUrl} alt="Attached screenshot" className="h-32 object-contain" />
                  <button 
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center justify-center w-full h-20 rounded-lg border-2 border-dashed border-border-soft bg-surface-2 hover:bg-surface cursor-pointer transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex flex-col items-center gap-1 text-text-muted">
                    {uploadingImage ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-r-transparent" />
                    ) : (
                      <>
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-xs font-semibold">Click to upload image</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              )}
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-text-primary hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> : <Send className="h-4 w-4" />}
              Submit Ticket
            </button>
          </form>
        )}
      </div>
    );
  }

  if (activeTab === "my-tickets") {
    return (
      <div className="max-w-4xl bg-white border border-border-soft rounded-2xl shadow-sm overflow-hidden relative">
        <div className="px-6 py-5 border-b border-border-soft flex items-center justify-between bg-surface-2/50">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Ticket className="h-4 w-4 text-brand-blue" />
            {role === 'SUPER_ADMIN' || role === 'CENTRE_ADMIN' ? 'All Support Tickets' : 'My Support Tickets'}
          </h2>
          <button 
            onClick={() => setActiveTab("options")}
            className="text-xs font-bold text-text-muted hover:text-text-primary px-3 py-1.5 rounded-lg border border-border-soft bg-white"
          >
            Back to Help
          </button>
        </div>

        <div className="divide-y divide-border-soft">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No tickets found.</div>
          ) : (
            tickets.map(ticket => (
              <div key={ticket.id} className="p-6 hover:bg-surface-2 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{ticket.subject}</h3>
                    {(role === 'SUPER_ADMIN' || role === 'CENTRE_ADMIN') && ticket.user && (
                      <p className="text-xs text-text-muted mt-0.5">By: {ticket.user.firstName} {ticket.user.lastName} ({ticket.user.email})</p>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    ticket.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                    'bg-surface-2 text-text-muted border border-border-soft'
                  }`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-4">{ticket.description}</p>
                {ticket.imageUrl && (
                  <div className="mb-4">
                    <a href={ticket.imageUrl} target="_blank" rel="noreferrer">
                      <img src={ticket.imageUrl} alt="Screenshot" className="h-24 rounded border border-border-soft object-cover" />
                    </a>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4">
                  <p className="text-[10px] text-text-muted font-medium">
                    Created on {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                  
                  {(role === 'SUPER_ADMIN' || role === 'CENTRE_ADMIN') && ticket.status !== 'CLOSED' && (
                    <div className="flex items-center gap-2">
                      <select
                        value={ticket.status}
                        onChange={e => updateStatus(ticket.id, e.target.value)}
                        className="text-xs border border-border-soft rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}
