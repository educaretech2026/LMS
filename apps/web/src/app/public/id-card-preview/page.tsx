import { IdCardClient } from "@/app/students/[id]/id-card/id-card-client";

export default function PublicIdCardPreview() {
  const dummyStudent = {
    admissionNo: "ADM-2026-001",
    name: "ALEXANDER WRIGHT",
    board: "CBSE",
    classLevel: "Grade 10",
    division: "Science - A",
    centre: "Main Campus",
    bloodGroup: "O+",
    phone: "+91 9876543210",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    course: "Student",
    address: "123 Education Lane,\nKnowledge City, 400001",
    validUntil: "Mar 2027"
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">ID Card Preview</h1>
        <p className="text-slate-400">Public preview route (No authentication required)</p>
      </div>
      <IdCardClient student={dummyStudent} />
    </div>
  );
}
