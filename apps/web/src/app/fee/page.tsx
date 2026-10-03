import { fetchApiServer } from "@/lib/api-server";
import { FeeClient } from "./fee-client";

export default async function FeePage() {
  const data = await fetchApiServer<any[]>("/fee").catch(() => []);
  const mapped = data.map((d: any) => ({
    id: d.id,
    receiptNo: d.receiptNo,
    studentId: d.studentId,
    studentName: d.student?.user?.firstName ? `${d.student.user.firstName} ${d.student.user.lastName}` : "Unknown",
    course: d.student?.enrollments?.[0]?.batch?.name || "Student",
    amount: d.amount,
    date: new Date(d.date || d.createdAt || Date.now()).toLocaleDateString(),
    status: d.status,
    paymentMode: d.paymentMode || "-"
  }));

  const students = await fetchApiServer<any[]>("/students").catch(() => []);

  return <FeeClient initialFees={mapped} students={students} />;
}
