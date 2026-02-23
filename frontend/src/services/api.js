import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

let isRefreshing = false;

api.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                redirectToLogin();
                return Promise.reject(error);
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('/auth/refresh/');
                isRefreshing = false;
                return api(originalRequest);
            } catch {
                isRefreshing = false;
                redirectToLogin();
                return Promise.reject(error);
            }
        }

        // Log errors for debugging
        if (error.response) {
            console.error(`API error ${error.response.status}:`, error.response.data);
        } else if (error.request) {
            console.error('No response from server — is the backend running?');
        } else {
            console.error('Request error:', error.message);
        }

        return Promise.reject(error);
    }
);

function redirectToLogin() {
    const current = window.location.pathname;
    if (!current.includes('login') && !current.includes('register')) {
        window.location.href = '/src/pages/login.html';
    }
}

export default api;
