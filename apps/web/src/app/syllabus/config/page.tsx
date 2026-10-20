import { fetchApiServer } from "@/lib/api-server";
import { ConfigClient } from "./config-client";
import { redirect } from "next/navigation";
import { getAuthTokenFromCookies } from "@/lib/auth-server";

export default async function ConfigPage() {
  const token = await getAuthTokenFromCookies();
  
  if (!token) {
    redirect("/login");
  }

  // Fetch initial config
  const config = await fetchApiServer<any>('/syllabus-config').catch(() => null);

  return <ConfigClient initialConfig={config} />;
}
