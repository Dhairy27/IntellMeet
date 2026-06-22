import { useAppStore } from './store';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Keep track of any active refresh promise to share across concurrent failed requests
let refreshPromise: Promise<string | null> | null = null;

// Helper: decode response text to JSON safely to prevent syntax crashes
const safeJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse response as JSON (Status: ${response.status}).`,
      message: `Failed to parse response as JSON. Status code: ${response.status}.`,
      data: null
    };
  }
};

/**
 * Standardized request helper with credentials: 'include' and automatic token refresh interceptor.
 */
async function request(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  isFormData = false
): Promise<any> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && token !== 'undefined' && token !== 'null') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include', // Crucial: enables sharing HTTP-only cookies in cross-origin / local environments
  };

  if (data !== undefined) {
    fetchOptions.body = isFormData ? data : JSON.stringify(data);
  }

  try {
    let response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

    // If 401 Unauthorized occurs, try to refresh token (except on register/login/refresh routes themselves)
    if (
      response.status === 401 && 
      endpoint !== '/auth/login' && 
      endpoint !== '/auth/register' &&
      endpoint !== '/auth/refresh-token'
    ) {
      console.warn(`[api.ts] 401 Unauthorized on ${method} ${endpoint}. Triggering auto token refresh...`);

      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            console.log('[api.ts] Requesting token refresh from server...');
            const refreshRes = await fetch(`${API_BASE}/auth/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
            
            if (refreshRes.ok) {
              const json = await refreshRes.json();
              if (json.success && json.data?.accessToken) {
                const newToken = json.data.accessToken;
                console.log('[api.ts] Token refresh successful. Updating store and localStorage.');
                localStorage.setItem('token', newToken);
                useAppStore.setState({ token: newToken, isAuthenticated: true });
                return newToken;
              }
            }
            return null;
          } catch (err) {
            console.error('[api.ts] Token refresh request error:', err);
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const newToken = await refreshPromise;
      if (newToken) {
        // Retry the original request with the new access token
        console.log(`[api.ts] Retrying original ${method} ${endpoint} request with new token.`);
        const retryHeaders = { ...headers };
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE}${endpoint}`, {
          ...fetchOptions,
          headers: retryHeaders,
        });
      } else {
        // Refresh token invalid/expired, log out the user
        console.error('[api.ts] Session expired. Performing clean logout.');
        useAppStore.getState().logout();
      }
    }

    return await safeJson(response);
  } catch (error: any) {
    console.error(`[api.ts] ${method} ${endpoint} fetch failed:`, error);
    return { success: false, error: error.message || 'Network connection failed' };
  }
}

export const api = {
  get: async (endpoint: string) => {
    return request('GET', endpoint);
  },

  post: async (endpoint: string, data: any) => {
    return request('POST', endpoint, data);
  },

  put: async (endpoint: string, data: any) => {
    return request('PUT', endpoint, data);
  },

  putFormData: async (endpoint: string, formData: FormData) => {
    return request('PUT', endpoint, formData, true);
  },

  delete: async (endpoint: string) => {
    return request('DELETE', endpoint);
  },
};
