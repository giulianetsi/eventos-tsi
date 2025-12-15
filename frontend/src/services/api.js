import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const fetchUsers = async () => {
  const response = await axios.get(`${API_URL}/users`);
  return response.data;
};

export const fetchAlertas = async () => {
  const response = await axios.get(`${API_URL}/alertas`);
  return response.data;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, //  cookies enviados com as requisições
});

// Request interceptor: attach Bearer token from localStorage if present
api.interceptors.request.use((cfg) => {
  try {
    const token = localStorage.getItem('authToken');
    if (token) cfg.headers = Object.assign(cfg.headers || {}, { Authorization: `Bearer ${token}` });
  } catch (e) { /* ignore */ }
  return cfg;
}, (err) => Promise.reject(err));

// se token expired / unauthorized (401) -> limpar e ir pro login
api.interceptors.response.use((res) => res, (error) => {
  const status = error && error.response && error.response.status;
  const reqUrl = error && error.config && (error.config.url || error.config.baseURL || '');
  // Não interceptar/forçar redirect para o endpoint de login — deixar o componente Login tratar o erro
  if (reqUrl && String(reqUrl).includes('/users/login')) {
    return Promise.reject(error);
  }
  if (status === 401) {
    try {
      // limpar localStorage
      const userId = localStorage.getItem('user_id');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_type');
      localStorage.removeItem('user_first_name');
      localStorage.removeItem('user_last_name');
      localStorage.removeItem('permissions');
      if (userId) localStorage.removeItem(`notificationDecision_${userId}`);
      localStorage.removeItem('notificationDecision');
      // remover header default
      try { delete api.defaults.headers.common['Authorization']; } catch (e) {}
    } catch (e) {}

    // redirecionar para tela de login
    try {
      // usar replace para não permitir voltar ao estado protegido
      window.location.replace('/login');
    } catch (e) {
      // fallback
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;
