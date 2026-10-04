import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { getUserFromToken } from "@/lib/auth-server";
import { fetchApiServer } from "@/lib/api-server";

export default async function Home() {
  const user = await getUserFromToken();
  let adminStats: any = null;
  let teacherStats: any = null;
  let liveClasses: any[] = [];
  let notices: any[] = [];

  if (user?.role === 'STUDENT') {
    liveClasses = (await fetchApiServer('/live-class').catch(() => [])) as any[];
  } else if (user?.role === 'TEACHER') {
    teacherStats = await fetchApiServer('/report/teacher-dashboard').catch(() => null);
  } else if (user?.role !== 'STUDENT') {
    adminStats = await fetchApiServer('/report/dashboard').catch(() => null);
  }

  if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
    notices = (await fetchApiServer('/notices?activeOnly=true').catch(() => [])) as any[];
  }

  return (
    <DashboardLayout title="Dashboard" role={user?.role}>
      {user?.role === 'STUDENT' ? (
        <StudentDashboard user={user} liveClasses={liveClasses} notices={notices} />
      ) : user?.role === 'TEACHER' ? (
        <TeacherDashboard user={user} stats={teacherStats} notices={notices} />
      ) : (
        <AdminDashboard user={user} statsData={adminStats} />
      )}
    </DashboardLayout>
  );
}
