import { fetchApiServer } from "@/lib/api-server";
import { getUserFromToken } from "@/lib/auth-server";
import { DoubtsClient } from "./doubts-client";

export const dynamic = "force-dynamic";

export default async function DoubtsPage() {
  const [initialDoubts, initialTeachers, user] = await Promise.all([
    fetchApiServer<any[]>("/doubts").catch(() => []),
    fetchApiServer<any[]>("/doubts/teachers/available").catch(() => []),
    getUserFromToken().catch(() => null),
  ]);

  return (
    <DoubtsClient
      initialDoubts={initialDoubts || []}
      initialTeachers={initialTeachers || []}
      initialRole={user?.role}
    />
  );
}
