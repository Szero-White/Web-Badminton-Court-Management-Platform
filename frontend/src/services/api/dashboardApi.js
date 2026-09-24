import api from './httpClient';
export const dashboardApi = { summary: () => api.get('/admin/dashboard/summary') };
