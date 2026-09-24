import api from './httpClient';
export const staffApi = {
  getDaySlots: (day) => api.get('/staff/slots/day', { params: { day } }),
  checkin: (codeOrPhone) => api.post('/staff/checkin', { code_or_phone: codeOrPhone }),
  createBookingForCustomer: (payload) => api.post('/staff/bookings/create', payload),
  updateBooking: (bookingId, payload) => api.put(`/staff/bookings/${bookingId}`, payload),
  listBeverageStock: () => api.get('/staff/beverages'),
  sellBeverage: (payload) => api.post('/staff/beverages/sell', payload),
  restockBeverage: (payload) => api.post('/staff/beverages/restock', payload),
  ownerWithdrawCash: (payload) => api.post('/staff/transactions', { ...payload, type: 'owner_withdraw', payment_method: 'cash' }),
  createTransaction: (payload) => api.post('/staff/transactions', payload),
  createRefund: (payload) => api.post('/staff/transactions/refund', payload),
  getShiftSummary: (shift) => api.get('/staff/shift-summary', { params: { shift } }),
  listTransactions: (shift) => api.get('/staff/transactions', { params: { shift } })
};
