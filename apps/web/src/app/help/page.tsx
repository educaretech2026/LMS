import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageShell } from "@/components/layout/page-shell";
import { HelpCircle } from "lucide-react";
import { HelpClient } from "./help-client";
import { cookies } from "next/headers";

export default async function HelpPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("AccessToken")?.value;
  let role = "";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      role = payload.role;
    } catch(e) {}
  }

  return (
    <DashboardLayout title="Help">
      <PageShell title="Help & Support" subtitle="Documentation, guides and contact support" icon={HelpCircle} accentColor="blue">
        <HelpClient role={role} />
      </PageShell>
    </DashboardLayout>
  );
}
