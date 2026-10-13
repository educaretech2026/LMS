import { fetchApiServer } from "@/lib/api-server";
import { AssignmentsClient } from "./assignments-client";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const assignments = await fetchApiServer<any[]>('/assignments').catch(() => []);
  return <AssignmentsClient initialAssignments={assignments || []} />;
}
