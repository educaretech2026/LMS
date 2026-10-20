import { fetchApiServer } from "@/lib/api-server";
import { ConfigClient } from "./config-client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ConfigPage() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Host-AccessToken")?.value ||
    cookieStore.get("AccessToken")?.value;
  
  if (!token) {
    redirect("/login");
  }

  // Fetch initial config
  const config = await fetchApiServer<any>('/syllabus-config').catch(() => null);

  return <ConfigClient initialConfig={config} />;
}
