import { fetchApiServer } from "@/lib/api-server";
import { StudentClient } from "./student-client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function StudentSyllabusPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("AccessToken")?.value;
  
  if (!token) {
    redirect("/login");
  }

  const profile = await fetchApiServer<any>('/users/me').catch(() => null);
  const defaultBatchId = profile?.studentProfile?.enrollments?.[0]?.batchId;
  const studentId = profile?.studentProfile?.id;

  return <StudentClient initialBatchId={defaultBatchId} studentId={studentId} />;
}
