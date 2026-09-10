/**
 * API base: relative /api in local dev (Vite proxies to :5000).
 * In production (Vercel), set VITE_API_URL to the deployed backend,
 * e.g. https://jeevangrid-api.onrender.com/api
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

function currentLanguage(): string {
  try {
    return localStorage.getItem('jeevangrid.language') || 'en';
  } catch {
    return 'en';
  }
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('jeevangrid_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': currentLanguage(),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      errorMessage = errData.error || errorMessage;
    } catch {
      // no json response
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
