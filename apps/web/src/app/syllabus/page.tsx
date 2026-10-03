import { fetchApiServer } from "@/lib/api-server";
import { SyllabusClient } from "./syllabus-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SyllabusPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("AccessToken")?.value;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role === 'STUDENT') {
        redirect("/syllabus/student");
      }
    } catch(e) {}
  }

  const [batches, boards] = await Promise.all([
    fetchApiServer<any[]>('/setup/batches').catch(() => []),
    fetchApiServer<any[]>('/setup/boards').catch(() => [])
  ]);
  
  return <SyllabusClient initialBatches={batches} initialBoards={boards} />;
}
