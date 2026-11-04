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
  const [activeLiveRoom, setActiveLiveRoom] = useState<ApiLiveClass | null>(null);
  const { role, email, userId, name: authUserName } = useAuth();

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

    if (isZoom || isGoogleMeet || rawLink.startsWith("http://") || rawLink.startsWith("https://")) {
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
      const targetRoom = params.get("room") || params.get("id");
      if (targetRoom) {
        fetchApi<ApiLiveClass>(`/live-class/${targetRoom}`, { silent: true })
          .then((cls) => {
            if (cls) handleJoin(cls);
          })
          .catch(() => {
            fetchApi<ApiLiveClass>(`/live-class/public/${targetRoom}`, { silent: true })
              .then((pubCls) => {
                if (pubCls) handleJoin(pubCls);
              })
              .catch(() => {});
          });
      }
    } catch {}
  }, [activeLiveRoom, handleJoin]);

  return (
    <>
      {!activeLiveRoom ? (
        <DashboardLayout title="Live Class">
          <LiveClassHubV2 onJoinRoom={handleJoin} />
        </DashboardLayout>
      ) : (
        <div className="fixed inset-0 z-50 bg-[#0b0c10] flex flex-col h-[100dvh] overflow-hidden">
          <LiveKitClassRoomV2
            classId={activeLiveRoom.id}
            roomId={activeLiveRoom.roomId || activeLiveRoom.id}
            identity={stableIdentity}
            name={
              normalizedRole === "TEACHER"
                ? (activeLiveRoom.teacherName || authUserName || "Teacher")
                : (authUserName || (email ? email.split("@")[0] : "Student"))
            }
            role={normalizedRole || "STUDENT"}
            onLeave={() => setActiveLiveRoom(null)}
          />
        </div>
      )}
    </>
  );
}
