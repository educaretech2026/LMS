import { fetchApiServer } from "@/lib/api-server";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const [data, centres, boards, standards, academicYears, roles, subjects] = await Promise.all([
    fetchApiServer<any[]>('/staff'),
    fetchApiServer<any[]>('/setup/centres'),
    fetchApiServer<any[]>('/setup/boards'),
    fetchApiServer<any[]>('/setup/standards'),
    fetchApiServer<any[]>('/setup/academic-years'),
    fetchApiServer<any[]>('/setup/roles'),
    fetchApiServer<any[]>('/setup/subjects').catch(() => [])
  ]);
  
  const mapped = data.map(user => {
    const profile = user.teacherProfile;
    const centre = user.userCentres?.[0]?.centre?.name || 'N/A';
    const assignments = (profile?.assignments || []).map((a: any) => ({
      id: a.id,
      academicYear: a.academicYearName || a.academicYear?.name || '',
      board: a.boardName || a.board?.name || '',
      classLevel: a.combinedClasses || a.standard?.name || '',
      division: a.division || 'Division A',
      subject: a.subjectName || a.subject?.name || '',
      isCombined: a.isCombined || false,
      classes: a.combinedClasses 
        ? a.combinedClasses.split(',').map((c: string) => c.trim()).filter(Boolean)
        : (a.standard?.name ? [a.standard.name] : [])
    }));

    return {
      id: user.id,
      empId: `EMP-${user.id.substring(0,4)}`,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: profile?.phone || 'N/A', // teacher profile might have phone
      role: user.role?.name || 'Unknown',
      centre: centre,
      assignments,
      createdAt: user.createdAt || new Date().toISOString(),
      status: (user.status === 'ACTIVE' ? 'Active' : 'Inactive') as "Active" | "Inactive",
    };
  });

  const config = {
    centres: (centres || []).map(c => c.name),
    boards: (boards || []).map(b => b.name),
    classes: (standards || []).map(s => {
      const primaryBoard = boards.find(b => b.id === s.boardId)?.name || "";
      const clubbedBoardNames = (s.boards || []).map((sb: any) => sb.board?.name || boards.find(b => b.id === sb.boardId)?.name).filter(Boolean);
      const allBoards = Array.from(new Set([primaryBoard, ...clubbedBoardNames].filter(Boolean)));
      return {
        id: s.id,
        name: s.name,
        board: primaryBoard,
        boards: allBoards
      };
    }),
    subjects: (subjects || []).map((sub: any) => sub.name),
    academicYears: (academicYears || []).map(y => y.name),
    roles: (roles || []).map(r => r.name)
  };

  return <StaffClient initialStaffList={mapped} config={config} />;
}
