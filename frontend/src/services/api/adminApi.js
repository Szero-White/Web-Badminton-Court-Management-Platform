import api from './httpClient';
export const adminApi = {
  getDaySlots: (day) => api.get('/admin/slots/day', { params: { day } }),
  createStaff: (payload) => api.post('/admin/staff', payload),
  listStaff: () => api.get('/admin/staff'),
  updateStaff: (id, payload) => api.put(`/admin/staff/${id}`, payload),
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  listBookings: (day) => api.get('/admin/bookings', { params: { day } }),
  createBooking: (payload) => api.post('/admin/bookings', payload),
  updateBooking: (bookingId, payload) => api.put(`/admin/bookings/${bookingId}`, payload),
  deleteBooking: (bookingId, reason = '') => api.delete(`/admin/bookings/${bookingId}`, { data: reason ? { reason } : {} }),
  createBeverage: (payload) => api.post('/admin/beverages', payload),
  listBeverages: () => api.get('/admin/beverages'),
  updateBeverage: (beverageId, payload) => api.put(`/admin/beverages/${beverageId}`, payload),
  deleteBeverage: (beverageId, note = '') => api.delete(`/admin/beverages/${beverageId}`, { params: note ? { note } : undefined }),
  adjustBeverageStock: (beverageId, payload) => api.post(`/admin/beverages/${beverageId}/adjust-stock`, payload),
  beverageHistory: (beverageId, limit = 30) => api.get(`/admin/beverages/${beverageId}/history`, { params: { limit } }),
  createCourt: (payload) => api.post('/admin/courts', payload),
  updateCourt: (courtId, payload) => api.put(`/admin/courts/${courtId}`, payload),
  listCourts: () => api.get('/admin/courts')
};
