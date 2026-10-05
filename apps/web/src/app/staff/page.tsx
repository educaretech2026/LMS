import { fetchApiServer } from "@/lib/api-server";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const [data, centres, boards, standards, academicYears] = await Promise.all([
    fetchApiServer<any[]>('/staff'),
    fetchApiServer<any[]>('/setup/centres'),
    fetchApiServer<any[]>('/setup/boards'),
    fetchApiServer<any[]>('/setup/standards'),
    fetchApiServer<any[]>('/setup/academic-years')
  ]);
  
  const mapped = data.map(user => {
    const profile = user.teacherProfile;
    const centre = user.userCentres?.[0]?.centre?.name || 'N/A';
    return {
      id: user.id,
      empId: `EMP-${user.id.substring(0,4)}`,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: profile?.phone || 'N/A', // teacher profile might have phone
      role: user.role?.name === 'CENTRE_ADMIN' ? 'Admin' : 'Teacher',
      centre: centre,
      createdAt: user.createdAt || new Date().toISOString(),
      status: (user.status === 'ACTIVE' ? 'Active' : 'Inactive') as "Active" | "Inactive",
    };
  });

  const config = {
    centres: centres.map(c => c.name),
    boards: boards.map(b => b.name),
    classes: standards.map(s => s.name),
    academicYears: academicYears.map(y => y.name)
  };

  return <StaffClient initialStaffList={mapped} config={config} />;
}
