import { fetchApiServer } from "@/lib/api-server";
import { IdCardClient } from "./id-card-client";

export default async function IdCardPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const student = await fetchApiServer<any>(`/students/${resolvedParams.id}`);
    
    const user = student.user || {};
    const enrollment = student.enrollments?.[0];
    const batch = enrollment?.batch;

    const mappedStudent = {
      admissionNo: student.admissionNo || '',
      name: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
      board: batch?.board?.name || 'N/A',
      classLevel: batch?.standard?.name || 'N/A',
      division: batch?.name || 'N/A',
      centre: batch?.centre?.name || 'N/A',
      bloodGroup: "O+ve", // Static for now, can be added to db later
      phone: student.parentPhone || '',
      photo: user.avatar || null,
      course: "Student" // default course or mapped from subject
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
