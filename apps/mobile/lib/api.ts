import { Storage } from './storage';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.educarelearning.in/api';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await Storage.getToken();
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear auth so navigation guard can prompt login
    await Storage.clearAuth();
    if (unauthorizedHandler) {
      try {
        unauthorizedHandler();
      } catch {
        // Ignore callback error
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody.message ||
      errorBody.error ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorBody);
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}

export async function postApi<T = any>(
  endpoint: string,
  body?: any,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}
export async function patchApi<T = any>(
  endpoint: string,
  body?: any,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}

export async function deleteApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}
