import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL, timeout: 20000 });
const refreshClient = axios.create({ baseURL, timeout: 20000 });
let refreshPromise = null;

export function clearAuthSession() {
  ['access_token', 'refresh_token', 'user_role', 'user_name', 'last_booking_day'].forEach((key) => localStorage.removeItem(key));
}

function redirectToLogin() {
  clearAuthSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.assign('/login');
}

function persistSession(data, fallbackRefreshToken) {
  const accessToken = data?.tokens?.access_token;
  if (!accessToken) throw new Error('Refresh response did not include an access token.');
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', data?.tokens?.refresh_token || fallbackRefreshToken);
  if (data?.user?.role) localStorage.setItem('user_role', data.user.role);
  if (data?.user?.full_name) localStorage.setItem('user_name', data.user.full_name);
  return accessToken;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('Missing refresh token.');
  const response = await refreshClient.post('/auth/refresh', { refresh_token: refreshToken });
  return persistSession(response?.data?.data, refreshToken);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');
    if (!originalRequest || error?.response?.status !== 401 || isAuthEndpoint || originalRequest._retry) return Promise.reject(error);

    originalRequest._retry = true;
    try {
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const accessToken = await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
