import { Suspense } from "react";
import { fetchApiServer } from "@/lib/api-server";
import { StudentsClient } from "./students-client";

export default async function StudentsPage() {
  const data = await fetchApiServer<any[]>('/students').catch(() => []);
  
  const mapped = (Array.isArray(data) ? data : []).map(d => {
    const profile = d || {};
    const user = profile.user || {};
    const enrollment = profile.enrollments?.[0];
    const batch = enrollment?.batch;
    
    return {
      id: profile.id || '',
      admissionNo: profile.admissionNo || '',
      name: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
      email: user.email || '',
      phone: profile.parentPhone || '',
      status: user.status || 'ACTIVE',
      parentName: profile.parentName || '',
      parentEmail: profile.parentEmail || '',
      parentPhone: profile.parentPhone || '',
      academicYear: batch?.academicYear?.name || 'N/A',
      board: batch?.board?.name || 'N/A',
      classLevel: batch?.standard?.name || 'N/A',
      centre: batch?.centre?.name || 'N/A',
      division: batch?.name || 'N/A',
      trackId: enrollment?.trackId || '',
      trackName: enrollment?.track?.name || 'Any',
      subjectIds: enrollment?.subjects?.map((s: any) => s.id) || [],
      dateOfBirth: profile.dateOfBirth || '',
      bloodGroup: profile.bloodGroup || '',
      address: profile.address || '',
      createdAt: profile.createdAt || new Date().toISOString(),
    };
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StudentsClient initialStudents={mapped} />
    </Suspense>
  );
}
