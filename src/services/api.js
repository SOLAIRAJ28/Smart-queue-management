import axios from 'axios';

let baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Normalize URL: Ensure it ends with '/api' if it's a remote URL that doesn't include it
if (baseURL && !baseURL.endsWith('/api') && !baseURL.includes('localhost:')) {
  baseURL = `${baseURL.replace(/\/$/, '')}/api`;
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s timeout — avoids silent hangs, accommodates cold starts on free hosting tiers
});

// --- Lightweight in-memory GET cache ---
const cache = new Map(); // key -> { data, expiry }
const CACHE_TTL = {
  '/branches': 30_000,       // 30s — rarely changes
  '/services': 30_000,       // 30s — rarely changes
  '/feedback/my-feedback': 20_000, // 20s
};

function getCacheKey(config) {
  return `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
}

// Request interceptor: Attach JWT + serve from cache for eligible GET requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Serve from cache if available and not expired
    if (config.method === 'get') {
      const ttl = Object.entries(CACHE_TTL).find(([path]) =>
        config.url?.endsWith(path)
      )?.[1];
      if (ttl) {
        const key = getCacheKey(config);
        const cached = cache.get(key);
        if (cached && Date.now() < cached.expiry) {
          // Return a resolved promise that short-circuits the real request
          config.adapter = () => Promise.resolve({
            data: cached.data,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
          });
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Cache eligible responses + automatic token refresh on 401
api.interceptors.response.use(
  (response) => {
    const config = response.config;
    if (config.method === 'get') {
      const ttl = Object.entries(CACHE_TTL).find(([path]) =>
        config.url?.endsWith(path)
      )?.[1];
      if (ttl && response.statusText !== 'OK (cached)') {
        cache.set(getCacheKey(config), {
          data: response.data,
          expiry: Date.now() + ttl,
        });
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const response = await axios.post(
            `${baseURL}/auth/refresh`,
            { refreshToken }
          );

          if (response.data.status === 'success') {
            const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            localStorage.setItem('token', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);

            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Refresh token expired or invalid, logging out...', refreshError);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
