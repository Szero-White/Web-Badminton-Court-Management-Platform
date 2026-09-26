import api from './httpClient';
export const bookingApi = {
  listCourts: () => api.get('/courts'),
  getSlots: (day) => api.get('/slots/available', { params: { day } }),
  getDaySlots: (day) => api.get('/slots/day', { params: { day } }),
  confirmDeposit: (bookingId, payload) => api.post(`/bookings/${bookingId}/deposit`, payload)
};
