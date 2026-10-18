"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProfileClient } from "./profile-client";

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <ProfileClient />
    </DashboardLayout>
  );
}
