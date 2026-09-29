import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { getUserFromToken } from "@/lib/auth-server";

import { fetchApiServer } from "@/lib/api-server";

export default async function Home() {
  const user = await getUserFromToken();
  let adminStats = null;

  if (user?.role !== 'STUDENT') {
    adminStats = await fetchApiServer('/report/dashboard').catch(() => null);
  }

  return (
    <DashboardLayout title="Dashboard" role={user?.role}>
      {user?.role === 'STUDENT' ? (
        <StudentDashboard user={user} />
      ) : (
        <AdminDashboard user={user} statsData={adminStats} />
      )}
    </DashboardLayout>
  );
}
