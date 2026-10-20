/**
 * Educare Web API Client
 *
 * Client-side requests route through the same-origin Backend-for-Frontend (BFF),
 * which securely holds and attaches the HttpOnly host cookie, protecting against
 * client-side JWT exposure and XSS exfiltration.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isClient = typeof window !== 'undefined';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let targetUrl: string;

  if (isClient) {
    // Route via same-origin BFF
    if (cleanEndpoint === '/auth/login') {
      targetUrl = '/api/auth/login';
    } else if (cleanEndpoint === '/auth/logout') {
      targetUrl = '/api/auth/logout';
    } else if (cleanEndpoint === '/auth/logout-all') {
      targetUrl = '/api/auth/logout-all';
    } else {
      targetUrl = `/api/proxy${cleanEndpoint}`;
    }
  } else {
    // Server-side fallback directly to API
    targetUrl = `${API_BASE_URL}${cleanEndpoint}`;
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(targetUrl, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
  }

  // Handle empty or 204 responses gracefully
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
