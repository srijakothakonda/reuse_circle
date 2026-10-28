import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
api.interceptors.response.use((r) => r, (error) => {
  if (axios.isCancel(error)) return Promise.reject(error);
  return Promise.reject(new Error(error.response?.data?.message || 'Unable to reach ReUseCircle. Please try again.'));
});
export default api;
