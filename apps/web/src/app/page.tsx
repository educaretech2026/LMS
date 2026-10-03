import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { getUserFromToken } from "@/lib/auth-server";
import { fetchApiServer } from "@/lib/api-server";

export default async function Home() {
  const user = await getUserFromToken();
  let adminStats = null;
  let teacherStats = null;

  if (user?.role === 'TEACHER') {
    teacherStats = await fetchApiServer('/report/teacher-dashboard').catch(() => null);
  } else if (user?.role !== 'STUDENT') {
    adminStats = await fetchApiServer('/report/dashboard').catch(() => null);
  }

  return (
    <DashboardLayout title="Dashboard" role={user?.role}>
      {user?.role === 'STUDENT' ? (
        <StudentDashboard user={user} />
      ) : user?.role === 'TEACHER' ? (
        <TeacherDashboard user={user} stats={teacherStats} />
      ) : (
        <AdminDashboard user={user} statsData={adminStats} />
      )}
    </DashboardLayout>
  );
}
