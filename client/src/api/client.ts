/**
 * API base: relative /api in local dev (Vite proxies to :5000).
 * In production (Vercel), set VITE_API_URL to the deployed backend,
 * e.g. https://jeevangrid-api.onrender.com/api
 */
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

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
    const error = new Error(errorMessage) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  // Offline service worker metadata: users must know when data is cached.
  try {
    const cachedAt = response.headers.get('X-JG-Cached-At');
    if (cachedAt) localStorage.setItem('jeevangrid.lastDataAt', cachedAt);
    if (response.headers.get('X-JG-Cache-Hit')) {
      localStorage.setItem('jeevangrid.cachedResponse', 'true');
    } else {
      localStorage.removeItem('jeevangrid.cachedResponse');
    }
  } catch {
    /* storage unavailable */
  }

  try {
    return await response.json();
  } catch {
    return {} as T;
  }
}
