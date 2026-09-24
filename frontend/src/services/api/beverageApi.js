import api from './httpClient';
export const beverageApi = { list: () => api.get('/beverages') };
