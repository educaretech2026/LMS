"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Trash2,
  X,
  MessagesSquare,
  ClipboardList,
  Award,
  Shield,
  AlertTriangle,
  AlertCircle,
  FileText,
  FileCheck,
  Sparkles,
  Clock,
  Layers,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchApi } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type CategoryTab = "ALL" | "UNREAD" | "DOUBTS" | "ASSIGNMENTS" | "SYSTEM";

export function NotificationBell() {
  const { role } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL");
  const [isOpen, setIsOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!role) return;
    try {
      const data = await fetchApi<NotificationItem[]>("/notifications");
      setNotifications(data || []);
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
  };

  // Poll every 15 seconds + on window focus
  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 15000);
    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [role]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Tab counts
  const tabCounts = useMemo(() => {
    const doubts = notifications.filter(
      (n) =>
        n.type === "DOUBT" ||
        n.type === "SUPERVISOR" ||
        n.title.toLowerCase().includes("doubt") ||
        n.message.toLowerCase().includes("doubt") ||
        (n.link && n.link.includes("/doubts"))
    );
    const assignments = notifications.filter(
      (n) =>
        n.type === "ASSIGNMENT" ||
        n.type === "SUBMISSION" ||
        n.type === "GRADE" ||
        n.title.toLowerCase().includes("assignment") ||
        n.message.toLowerCase().includes("assignment") ||
        (n.link && n.link.includes("/assignments"))
    );
    const system = notifications.filter(
      (n) =>
        !doubts.some((d) => d.id === n.id) &&
        !assignments.some((a) => a.id === n.id)
    );

    return {
      ALL: notifications.length,
      UNREAD: unreadCount,
      DOUBTS: doubts.length,
      ASSIGNMENTS: assignments.length,
      SYSTEM: system.length,
    };
  }, [notifications, unreadCount]);

  // Filtered notifications based on active tab
  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case "UNREAD":
        return notifications.filter((n) => !n.isRead);
      case "DOUBTS":
        return notifications.filter(
          (n) =>
            n.type === "DOUBT" ||
            n.type === "SUPERVISOR" ||
            n.title.toLowerCase().includes("doubt") ||
            n.message.toLowerCase().includes("doubt") ||
            (n.link && n.link.includes("/doubts"))
        );
      case "ASSIGNMENTS":
        return notifications.filter(
          (n) =>
            n.type === "ASSIGNMENT" ||
            n.type === "SUBMISSION" ||
            n.type === "GRADE" ||
            n.title.toLowerCase().includes("assignment") ||
            n.message.toLowerCase().includes("assignment") ||
            (n.link && n.link.includes("/assignments"))
        );
      case "SYSTEM":
        return notifications.filter(
          (n) =>
            n.type !== "DOUBT" &&
            n.type !== "SUPERVISOR" &&
            n.type !== "ASSIGNMENT" &&
            n.type !== "SUBMISSION" &&
            n.type !== "GRADE" &&
            !n.title.toLowerCase().includes("doubt") &&
            !n.title.toLowerCase().includes("assignment") &&
            (!n.link || (!n.link.includes("/doubts") && !n.link.includes("/assignments")))
        );
      case "ALL":
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  // Mark single notification as read
  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await fetchApi(`/notifications/${id}/read`, { method: "PATCH" });
    } catch (err) {
      fetchNotifications();
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (unreadCount === 0 || isActionLoading) return;

    setIsActionLoading(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetchApi("/notifications/mark-all-read", { method: "POST" });
    } catch (err) {
      fetchNotifications();
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete single notification
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await fetchApi(`/notifications/${id}`, { method: "DELETE" });
    } catch (err) {
      fetchNotifications();
    }
  };

  // Clear all read notifications
  const clearReadNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isActionLoading) return;

    setIsActionLoading(true);
    setNotifications((prev) => prev.filter((n) => !n.isRead));

    try {
      await fetchApi("/notifications/clear-read", { method: "DELETE" });
    } catch (err) {
      fetchNotifications();
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle notification click with auto-read and deep-linking
  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Context-aware metadata
  const getNotificationMeta = (notification: NotificationItem) => {
    const type = (notification.type || "").toUpperCase();
    const title = notification.title.toLowerCase();
    const link = (notification.link || "").toLowerCase();

    // 1. Doubts & Academic Chat
    if (type === "DOUBT" || title.includes("doubt") || link.includes("/doubts")) {
      return {
        icon: MessagesSquare,
        category: "Academic Q&A",
        badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
        iconBg: "bg-indigo-100 text-indigo-700",
      };
    }

    // 2. Supervisor Intervention
    if (type === "SUPERVISOR" || title.includes("supervisor")) {
      return {
        icon: Shield,
        category: "Supervisor",
        badgeBg: "bg-amber-50 text-amber-800 border-amber-300",
        iconBg: "bg-amber-100 text-amber-800",
      };
    }

    // 3. Graded Assignment
    if (type === "GRADE" || title.includes("graded")) {
      return {
        icon: Award,
        category: "Grades",
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        iconBg: "bg-emerald-100 text-emerald-700",
      };
    }

    // 4. Assignment Submissions
    if (type === "SUBMISSION" || title.includes("submitted")) {
      return {
        icon: CheckCheck,
        category: "Submission",
        badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
        iconBg: "bg-sky-100 text-sky-700",
      };
    }

    // 5. New Assignment
    if (type === "ASSIGNMENT" || title.includes("assignment")) {
      return {
        icon: ClipboardList,
        category: "Assignment",
        badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
        iconBg: "bg-blue-100 text-blue-700",
      };
    }

    // 6. Warnings / Late
    if (type === "WARNING" || title.includes("late")) {
      return {
        icon: AlertTriangle,
        category: "Alert",
        badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
        iconBg: "bg-amber-100 text-amber-700",
      };
    }

    // 7. Errors
    if (type === "ERROR") {
      return {
        icon: AlertCircle,
        category: "Urgent",
        badgeBg: "bg-red-50 text-red-700 border-red-200",
        iconBg: "bg-red-100 text-red-700",
      };
    }

    // 8. Forms
    if (type === "FORM" || title.includes("form")) {
      return {
        icon: FileCheck,
        category: "Form",
        badgeBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
        iconBg: "bg-cyan-100 text-cyan-700",
      };
    }

    // Default Notice / System
    return {
      icon: Bell,
      category: "Notice",
      badgeBg: "bg-slate-50 text-slate-700 border-slate-200",
      iconBg: "bg-slate-100 text-slate-700",
    };
  };

  // Smart relative time
  const formatTime = (dateString: string) => {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const hasReadItems = notifications.some((n) => n.isRead);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft bg-surface-2 text-text-secondary hover:bg-surface hover:border-brand-blue/30 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30" />
        }
      >
        <Bell className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-gradient-to-r from-brand-red to-rose-600 text-[9px] font-bold text-white shadow-xs ring-2 ring-white animate-in zoom-in">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[330px] sm:w-[380px] md:w-[410px] p-0 overflow-hidden border-border-soft shadow-2xl bg-white rounded-xl animate-in fade-in-50 zoom-in-95 duration-150"
      >
        {/* Panel Header */}
        <div className="px-4 py-3 bg-white border-b border-border-soft flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-text-primary text-sm tracking-tight flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-brand-red/10 text-brand-red">
                  {unreadCount} new
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1 text-xs">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isActionLoading}
                className="px-2 py-0.8 text-brand-blue hover:text-brand-blue-dark hover:bg-brand-blue/5 rounded font-medium transition-colors"
                title="Mark all notifications as read"
              >
                Mark all read
              </button>
            )}
            {hasReadItems && (
              <button
                onClick={clearReadNotifications}
                disabled={isActionLoading}
                className="px-2 py-0.8 text-text-muted hover:text-brand-red hover:bg-red-50 rounded font-medium transition-colors"
                title="Remove already read notifications"
              >
                Clear read
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs Bar */}
        <div className="flex items-center gap-1 px-3 py-2 bg-surface-2 border-b border-border-soft overflow-x-auto text-[11px] scrollbar-none">
          {(
            [
              { key: "ALL", label: "All", count: tabCounts.ALL },
              { key: "UNREAD", label: "Unread", count: tabCounts.UNREAD },
              { key: "DOUBTS", label: "Doubts", count: tabCounts.DOUBTS },
              { key: "ASSIGNMENTS", label: "Assignments", count: tabCounts.ASSIGNMENTS },
              { key: "SYSTEM", label: "System", count: tabCounts.SYSTEM },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(tab.key);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-brand-blue text-white shadow-xs"
                    : "bg-white text-text-secondary hover:bg-white/80 border border-border-soft"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded-full ${
                      active ? "bg-white/25 text-white" : "bg-surface-2 text-text-muted"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List Body */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border-soft bg-surface">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-text-muted flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-2.5">
                <Bell className="h-5 w-5 stroke-1" />
              </div>
              <p className="text-xs font-semibold text-text-primary">
                {activeTab === "UNREAD"
                  ? "All caught up!"
                  : activeTab === "DOUBTS"
                  ? "No doubt notifications"
                  : activeTab === "ASSIGNMENTS"
                  ? "No assignment updates"
                  : "No notifications right now"}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 max-w-[220px]">
                {activeTab === "UNREAD"
                  ? "You have read all academic and institutional updates."
                  : "New updates will appear here in real time."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const isUnread = !notification.isRead;
              const meta = getNotificationMeta(notification);
              const Icon = meta.icon;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`group relative flex items-start gap-3 p-3.5 hover:bg-white transition-all cursor-pointer ${
                    isUnread ? "bg-brand-blue/4" : "bg-surface"
                  }`}
                >
                  {/* Unread Accent Left Pill */}
                  {isUnread && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-brand-blue rounded-r" />
                  )}

                  {/* Icon Avatar */}
                  <div
                    className={`mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105 ${meta.iconBg}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${meta.badgeBg}`}
                        >
                          {meta.category}
                        </span>
                        <h4
                          className={`text-xs truncate ${
                            isUnread ? "font-bold text-text-primary" : "font-medium text-text-secondary"
                          }`}
                        >
                          {notification.title}
                        </h4>
                      </div>

                      <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>

                    {notification.link && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-brand-blue group-hover:underline">
                        <span>Open details</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {/* Hover Quick Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 self-center pl-1">
                    {isUnread && (
                      <button
                        onClick={(e) => markAsRead(notification.id, e)}
                        className="p-1 rounded text-text-muted hover:text-brand-blue hover:bg-surface-2 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteNotification(notification.id, e)}
                      className="p-1 rounded text-text-muted hover:text-brand-red hover:bg-rose-50 transition-colors"
                      title="Dismiss notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Status Footer */}
        <div className="px-4 py-2 bg-surface-2 border-t border-border-soft flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live sync active</span>
          </div>
          <span className="text-[10px]">
            {filteredNotifications.length} of {notifications.length} shown
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
