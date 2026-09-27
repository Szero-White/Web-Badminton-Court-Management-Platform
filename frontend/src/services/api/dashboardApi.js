import api from './httpClient';
export const dashboardApi = {
  summary: ({ from, to } = {}) => api.get('/admin/dashboard/summary', { params: { from, to } })
};
