import { fetchApiServer } from "@/lib/api-server";
import { DoubtsClient } from "./doubts-client";

export const dynamic = "force-dynamic";

export default async function DoubtsPage() {
  const [initialDoubts, initialTeachers] = await Promise.all([
    fetchApiServer<any[]>("/doubts").catch(() => []),
    fetchApiServer<any[]>("/doubts/teachers/available").catch(() => []),
  ]);

  return (
    <DoubtsClient
      initialDoubts={initialDoubts || []}
      initialTeachers={initialTeachers || []}
    />
  );
}
