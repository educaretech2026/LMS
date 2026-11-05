"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/providers/auth-provider";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { LiveClassHubV2, ApiLiveClass } from "@/components/live-class/live-class-hub-v2";
import { fetchApi } from "@/lib/api";

const LiveKitClassRoomV2 = dynamic(
  () => import("@/components/live-class/livekit-room-v2").then((m) => m.LiveKitClassRoomV2),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0b0c10] text-white gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs text-white/70 font-medium">Entering Virtual Classroom...</p>
      </div>
    ),
  }
);

export default function LiveClassPage() {
  const [mounted, setMounted] = useState(false);
  const [activeLiveRoom, setActiveLiveRoom] = useState<ApiLiveClass | null>(null);
  const { role, email, userId, name: authUserName } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const normalizedRole = role ? role.toUpperCase().replace(/\s+/g, '_') : '';

  // Stable identity for virtual classroom session to prevent unneeded token regeneration / room unmounting
  const stableIdentity = useMemo(() => {
    if (userId) return `user_${userId}`;
    if (email) return `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return `guest_${Math.random().toString(36).slice(2, 9)}`;
  }, [userId, email]);

  const handleJoin = useCallback((cls: ApiLiveClass) => {
    const rawLink = cls.roomId || "";
    const isZoom = rawLink.includes("zoom.us");
    const isGoogleMeet = rawLink.includes("meet.google.com");
    const isExplicitLiveClassRoute =
      typeof window !== "undefined" &&
      Boolean(new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("room"));

    // If navigated directly to /live-class or public webinar, prioritize the LiveKit interactive stage
    if (!isExplicitLiveClassRoute && (isZoom || isGoogleMeet || rawLink.startsWith("http://") || rawLink.startsWith("https://"))) {
      window.open(rawLink, "_blank");
    } else {
      setActiveLiveRoom(cls);
    }
  }, []);

  // Support ?room=... or ?id=... URL parameter for direct room entry
  useEffect(() => {
    if (typeof window === "undefined" || activeLiveRoom) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("id") || params.get("room");

      if (targetId) {
        // Always try public endpoint first for direct link / room entry
        fetchApi<ApiLiveClass>(`/live-class/public/${targetId}`, { silent: true })
          .then((pubCls) => {
            if (pubCls) handleJoin(pubCls);
          })
          .catch(() => {
            // Only fall back to authenticated cohort endpoint if public fetch fails
            fetchApi<ApiLiveClass>(`/live-class/${targetId}`, { silent: true })
              .then((cls) => {
                if (cls) handleJoin(cls);
              })
              .catch(() => {});
          });
      }
    } catch {}
  }, [activeLiveRoom, handleJoin]);

  const targetWebinarId =
    activeLiveRoom?.id ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("room")
      : null);

  const hasWebinarCredential = useMemo(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    if (p.get("pass") || p.get("regToken")) return true;
    if (targetWebinarId) {
      try {
        const stored = localStorage.getItem(`live_access_${targetWebinarId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.passportToken || parsed?.registrationToken) return true;
        }
      } catch {}
    }
    return false;
  }, [targetWebinarId]);

  const attendeeName = useMemo(() => {
    if (typeof window === "undefined") return "Attendee";
    const p = new URLSearchParams(window.location.search);
    const qName = p.get("name");
    if (qName) return qName;
    if (targetWebinarId) {
      try {
        const stored = localStorage.getItem(`live_access_${targetWebinarId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.name) return parsed.name;
        }
      } catch {}
    }
    return authUserName || (email ? email.split("@")[0] : "Attendee");
  }, [targetWebinarId, authUserName, email]);

  const isStaffHost = ["TEACHER", "SUPER_ADMIN", "CENTRE_ADMIN", "ADMIN"].includes(normalizedRole);

  const isDirectWebinarEntry =
    mounted &&
    Boolean(
      activeLiveRoom?.isPublic ||
      (typeof window !== "undefined" &&
        (new URLSearchParams(window.location.search).get("regToken") ||
          new URLSearchParams(window.location.search).get("pass") ||
          (() => {
            const p = new URLSearchParams(window.location.search);
            const tid = p.get("id") || p.get("room");
            return tid && localStorage.getItem(`live_access_${tid}`);
          })()))
    );

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#06080f] text-white gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-xs text-white/70 font-medium">Entering Classroom...</p>
      </div>
    );
  }

  // First-Page Entry Gate: Require unauthenticated public attendees to register on the landing page first
  if (activeLiveRoom?.isPublic && !isStaffHost && !hasWebinarCredential) {
    return (
      <div className="fixed inset-0 z-50 bg-[#06080f] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="max-w-md w-full bg-[#121624] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Registration Required</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              This webinar session is reserved for registered attendees. Please complete the quick entry form on the welcome page to enter.
            </p>
          </div>
          <a
            href={`/live/${encodeURIComponent(activeLiveRoom.id)}`}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 text-decoration-none"
          >
            Register for Free Access
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {!activeLiveRoom ? (
        isDirectWebinarEntry ? (
          <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#06080f] text-white gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-xs text-white/70 font-medium">Entering Webinar Stage...</p>
          </div>
        ) : (
          <DashboardLayout title="Live Class">
            <LiveClassHubV2 onJoinRoom={handleJoin} />
          </DashboardLayout>
        )
      ) : (
        <div className="fixed inset-0 z-50 bg-[#0b0c10] flex flex-col h-[100dvh] overflow-hidden">
          <LiveKitClassRoomV2
            classId={activeLiveRoom.id}
            roomId={
              activeLiveRoom.roomId && !activeLiveRoom.roomId.startsWith("http")
                ? activeLiveRoom.roomId
                : activeLiveRoom.id
            }
            identity={stableIdentity}
            name={
              isStaffHost
                ? (activeLiveRoom.teacherName || authUserName || "Presenter")
                : (isDirectWebinarEntry ? attendeeName : (authUserName || (email ? email.split("@")[0] : "Student")))
            }
            role={
              isStaffHost
                ? (normalizedRole || "TEACHER")
                : (isDirectWebinarEntry ? "PUBLIC_LEARNER" : (normalizedRole || "STUDENT"))
            }
            isWebinar={Boolean(activeLiveRoom.isPublic)}
            classTitle={activeLiveRoom.title}
            subject={activeLiveRoom.subject}
            teacherName={activeLiveRoom.teacherName}
            backgroundImageUrl={activeLiveRoom.backgroundImageUrl || undefined}
            onLeave={() => {
              if (isDirectWebinarEntry && !isStaffHost) {
                window.location.href = `/live/${activeLiveRoom.id}`;
              } else {
                setActiveLiveRoom(null);
              }
            }}
          />
        </div>
      )}
    </>
  );
}
