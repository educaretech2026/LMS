import { fetchApiServer } from "@/lib/api-server";
import { FeeClient } from "./fee-client";

export const dynamic = 'force-dynamic';

export default async function FeePage() {
  const data = await fetchApiServer<any[]>("/fee").catch(() => []);
  const mapped = data.map((d: any) => {
    const dt = new Date(d.date || d.createdAt || Date.now());
    const formattedDate = `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
    return {
      id: d.id,
      receiptNo: d.receiptNo,
      studentId: d.studentId,
      studentName: d.student?.user?.firstName ? `${d.student.user.firstName} ${d.student.user.lastName}` : "Unknown",
      course: d.student?.enrollments?.[0]?.batch?.name || "Student",
      amount: d.amount,
      date: formattedDate,
      status: d.status,
      paymentMode: d.paymentMode || "-",
      feeHead: d.feeHead || "General",
      centreAddress: d.student?.enrollments?.[0]?.batch?.centre?.address,
      centreName: d.student?.enrollments?.[0]?.batch?.centre?.name,
      centreContactNo: d.student?.enrollments?.[0]?.batch?.centre?.contactNo,
      centreEmail: d.student?.enrollments?.[0]?.batch?.centre?.email
    };
  });

  const students = await fetchApiServer<any[]>("/students").catch(() => []);
  const tracks = await fetchApiServer<any[]>("/setup/tracks").catch(() => []);

  return <FeeClient initialFees={mapped} students={students} tracks={tracks} />;
}
