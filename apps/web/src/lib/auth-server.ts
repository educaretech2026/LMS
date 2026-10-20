import { cookies } from "next/headers";

export async function getAuthTokenFromCookies() {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';
  const hostToken = cookieStore.get("__Host-AccessToken")?.value;
  if (hostToken) return hostToken;
  if (!isProduction) {
    return cookieStore.get("AccessToken")?.value || null;
  }
  return null;
}

export async function getUserFromToken() {
  const token = await getAuthTokenFromCookies();
  
  if (!token) return null;
  
  try {
    const payloadBase64Url = token.split('.')[1];
    if (!payloadBase64Url) return null;
    
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      centreName: payload.centreName || null,
    };
  } catch (e) {
    console.error("Failed to parse JWT token on server", e);
    return null;
  }
}
