import { fetchApiServer } from "@/lib/api-server";
import { IdCardClient } from "./id-card-client";

export default async function IdCardPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const student = await fetchApiServer<any>(`/students/${resolvedParams.id}`);
    
    const user = student.user || {};
    const enrollment = student.enrollments?.[0];
    const batch = enrollment?.batch;
    const academicYear = batch?.academicYear;

    const validUntil = academicYear?.endDate 
      ? new Date(academicYear.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      : undefined;

    const mappedStudent = {
      admissionNo: student.admissionNo || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
      board: batch?.board?.name || '',
      classLevel: batch?.standard?.name || '',
      division: batch?.name || '',
      centre: batch?.centre?.name || '',
      bloodGroup: student.bloodGroup || "",
      phone: student.parentPhone || student.phone || '',
      photo: user.avatar || null,
      course: "Student",
      address: student.address || '',
      validUntil
    };

    return <IdCardClient student={mappedStudent} />;
  } catch (e: any) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Error Loading ID Card</h1>
          <p className="text-slate-500 mb-4">Could not find student data or an error occurred.</p>
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg text-left overflow-auto max-w-md mx-auto">
            <span className="font-bold block mb-1">Debug Info:</span>
            {e?.message || String(e)}
          </div>
        </div>
      </div>
    );
  }
}
