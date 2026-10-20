import { fetchApiServer } from "@/lib/api-server";
import { SyllabusClient } from "./syllabus-client";
import { getAuthTokenFromCookies } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function SyllabusPage() {
  const token = await getAuthTokenFromCookies();
  let isStudent = false;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role === 'STUDENT') {
        isStudent = true;
      }
    } catch(e) {}
  }

  if (isStudent) {
    redirect("/syllabus/student");
  }

  const [batches, boards, tracks] = await Promise.all([
    fetchApiServer<any[]>('/setup/batches').catch(() => []),
    fetchApiServer<any[]>('/setup/boards').catch(() => []),
    fetchApiServer<any[]>('/setup/tracks').catch(() => [])
  ]);
  
  return <SyllabusClient initialBatches={batches} initialBoards={boards} initialTracks={tracks} />;
}
