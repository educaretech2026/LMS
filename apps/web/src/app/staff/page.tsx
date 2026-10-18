import { fetchApiServer } from "@/lib/api-server";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  try {
    const [data, centres, boards, standards, academicYears, roles, subjects] = await Promise.all([
      fetchApiServer<any[]>('/staff').catch(() => []),
      fetchApiServer<any[]>('/setup/centres').catch(() => []),
      fetchApiServer<any[]>('/setup/boards').catch(() => []),
      fetchApiServer<any[]>('/setup/standards').catch(() => []),
      fetchApiServer<any[]>('/setup/academic-years').catch(() => []),
      fetchApiServer<any[]>('/setup/roles').catch(() => []),
      fetchApiServer<any[]>('/setup/subjects').catch(() => [])
    ]);

    const staffArray = Array.isArray(data) ? data : [];
    const centresArray = Array.isArray(centres) ? centres : [];
    const boardsArray = Array.isArray(boards) ? boards : [];
    const standardsArray = Array.isArray(standards) ? standards : [];
    const yearsArray = Array.isArray(academicYears) ? academicYears : [];
    const rolesArray = Array.isArray(roles) ? roles : [];
    const subjectsArray = Array.isArray(subjects) ? subjects : [];
    
    const mapped = staffArray.map(user => {
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
        empId: `EMP-${user.id ? user.id.substring(0,4) : '0000'}`,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff Member',
        email: user.email || '',
        phone: profile?.phone || 'N/A',
        role: user.role?.name || 'Unknown',
        centre: centre,
        assignments,
        createdAt: user.createdAt || new Date().toISOString(),
        status: (user.status === 'ACTIVE' ? 'Active' : 'Inactive') as "Active" | "Inactive",
      };
    });

    const config = {
      centres: centresArray.map(c => c.name).filter(Boolean),
      boards: boardsArray.map(b => b.name).filter(Boolean),
      classes: standardsArray.map(s => {
        const primaryBoard = boardsArray.find(b => b.id === s.boardId)?.name || "";
        const clubbedBoardNames = (s.boards || []).map((sb: any) => sb.board?.name || boardsArray.find(b => b.id === sb.boardId)?.name).filter(Boolean);
        const allBoards = Array.from(new Set([primaryBoard, ...clubbedBoardNames].filter(Boolean)));
        return {
          id: s.id,
          name: s.name,
          board: primaryBoard,
          boards: allBoards
        };
      }),
      subjects: subjectsArray.map((sub: any) => sub.name).filter(Boolean),
      academicYears: yearsArray.map(y => y.name).filter(Boolean),
      roles: rolesArray.map(r => r.name).filter(Boolean)
    };

    return <StaffClient initialStaffList={mapped} config={config} />;
  } catch (error) {
    console.error('Error rendering StaffPage:', error);
    return (
      <StaffClient 
        initialStaffList={[]} 
        config={{ centres: [], boards: [], classes: [], subjects: [], academicYears: [], roles: [] }} 
      />
    );
  }
}
