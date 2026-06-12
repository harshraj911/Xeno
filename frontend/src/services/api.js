import axios from 'axios';
import toast from 'react-hot-toast';

let BASE_URL = import.meta.env.VITE_API_URL || '/api';
if (BASE_URL && !BASE_URL.startsWith('http') && !BASE_URL.startsWith('/')) {
  BASE_URL = `https://${BASE_URL}`;
}

const api = axios.create({
  baseURL: BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Global error handler
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Something went wrong';
    if (err.response?.status !== 404) {
      toast.error(message);
    }
    return Promise.reject(err);
  }
);

// Customers
export const customersApi = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.patch(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  stats: () => api.get('/customers/stats/overview'),
  timeline: (id) => api.get(`/customers/${id}/timeline`)
};

// Orders
export const ordersApi = {
  list: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  stats: () => api.get('/orders/stats/overview')
};

// Segments
export const segmentsApi = {
  list: () => api.get('/segments'),
  get: (id) => api.get(`/segments/${id}`),
  create: (data) => api.post('/segments', data),
  update: (id, data) => api.put(`/segments/${id}`, data),
  delete: (id) => api.delete(`/segments/${id}`),
  preview: (rules) => api.post('/segments/preview', { rules }),
  refresh: (id) => api.post(`/segments/${id}/refresh`),
  stats: (id) => api.get(`/segments/${id}/stats`),
  members: (id, params) => api.get(`/segments/${id}/members`, { params }),
  aiGenerate: (prompt) => api.post('/segments/ai-generate', { prompt })
};

// Campaigns
export const campaignsApi = {
  list: (params) => api.get('/campaigns', { params }),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  launch: (id) => api.post(`/campaigns/${id}/launch`),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  stats: (id) => api.get(`/campaigns/${id}/stats`),
  insights: (id) => api.get(`/campaigns/${id}/insights`),
  delete: (id) => api.delete(`/campaigns/${id}`),
  aiCreate: (data) => api.post('/campaigns/ai-create', data),
  aiMessage: (data) => api.post('/campaigns/ai-message', data)
};

// Analytics
export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  campaigns: (days) => api.get('/analytics/campaigns', { params: { days } }),
  segments: () => api.get('/analytics/segments'),
  cohorts: () => api.get('/analytics/customers/cohorts')
};

// Receipts
export const receiptsApi = {
  campaign: (id, params) => api.get(`/receipts/campaign/${id}`, { params })
};

// Ingest
export const ingestApi = {
  seed: (count = 500) => api.post('/ingest/seed', { count }),
  clear: () => api.delete('/ingest/clear'),
  customers: (data) => api.post('/ingest/customers', data),
  orders: (data) => api.post('/ingest/orders', data)
};

// AI
export const aiApi = {
  segment: (prompt) => api.post('/ai/segment', { prompt }),
  message: (data) => api.post('/ai/message', data),
  suggestChannel: (data) => api.post('/ai/suggest-channel', data),
  getConversation: (sessionId) => api.get(`/ai/conversation/${sessionId}`)
};

export default api;
