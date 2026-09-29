import { fetchApiServer } from "@/lib/api-server";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const data = await fetchApiServer<any[]>('/staff');
  
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

  return <StaffClient initialStaffList={mapped} />;
}
