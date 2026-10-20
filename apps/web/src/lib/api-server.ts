import { cookies } from "next/headers";
import { API_BASE_URL } from "./api";

export async function fetchApiServer<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("__Host-AccessToken")?.value ||
    cookieStore.get("AccessToken")?.value;
  
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 
        'Authorization': `Bearer ${token}` 
      } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
