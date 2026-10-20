import { fetchApiServer } from "@/lib/api-server";
import { FacultyClient } from "./faculty-client";
import { redirect } from "next/navigation";
import { getAuthTokenFromCookies } from "@/lib/auth-server";

export default async function FacultyPage() {
  const token = await getAuthTokenFromCookies();
  
  if (!token) {
    redirect("/login");
  }

  // Fetch batches for this faculty (placeholder using general setup batches for now)
  const batches = await fetchApiServer<any[]>('/setup/batches').catch(() => []);

  return <FacultyClient initialBatches={batches} />;
}
