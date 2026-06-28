import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'
});

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

function clearAuthAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_name');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh');

    if (status !== 401 || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        addRefreshSubscriber((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshRes = await api.post('/auth/refresh', { refresh_token: refreshToken });
      const data = refreshRes?.data?.data;
      const newAccessToken = data?.tokens?.access_token;
      const newRefreshToken = data?.tokens?.refresh_token || refreshToken;

      if (!newAccessToken) {
        throw new Error('missing refreshed access token');
      }

      localStorage.setItem('access_token', newAccessToken);
      localStorage.setItem('refresh_token', newRefreshToken);
      if (data?.user?.role) {
        localStorage.setItem('user_role', data.user.role);
      }
      if (data?.user?.full_name) {
        localStorage.setItem('user_name', data.user.full_name);
      }

      onRefreshed(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export const authApi = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload)
};

export const bookingApi = {
  listCourts: () => api.get('/courts'),
  getSlots: (day) => api.get(`/slots/available?day=${day}`),
  getDaySlots: (day) => api.get(`/slots/day?day=${day}`),
  listBookingsByDay: (day) => api.get(`/admin/bookings?day=${day}`),
  createForCustomer: (payload) => api.post('/staff/bookings/create', payload),
  confirmDeposit: (bookingId, payload) => api.post(`/bookings/${bookingId}/deposit`, payload),
  createPending: (timeSlotId) => api.post('/bookings/pending', { time_slot_id: timeSlotId }),
  myBookings: () => api.get('/bookings/me')
};

export const beverageApi = {
  list: () => api.get('/beverages')
};

export const adminApi = {
  createStaff: (payload) => api.post('/admin/staff', payload),
  listStaff: () => api.get('/admin/staff'),
  updateStaff: (id, payload) => api.put(`/admin/staff/${id}`, payload),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  listBookings: (day) => api.get(`/admin/bookings?day=${day}`),
  createBooking: (payload) => api.post('/admin/bookings', payload),
  updateBooking: (bookingId, payload) => api.put(`/admin/bookings/${bookingId}`, payload),
  deleteBooking: (bookingId, reason = '') => api.delete(`/admin/bookings/${bookingId}`, { data: reason ? { reason } : {} }),
  createBeverage: (payload) => api.post('/admin/beverages', payload),
  listBeverages: () => api.get('/admin/beverages'),
  updateBeverage: (beverageId, payload) => api.put(`/admin/beverages/${beverageId}`, payload),
  deleteBeverage: (beverageId, note = '') => api.delete(`/admin/beverages/${beverageId}${note ? `?note=${encodeURIComponent(note)}` : ''}`),
  adjustBeverageStock: (beverageId, payload) => api.post(`/admin/beverages/${beverageId}/adjust-stock`, payload),
  beverageHistory: (beverageId, limit = 30) => api.get(`/admin/beverages/${beverageId}/history?limit=${limit}`),
  createCourt: (payload) => api.post('/admin/courts', payload),
  updateCourt: (courtId, payload) => api.put(`/admin/courts/${courtId}`, payload),
  listCourts: () => api.get('/admin/courts')
};

export const staffApi = {
  checkin: (codeOrPhone) => api.post('/staff/checkin', { code_or_phone: codeOrPhone }),
  createBookingForCustomer: (payload) => api.post('/staff/bookings/create', payload),
  updateBooking: (bookingId, payload) => api.put(`/staff/bookings/${bookingId}`, payload),
  deleteBooking: (bookingId, reason = '') => api.delete(`/staff/bookings/${bookingId}`, { data: reason ? { reason } : {} }),
  listBeverageStock: () => api.get('/staff/beverages'),
  sellBeverage: (payload) => api.post('/staff/beverages/sell', payload),
  restockBeverage: (payload) => api.post('/staff/beverages/restock', payload),
  ownerWithdrawCash: (payload) => api.post('/staff/transactions', { ...payload, type: 'owner_withdraw', payment_method: 'cash' }),
  createTransaction: (payload) => api.post('/staff/transactions', payload),
  createRefund: (payload) => api.post('/staff/transactions/refund', payload),
  getShiftSummary: (shift) => api.get(`/staff/shift-summary?shift=${shift}`),
  listTransactions: (shift) => api.get(`/staff/transactions?shift=${shift}`)
};

export const dashboardApi = {
  summary: () => api.get('/admin/dashboard/summary')
};

export default api;
